/**
 * api/webhook.js
 * ─────────────────────────────────────────────────────────────────
 * Recebe o webhook da Evolution API quando uma mensagem chega no
 * WhatsApp da instância Gatto.
 *
 * Configure no painel da Evolution API:
 *   URL do Webhook → https://SEU-PROJETO.vercel.app/api/webhook
 *   Eventos        → MESSAGES_UPSERT
 *
 * Variáveis de ambiente (Vercel Dashboard → Settings → Environment Variables):
 *   EVO_URL         URL base da Evolution API  ex: https://evo.seudominio.com
 *   EVO_INSTANCE    Nome da instância           ex: gatto
 *   EVO_KEY         API Key da Evolution API
 *   WEBHOOK_SECRET  Segredo pra validar origem  (qualquer string aleatória)
 *   AI_PROVIDER     "keyword" | "gemini"        (default: keyword)
 *   GEMINI_KEY      Chave da API Gemini          (só se AI_PROVIDER=gemini)
 * ─────────────────────────────────────────────────────────────────
 */

// Armazenamento em memória (reinicia a cada cold start do serverless).
// Para persistência real, use Upstash Redis ou Vercel KV.
// Importamos de um módulo compartilhado para que /api/messages.js
// acesse o mesmo array.
const { store } = require('./_store');

module.exports = async function handler(req, res) {
  // ── Validação de método ──────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Validação opcional de segredo ────────────────────────────────
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers['x-webhook-secret'] || req.headers['authorization'];
    if (incoming !== secret && incoming !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const body = req.body;

  // ── Filtrar só eventos de mensagem ───────────────────────────────
  // A Evolution API envia event = "messages.upsert"
  if (body?.event !== 'messages.upsert' && body?.event !== 'MESSAGES_UPSERT') {
    return res.status(200).json({ ignored: true });
  }

  const data = body?.data || body?.message;
  if (!data) return res.status(200).json({ ignored: true, reason: 'no data' });

  // ── Extrair campos da mensagem ───────────────────────────────────
  // Formato padrão da Evolution API v2
  const key        = data.key || {};
  const fromMe     = key.fromMe === true;
  if (fromMe) return res.status(200).json({ ignored: true, reason: 'outgoing' });

  const remoteJid  = key.remoteJid || '';           // ex: 5573988887777@s.whatsapp.net
  const phone      = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
  const pushName   = data.pushName || data.notifyName || phone;
  const msgContent = data.message || {};
  const text       = msgContent.conversation
                  || msgContent.extendedTextMessage?.text
                  || msgContent.imageMessage?.caption
                  || '[mídia]';

  if (!phone || !text) return res.status(200).json({ ignored: true, reason: 'empty msg' });

  // ── Encontrar ou criar conversa no store ─────────────────────────
  let conv = store.conversations.find(c => c.phone === phone);
  if (!conv) {
    conv = {
      id:         'evo_' + phone,
      phone,
      name:       pushName,
      status:     'ai',      // começa com a IA respondendo
      unread:     true,
      messages:   [],
      createdAt:  Date.now(),
    };
    store.conversations.push(conv);
  }

  // Adicionar mensagem do cliente
  conv.messages.push({ from: 'customer', text, ts: Date.now() });
  conv.unread = true;
  conv.updatedAt = Date.now();

  // ── Se IA está no controle → gerar resposta ──────────────────────
  if (conv.status === 'ai') {
    const reply = await generateReply(text, conv, store);
    if (reply) {
      // Salvar na conversa
      conv.messages.push({ from: 'ai', text: reply, ts: Date.now() });

      // Enviar pelo WhatsApp via Evolution API
      await sendEvoMessage(phone, reply);
    }
  }

  return res.status(200).json({ ok: true });
};

// ──────────────────────────────────────────────────────────────────
// Gera resposta: pode ser por palavras-chave (offline) ou Gemini
// ──────────────────────────────────────────────────────────────────
async function generateReply(text, conv, store) {
  const provider = process.env.AI_PROVIDER || 'keyword';

  if (provider === 'gemini') {
    return await geminiReply(text, conv, store);
  }
  // Padrão: palavras-chave (funciona sem nenhuma API key)
  return keywordReply(text, conv, store);
}

// ── Resposta por palavras-chave (mesmo comportamento do frontend) ──
function keywordReply(message, conv, store) {
  const m = message.toLowerCase();
  const firstName = conv.name.split(' ')[0] || 'amigo(a)';
  const products = store.products || [];

  function matchProduct(t) {
    const candidates = products.map(p => {
      const tokens = p.name.toLowerCase().split(/\s+/);
      const hits = tokens.filter(tok => tok.length > 2 && t.includes(tok)).length;
      return { p, hits };
    });
    candidates.sort((a, b) => b.hits - a.hits);
    return candidates[0]?.hits > 0 ? candidates[0].p : null;
  }

  function fmtBRL(n) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }

  if (/(\b(oi|ol[áa]|bom dia|boa tarde|boa noite|e a[íi])\b)/.test(m))
    return `Olá ${firstName}! Aqui é da Cerâmica Gatto 🏠 Como posso te ajudar?`;

  if (/(urgent|hoje|agora|imediato|preciso j[aá])/.test(m))
    return `Entendi a urgência, ${firstName}! Um atendente vai te chamar em breve com prioridade.`;

  if (/(pre[çc]o|valor|quanto custa|or[çc]amento|milheiro)/.test(m)) {
    const p = matchProduct(m);
    if (p) return `O *${p.name}* sai por *R$ ${fmtBRL(p.pricePerThousand)} o milheiro*. Qual quantidade você precisa?`;
    return `Trabalhamos com Telhas, Lajotas e Cobogós. Qual produto te interessa para eu passar o preço?`;
  }

  if (/(estoque|tem dispon|pronta entrega)/.test(m)) {
    const p = matchProduct(m);
    if (p) {
      const s = p.stock === 0 ? 'sem estoque no momento' : p.stock <= 5 ? `${p.stock} milheiros (estoque limitado)` : `${p.stock} milheiros disponíveis`;
      return `${p.name} está com ${s}. Quer reservar?`;
    }
    return `Temos pronta entrega na maioria dos itens. Qual peça você precisa?`;
  }

  if (/(entrega|frete|envio|transporte)/.test(m))
    return `Entregamos em toda a região Sul da Bahia (Teixeira de Freitas, Itamaraju, Eunápolis, Porto Seguro, Caravelas, Itabela e região). Pra qual cidade seria?`;

  if (/(ficha|t[ée]cnic|especifica|peso|medida|dimens)/.test(m)) {
    const p = matchProduct(m);
    if (p && p.specs?.length) {
      const top = p.specs.slice(0, 4).map(([k, v]) => `• ${k}: ${v}`).join('\n');
      return `Ficha técnica da *${p.name}*:\n${top}\n\nPosso montar um orçamento?`;
    }
    return `Posso passar a ficha técnica completa. Qual produto você quer consultar?`;
  }

  if (/(cat[áa]logo|produtos|quais|tipos)/.test(m)) {
    const cats = [...new Set(products.map(p => p.category))];
    return `Trabalhamos com: ${cats.join(', ')}. Total de ${products.length} produtos. Qual categoria te interessa?`;
  }

  if (/(obrigad|valeu|beleza|t[áa] bom)/.test(m))
    return `Imagina, ${firstName}! Estamos aqui pelo que precisar. 🙌`;

  return `Recebi sua mensagem, ${firstName}! Pode me dar mais detalhes? Ajudo com preços, estoque, ficha técnica e orçamento. 😊`;
}

// ── Resposta via Gemini API ────────────────────────────────────────
async function geminiReply(text, conv, store) {
  const key = process.env.GEMINI_KEY;
  if (!key) return keywordReply(text, conv, store); // fallback

  const products = (store.products || []).map(p =>
    `${p.name} (${p.category}) - R$${p.pricePerThousand}/milheiro - Estoque: ${p.stock} milheiros`
  ).join('\n');

  const systemPrompt = `Você é o assistente virtual da Cerâmica Gatto, fábrica de telhas, lajotas e cobogós localizada no Sul da Bahia, com 36 anos de experiência.
Responda de forma cordial, objetiva e profissional. Use o WhatsApp Business como canal — emojis moderados, frases curtas, máximo 3 parágrafos.
Produtos disponíveis:\n${products}
Região de entrega: Sul da Bahia (Teixeira de Freitas, Itamaraju, Eunápolis, Porto Seguro, Caravelas, Itabela e região).
Contato: (73) 99944-4820 | 0800 703 3242
Nome do cliente: ${conv.name}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
        }),
      }
    );
    const json = await response.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || keywordReply(text, conv, store);
  } catch (e) {
    console.error('[Gemini error]', e);
    return keywordReply(text, conv, store);
  }
}

// ── Envia mensagem pelo WhatsApp via Evolution API ─────────────────
async function sendEvoMessage(phone, text) {
  const EVO_URL      = process.env.EVO_URL;
  const EVO_INSTANCE = process.env.EVO_INSTANCE;
  const EVO_KEY      = process.env.EVO_KEY;

  if (!EVO_URL || !EVO_INSTANCE || !EVO_KEY) {
    console.warn('[evo] Variáveis EVO_URL / EVO_INSTANCE / EVO_KEY não configuradas.');
    return;
  }

  const url = `${EVO_URL}/message/sendText/${EVO_INSTANCE}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_KEY,
      },
      body: JSON.stringify({
        number: phone,
        text,
        delay: 1200,  // simula digitação (ms)
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[evo] Erro ao enviar mensagem:', r.status, err);
    }
  } catch (e) {
    console.error('[evo] Fetch error:', e);
  }
}
