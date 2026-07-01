// Cloudflare Worker: goobee-proxy com cache compartilhado via KV
// Deploy: substituir o Worker atual em https://goobee-proxy.7lucasfernandes.workers.dev
// Requer: KV namespace bindado como GOOBEE_KV
//
// KV keys usadas:
//   cache:projetos  → { data: [...], ts: 1234567890 }
//   cache:itens     → { data: [...], ts: 1234567890 }
//   cache:status    → { ts: 1234567890, updatedBy: 'user-id' }
//
// Rotas:
//   GET  /cache      → retorna dados do KV (sem chamar API). Rápido.
//   POST /refresh    → chama Goobee, atualiza KV, retorna dado novo.
//   GET  /status     → só timestamp (polling leve).
//   GET  /?url=...   → passthrough compatível com versão anterior (fallback).

const API_TOKEN = '39SB80HUu%2B4yWhtOjtux4rKs8DlpFyeR7d/QJ/2Q1%2BQ=';
const API_BASE  = 'https://apiteams.goobee.com.br/api';
const QUADRO_ID = 'cddbdeab-e50c-4f40-d5c2-08dc62c6f4a9';
const TIME_ID   = '8c1d119a-3f48-408f-a62a-9d0433099442';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // ── ROTA /cache ────────────────────────────────────────────
    if (url.pathname === '/cache') {
      const [projetos, itens, status] = await Promise.all([
        env.GOOBEE_KV.get('cache:projetos', 'json'),
        env.GOOBEE_KV.get('cache:itens',    'json'),
        env.GOOBEE_KV.get('cache:status',   'json'),
      ]);
      if (!projetos || !itens) {
        return json({ ok:false, error:'Cache vazio. Chame /refresh primeiro.', ts: status?.ts || null }, 404);
      }
      return json({ ok:true, projetos: projetos.data, itens: itens.data, ts: status?.ts || null });
    }

    // ── ROTA /status ───────────────────────────────────────────
    if (url.pathname === '/status') {
      const status = await env.GOOBEE_KV.get('cache:status', 'json');
      return json({ ts: status?.ts || null });
    }

    // ── ROTA /refresh ─────────────────────────────────────────
    if (url.pathname === '/refresh' && request.method === 'POST') {
      try {
        const [projetos, itens] = await Promise.all([
          fetchFromGoobee(`${API_BASE}/ListarProjetos?idtime=${TIME_ID}&token=${API_TOKEN}`),
          fetchFromGoobee(`${API_BASE}/ExportarQuadroExcel?idQuadro=${QUADRO_ID}&token=${API_TOKEN}`),
        ]);
        const ts = Date.now();
        await Promise.all([
          env.GOOBEE_KV.put('cache:projetos', JSON.stringify({ data: projetos, ts })),
          env.GOOBEE_KV.put('cache:itens',    JSON.stringify({ data: itens,    ts })),
          env.GOOBEE_KV.put('cache:status',   JSON.stringify({ ts })),
        ]);
        return json({ ok:true, projetos, itens, ts });
      } catch (e) {
        return json({ ok:false, error: e.message }, 500);
      }
    }

    // ── ROTA / (legado passthrough) ────────────────────────────
    const targetUrl = url.searchParams.get('url');
    if (targetUrl) {
      try {
        const upstream = await fetch(targetUrl, { headers: { 'Accept':'application/json' } });
        const body = await upstream.text();
        return new Response(body, { status: upstream.status, headers: { ...CORS, 'Content-Type':'application/json' } });
      } catch (e) {
        return json({ error: e.message }, 502);
      }
    }

    return json({ ok:false, error:'Rota não encontrada' }, 404);
  }
};

async function fetchFromGoobee(url) {
  const r = await fetch(url, { headers: { 'Accept':'application/json' } });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return await r.json();
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type':'application/json' }
  });
}
