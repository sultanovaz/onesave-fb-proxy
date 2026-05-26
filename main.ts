// OneSave Facebook CDN Proxy — Deno Deploy edition
//
// Why this exists:
//   Facebook's CDN (fbcdn.net) throttles per-source-IP. Our Supabase Edge
//   proxy (single AWS region, fixed IP pool) was getting throttled to 0
//   bytes/sec for some videos. Deno Deploy runs on Google's anycast edge
//   network — every request lands on the nearest PoP with a FRESH IP that
//   fbcdn hasn't seen before. This bypasses the per-IP throttle entirely.
//
//   Combined with yt-dlp's signature trick — using `facebookexternalhit/1.1`
//   UA which fbcdn whitelists because it's Meta's own Open Graph crawler —
//   this is the fastest possible no-cost path to fbcdn.
//
// Usage: GET https://<your-project>.deno.dev/?u=<encoded-fbcdn-url>
//
// Free tier: 100K req/day, 100 GiB egress/month, no card required.

const UA_FACEBOOK_BOT =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// Allowlist: only proxy fbcdn.net video subdomains. Prevents this from
// being used as an open proxy for arbitrary URLs.
const ALLOWED = /^https:\/\/[^/]*\.fbcdn\.net\//i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== 'GET') {
    return new Response('GET only', { status: 405, headers: CORS });
  }

  const url = new URL(req.url);
  const target = url.searchParams.get('u') || url.searchParams.get('url');
  if (!target) {
    return new Response('?u=<url> required', { status: 400, headers: CORS });
  }
  if (!ALLOWED.test(target)) {
    return new Response('only fbcdn.net allowed', { status: 403, headers: CORS });
  }

  // Pass through client Range header if present (for resume / partial fetch).
  // Default to bytes=0- so we get the full file when client didn't specify.
  const clientRange = req.headers.get('Range') ?? 'bytes=0-';

  try {
    // Don't follow redirects manually — let Deno fetch handle them.
    // Set a generous 60s timeout for the upstream connection.
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60000);
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': UA_FACEBOOK_BOT,
        Accept: '*/*',
        Range: clientRange,
      },
      signal: ac.signal,
    });
    clearTimeout(t);

    // Mirror upstream status + headers (Content-Length, Content-Range,
    // Content-Type), inject CORS. Stream the body through — no buffering.
    const h = new Headers();
    const passThroughHeaders = [
      'content-length',
      'content-range',
      'content-type',
      'accept-ranges',
      'last-modified',
      'etag',
    ];
    for (const k of passThroughHeaders) {
      const v = upstream.headers.get(k);
      if (v) h.set(k, v);
    }
    for (const [k, v] of Object.entries(CORS)) h.set(k, v as string);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: h,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`upstream error: ${msg}`, {
      status: 502,
      headers: CORS,
    });
  }
});
