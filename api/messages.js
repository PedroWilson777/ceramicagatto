/**
 * api/messages.js
 * ─────────────────────────────────────────────────────────────────
 * Endpoint de polling: o painel (index.html) chama este endpoint
 * a cada 5 segundos para buscar conversas novas/atualizadas.
 *
 * GET /api/messages
 *   → retorna todas as conversas com mensagens
 *
 * GET /api/messages?since=<timestamp>
 *   → retorna só conversas atualizadas após o timestamp
 * ─────────────────────────────────────────────────────────────────
 */
const { store } = require('./_store');

module.exports = function handler(req, res) {
  // Habilitar CORS para o painel no GitHub Pages também poder consultar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  const since = Number(req.query.since) || 0;

  const result = store.conversations
    .filter(c => !since || (c.updatedAt || c.createdAt || 0) > since)
    .map(c => ({
      id:        c.id,
      phone:     c.phone,
      name:      c.name,
      status:    c.status,
      unread:    c.unread,
      updatedAt: c.updatedAt || c.createdAt,
      messages:  c.messages,
    }));

  return res.status(200).json({ ok: true, conversations: result, ts: Date.now() });
};
