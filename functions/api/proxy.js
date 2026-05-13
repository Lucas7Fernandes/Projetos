/**
 * Cloudflare Pages Function — Proxy para API Goobee
 * Arquivo: /functions/api/proxy.js  (na raiz do repositório)
 *
 * Este arquivo é detectado automaticamente pelo Cloudflare Pages.
 * Não precisa de nenhuma configuração extra — basta estar no repositório.
 *
 * Endpoint: GET /api/proxy?url=https://apiteams.goobee.com.br/...
 */

const ALLOWED_DOMAINS = ['apiteams.goobee.com.br'];

export async function onRequestGet(context) {
  const { request } = context;
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  // CORS para qualquer origem (o próprio site chama este endpoint)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Parâmetro url obrigatório' }), {
      status: 400, headers: corsHeaders,
    });
  }

  let parsed;
  try { parsed = new URL(targetUrl); } catch {
    return new Response(JSON.stringify({ error: 'URL inválida' }), {
      status: 400, headers: corsHeaders,
    });
  }

  if (!ALLOWED_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
    return new Response(JSON.stringify({ error: 'Domínio não permitido: ' + parsed.hostname }), {
      status: 403, headers: corsHeaders,
    });
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'CF-Pages-Proxy/1.0' },
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Falha ao buscar: ' + err.message }), {
      status: 502, headers: corsHeaders,
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
