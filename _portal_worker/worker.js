// ═══════════════════════════════════════════════════════════════════════════
// Cloudflare Worker: portal-static — serve o portal HTML em
//   https://projetos.7lucasfernandes.workers.dev/
//
// O que faz: busca o index.html direto do GitHub Pages, mantém em cache no
// edge do Cloudflare por 5 minutos, e devolve para o visitante. Não altera
// o conteúdo — o portal continua funcionando como se estivesse no GitHub.
//
// Por que existe: dá URL alternativa (mais curta, mais controlável, sem
// depender de uptime do GitHub Pages) e permite bloquear domínios via
// domain lock nativo do JS ofuscado.
//
// Deploy: Cloudflare Dashboard → Workers → criar novo worker com nome
// "portal-static" (ou o nome que virar o subdomínio projetos.*) → colar
// este código → Save and Deploy.
// ═══════════════════════════════════════════════════════════════════════════

const UPSTREAM = 'https://lucas7fernandes.github.io/Projetos/';
const HTML_TTL_SECONDS = 5 * 60; // 5 min de cache no edge

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Só serve o path raiz (ou index.html) — evita rotas fantasmas
    if (url.pathname !== '/' && url.pathname !== '/index.html') {
      return new Response('Not Found', { status: 404 });
    }

    const cache = caches.default;
    const cacheKey = new Request('https://portal-cache.internal/index.html');

    // 1. Tenta pegar do edge cache
    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    // 2. Cache miss — busca do GitHub Pages
    try {
      const upstream = await fetch(UPSTREAM, {
        headers: { 'Accept': 'text/html,application/xhtml+xml' }
      });
      if (!upstream.ok) {
        return new Response('Upstream error: ' + upstream.status, { status: 502 });
      }

      const html = await upstream.text();

      // 3. Constrói nova resposta com Cache-Control apropriado para edge
      response = new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': `public, max-age=${HTML_TTL_SECONDS}`,
          'X-Portal-Source': 'cloudflare-edge'
        }
      });

      // 4. Guarda no cache do edge
      await cache.put(cacheKey, response.clone());
      return response;
    } catch (e) {
      return new Response('Portal indisponível: ' + (e.message || e), { status: 502 });
    }
  }
};
