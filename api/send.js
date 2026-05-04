/**
 * api/send.js
 * ─────────────────────────────────────────────────────────────────
 * Endpoint para o painel enviar mensagens humanas pelo WhatsApp.
 * Chamado quando o atendente digita e envia uma mensagem na aba
 * "Atendimento" do painel (status = human).
 *
 * POST /api/send
 * Body: { convId, text }
 * ─────────────────────────────────────────────────────────────────
 */
const { store } = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { convId, text, action } = req.body || {};

  const conv = store.conversations.find(c => c.id === convId);
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });

  // ── Ação: mudar status (assumir / devolver pra IA) ────────────────
  if (action === 'takeover') {
    conv.status = 'human';
    conv.updatedAt = Date.now();
    return res.status(200).json({ ok: true, status: conv.status });
  }
  if (action === 'givebackai') {
    conv.status = 'ai';
    conv.updatedAt = Date.now();
    return res.status(200).json({ ok: true, status: conv.status });
  }

  // ── Ação: enviar mensagem ─────────────────────────────────────────
  if (!text?.trim()) return res.status(400).json({ error: 'Texto vazio' });

  // Registrar no store
  conv.messages.push({ from: 'human', text: text.trim(), ts: Date.now() });
  conv.updatedAt = Date.now();

  // Enviar pelo WhatsApp via Evolution API
  const EVO_URL      = process.env.EVO_URL;
  const EVO_INSTANCE = process.env.EVO_INSTANCE;
  const EVO_KEY      = process.env.EVO_KEY;

  if (EVO_URL && EVO_INSTANCE && EVO_KEY) {
    try {
      const r = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVO_KEY },
        body: JSON.stringify({ number: conv.phone, text: text.trim(), delay: 500 }),
      });
      if (!r.ok) {
        const err = await r.text();
        console.error('[evo/send] Erro:', r.status, err);
        return res.status(502).json({ error: 'Falha ao enviar pelo WhatsApp', detail: err });
      }
    } catch (e) {
      console.error('[evo/send] Fetch error:', e);
      return res.status(502).json({ error: 'Falha de conexão com Evolution API' });
    }
  } else {
    console.warn('[evo/send] Variáveis EVO não configuradas — mensagem salva apenas no store.');
  }

  return res.status(200).json({ ok: true });
};
