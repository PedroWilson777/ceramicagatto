# Cerâmica Gatto · Painel v0.3

Painel interno single-file com **atendimento real via WhatsApp** conectado à **Evolution API**, IA por palavras-chave (ou Gemini), deploy no **Vercel + GitHub Pages**.

## 📂 Estrutura

```
ceramicagatto/
├── index.html          # Frontend completo — HTML, CSS, JS
├── api/
│   ├── _store.js       # Store em memória compartilhado entre funções
│   ├── webhook.js      # Recebe mensagens da Evolution API (POST)
│   ├── messages.js     # Polling de conversas pelo painel (GET)
│   └── send.js         # Envia mensagens humanas pelo WhatsApp (POST)
├── vercel.json         # Configuração do Vercel
├── package.json        # Metadados do projeto
├── robots.txt          # Bloqueia indexação (painel interno)
├── sitemap.xml
├── .nojekyll           # GitHub Pages sem Jekyll
└── .gitignore
```

## 🚀 Deploy no Vercel (recomendado — tem o backend)

### 1. Instalar Vercel CLI
```bash
npm install -g vercel
```

### 2. Deploy
```bash
cd c:\Users\Xulip\Downloads\gatto
vercel --prod
```

### 3. Configurar variáveis de ambiente no Vercel Dashboard
Acesse: https://vercel.com → Seu projeto → Settings → Environment Variables

| Variável | Valor | Obrigatório |
|---|---|---|
| `EVO_URL` | `https://evo.seudominio.com` | ✅ |
| `EVO_INSTANCE` | `gatto` (nome da instância) | ✅ |
| `EVO_KEY` | Sua API Key da Evolution | ✅ |
| `WEBHOOK_SECRET` | Qualquer string aleatória segura | Recomendado |
| `AI_PROVIDER` | `keyword` ou `gemini` | Opcional (default: keyword) |
| `GEMINI_KEY` | Sua chave da API Gemini | Só se usar Gemini |

### 4. Configurar Webhook na Evolution API
No painel da Evolution API (ou via API):
- URL: `https://ceramicagatto.vercel.app/api/webhook`
- Evento: `MESSAGES_UPSERT`
- Adicionar header: `x-webhook-secret: SUA_STRING_SECRETA`

### 5. Configurar o painel para apontar pro backend
Abra o painel → botão **⚙ Configurar API** no rodapé → cole a URL do Vercel.
Isso é salvo no `localStorage` do seu navegador.

## 🌐 GitHub Pages (apenas frontend estático)

O `index.html` funciona no GitHub Pages mas **sem o backend real** — IA mock local apenas.
Útil para ter uma URL pública do painel enquanto o Vercel processa os webhooks.

```bash
git init
git add .
git commit -m "Painel Cerâmica Gatto v0.3"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/ceramicagatto.git
git push -u origin main
```

No GitHub: Settings → Pages → Source: main / root → Save.

## 🤖 Fluxo do atendimento

```
WhatsApp do cliente
      ↓
Evolution API (sua VPS)
      ↓ webhook POST
Vercel /api/webhook
      ↓
Gera resposta (IA por palavras-chave ou Gemini)
      ↓
Evolution API /message/sendText
      ↓
WhatsApp do cliente ← resposta automática

Painel (index.html)
      ↓ polling GET a cada 5s
Vercel /api/messages
      ↓
Exibe conversas ao vivo

Atendente clica "Assumir" → status = human
      ↓
Digita mensagem → POST /api/send → WhatsApp
```

## ⚠️ Limitações do backend em memória

As conversas ficam na RAM do servidor Vercel — reiniciam com cold starts (~15min de inatividade).

Para persistência real, use [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (Redis) — basta trocar `_store.js` por chamadas ao KV. Me avisa que faço a migração.

## 🎨 Identidade visual

- Tipografia: **Bricolage Grotesque** + **Manrope** + **JetBrains Mono**
- Paleta: papel quente `#f4f1ea`, verde `#0e5c3a`, vermelho `#b41d28`, terracota `#c8553d`

---

v0.3 · Evolution API integration · Pedro × Cerâmica Gatto
