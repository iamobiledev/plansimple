# Load test notes

Target (from product brief): **50 concurrent users** in one session on a **500-page** set; **p95 tile latency &lt; 200ms**.

## Suggested tools
- [k6](https://k6.io) for HTTP tile/API load
- Playwright for multi-tab session smoke (not full 50)

## Tile latency probe (k6 sketch)

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,
  duration: '2m',
  thresholds: { http_req_duration: ['p(95)<200'] },
};

export default function () {
  // Replace with auth header + real tile object key
  const res = http.get(`${__ENV.API}/api/storage/object/${__ENV.TILE_KEY}`, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}` },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

## Local caveats
- Agent VM may not sustain 50 VU + 500-page tile gen; run against staging Docker host / Coolify.
- Prefetch and CDN/cache tiles at the edge for production p95.

## Session concurrency
- Realtime Yjs server is single-node friendly; Redis pub/sub enables horizontal scale.
- Measure WS fan-out separately from tile HTTP.
