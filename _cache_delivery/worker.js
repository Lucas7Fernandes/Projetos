// ═══════════════════════════════════════════════════════════════════════════
// Cloudflare Worker: goobee-proxy com CACHE COMPARTILHADO via caches.default
// ═══════════════════════════════════════════════════════════════════════════
//
// Substitui o Worker em https://goobee-proxy.7lucasfernandes.workers.dev
//
// ⚠️ SEM KV — usa caches.default (Cache API nativa do Cloudflare Edge).
// ⚠️ SEM BINDINGS — só cola, salva, deploy.
//
// Como funciona o cache compartilhado:
//   - caches.default é o cache do edge Cloudflare, compartilhado entre TODOS
//     os visitantes que caem no mesmo data center (em geral, todos os usuários
//     do Brasil caem no edge de São Paulo/Rio, então o cache é único).
//   - Quando alguém chama /refresh, o Worker busca da Goobee e ARMAZENA no
//     edge cache com TTL de 6h. Todo mundo depois disso lê do cache (~30ms).
//   - Se o TTL expirar sem ninguém apertar Atualizar, a próxima chamada de
//     /cache retorna 404 e o cliente automaticamente tenta /refresh.
//
// Rotas:
//   GET  /cache      → dados do cache. Se vazio → 404 (cliente chama /refresh)
//   POST /refresh    → chama Goobee, atualiza cache, retorna dado novo
//   GET  /status     → só timestamp (polling leve de 30s)
//   GET  /?url=...   → passthrough legado (compatibilidade)
//
// ═══════════════════════════════════════════════════════════════════════════

const API_TOKEN = '39SB80HUu%2B4yWhtOjtux4rKs8DlpFyeR7d/QJ/2Q1%2BQ=';
const API_BASE  = 'https://apiteams.goobee.com.br/api';
const QUADRO_ID = 'cddbdeab-e50c-4f40-d5c2-08dc62c6f4a9';
const TIME_ID   = '8c1d119a-3f48-408f-a62a-9d0433099442';

// TTL do cache no edge (segundos). Depois disso, se ninguém apertar
// "Atualizar", a próxima leitura força um refresh automático.
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 horas

// URLs canônicas usadas como CHAVES do cache no edge.
// Precisam ser URLs absolutas HTTP GET pra caches.default aceitar.
// Uso o próprio hostname do Worker + um path fictício.
const CACHE_KEY_PROJETOS = 'https://goobee-cache.internal/v1/projetos';
const CACHE_KEY_ITENS    = 'https://goobee-cache.internal/v1/itens';
const CACHE_KEY_STATUS   = 'https://goobee-cache.internal/v1/status';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store', // resposta pro cliente nunca é cacheada por ele
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      // ── ROTA /cache ─────────────────────────────────────────────
      if (url.pathname === '/cache') {
        const cache = caches.default;
        const [respProj, respItens, respStatus] = await Promise.all([
          cache.match(CACHE_KEY_PROJETOS),
          cache.match(CACHE_KEY_ITENS),
          cache.match(CACHE_KEY_STATUS),
        ]);
        if (!respProj || !respItens) {
          return json({ ok:false, error:'Cache vazio ou expirado. Chame /refresh.', ts: null }, 404);
        }
        const [projetos, itens, statusObj] = await Promise.all([
          respProj.json(), respItens.json(), respStatus ? respStatus.json() : Promise.resolve(null),
        ]);
        return json({ ok:true, projetos, itens, ts: statusObj?.ts || null });
      }

      // ── ROTA /status ─────────────────────────────────────────────
      if (url.pathname === '/status') {
        const cache = caches.default;
        const respStatus = await cache.match(CACHE_KEY_STATUS);
        if (!respStatus) return json({ ts: null });
        const statusObj = await respStatus.json();
        return json({ ts: statusObj?.ts || null });
      }

      // ── ROTA /refresh ────────────────────────────────────────────
      if (url.pathname === '/refresh' && request.method === 'POST') {
        const [projetos, itens] = await Promise.all([
          fetchFromGoobee(`${API_BASE}/ListarProjetos?idtime=${TIME_ID}&token=${API_TOKEN}`),
          fetchFromGoobee(`${API_BASE}/ExportarQuadroExcel?idQuadro=${QUADRO_ID}&token=${API_TOKEN}`),
        ]);
        const ts = Date.now();

        const cache = caches.default;
        const headers = {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        };
        // Guardar as 3 chaves no edge cache. put() aceita Response com Cache-Control.
        await Promise.all([
          cache.put(CACHE_KEY_PROJETOS, new Response(JSON.stringify(projetos), { headers })),
          cache.put(CACHE_KEY_ITENS,    new Response(JSON.stringify(itens),    { headers })),
          cache.put(CACHE_KEY_STATUS,   new Response(JSON.stringify({ ts }),   { headers })),
        ]);

        return json({ ok:true, projetos, itens, ts });
      }

      // ── ROTA / (legado — passthrough do Worker antigo, retrocompat) ──
      const targetUrl = url.searchParams.get('url');
      if (targetUrl) {
        const upstream = await fetch(targetUrl, { headers: { 'Accept':'application/json' } });
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: { ...CORS, 'Content-Type':'application/json' }
        });
      }

      return json({ ok:false, error:'Rota nao encontrada. Use /cache, /refresh, /status.' }, 404);
    } catch (e) {
      return json({ ok:false, error: e.message || String(e) }, 500);
    }
  }
};

async function fetchFromGoobee(url) {
  const r = await fetch(url, { headers: { 'Accept':'application/json' } });
  if (!r.ok) throw new Error(`Goobee API retornou ${r.status}`);
  return await r.json();
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type':'application/json' }
  });
}
