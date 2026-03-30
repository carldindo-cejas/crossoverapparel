# Realtime Worker Setup

This project uses a dedicated Cloudflare Worker + Durable Object for low-latency realtime updates.

## Files

- `workers/realtime-worker.ts`: Durable Object websocket hub + publish endpoint
- `wrangler.realtime.toml`: deployment config for realtime worker

## Deploy

1. Deploy realtime worker:
   - `wrangler deploy -c wrangler.realtime.toml`
2. Copy worker URL (example):
   - `https://crossover-apparel-realtime.<subdomain>.workers.dev`
3. Configure app worker (`wrangler.toml`):
   - `REALTIME_API_URL` = realtime worker base URL
   - `REALTIME_API_TOKEN` = same token as realtime worker
4. Configure browser websocket URL (`.env.local`):
   - `NEXT_PUBLIC_REALTIME_WS_URL=wss://.../ws`

## Endpoints

- `GET /health`
- `POST /publish` (internal token protected)
- `GET /ws?role=<admin|designer|staff>&userId=<optional>` websocket upgrade
