# OneSave FB Proxy

Tiny Deno Deploy proxy for Facebook CDN. Used by [OneSave](https://github.com/sultanovaz/onesave) to bypass fbcdn's per-IP throttling.

## Why

fbcdn throttles per-source-IP. Single-region Supabase Edge gets throttled to 0 bytes/sec for some videos. Deno Deploy's anycast network gives a fresh IP per request, bypassing the throttle.

Combined with yt-dlp's signature `facebookexternalhit/1.1` UA (which Meta whitelists because it's their own OG crawler), this is the fastest no-cost path to fbcdn.

## Deploy

1. Visit [dash.deno.com](https://dash.deno.com)
2. "Continue with GitHub" → authorize
3. "New Project" → select this repo (`onesave-fb-proxy`)
4. Entrypoint: `main.ts`
5. Deploy

You'll get a URL like `https://onesave-fb-proxy.<your-username>.deno.dev`.

## Free tier
- 100K req/day
- 100 GiB egress/month
- No card required

## Usage

```
GET https://your-project.deno.dev/?u=<encoded-fbcdn-url>
```

Only `*.fbcdn.net` URLs allowed (allowlist). Passes through Range headers for resume / partial fetch.
