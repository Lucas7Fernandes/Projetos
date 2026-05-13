export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!target) {
      return new Response('{"error":"url param missing"}', { status: 400, headers: cors });
    }

    try {
      const res = await fetch(target, { headers: { 'Accept': 'application/json' } });
      const body = await res.text();
      return new Response(body, { status: res.status, headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: cors });
    }
  }
}
