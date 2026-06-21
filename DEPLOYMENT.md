# SyncHub Deployment: Vercel + Render

This repo is prepared for the current split deployment:

- `client/`: Next.js app deployed on Vercel
- `backend/`: Express API, WebSocket signaling, and mediasoup worker deployed on Render

## Vercel Client

Set the Vercel project root directory to `client`.

Required Vercel environment variables:

```bash
NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com
NEXT_PUBLIC_WS_URL=wss://<your-render-service>.onrender.com
```

`NEXT_PUBLIC_API_URL` is used by the Next.js `/api/*` rewrite. `NEXT_PUBLIC_WS_URL` is used directly by the browser for websocket signaling, so it must be the public Render URL with `wss://`.

Build command:

```bash
npm run build
```

Output is handled by Vercel's Next.js integration.

## Render Backend

The backend is configured as a Render Docker web service via `render.yaml`.

Render should use:

```bash
Docker context: ./backend
Dockerfile path: ./backend/Dockerfile
Health check path: /health
```

Required Render environment variables:

```bash
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=postgresql://...

ACCESS_TOKEN_SECRET=<strong-random-secret>
REFRESH_TOKEN_SECRET=<strong-random-secret>
JWT_SECRET=<strong-random-secret>

CLIENT_URL=https://<your-vercel-app>.vercel.app
CLIENT_URLS=https://<your-vercel-app>.vercel.app

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://<your-render-service>.onrender.com/auth/google/callback

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_CALLBACK_URL=https://<your-render-service>.onrender.com/auth/discord/callback

GEMINI_API_KEY=...
```

Render sets `PORT` automatically. The server binds to `0.0.0.0:$PORT`.

## WebSocket Check

After deploy:

1. Open the Vercel app.
2. Sign in.
3. Confirm `GET /api/auth/ws-token` succeeds in the browser network panel.
4. Confirm the browser opens `wss://<your-render-service>.onrender.com/?token=...` with status `101 Switching Protocols`.

## Important Group-Call Note

Render Web Services expose one public HTTP port for the app. That supports the API and WebSocket signaling path.

The mediasoup SFU also needs public RTP ports for group-call media. This repo keeps the mediasoup env vars documented:

```bash
MEDIASOUP_ANNOUNCED_ADDRESS=<your-render-hostname>
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_RTC_MIN_PORT=10000
MEDIASOUP_RTC_MAX_PORT=10100
```

If signaling connects but group-call remote video stays blank on Render, the likely cause is that the SFU media ports are not publicly reachable from browsers. The 1:1 P2P flow can still work through STUN/TURN because it does not depend on public mediasoup RTP ports.

## Verification Commands

Backend:

```bash
cd backend
npm ci
npm run build
npm start
```

Client:

```bash
cd client
npm ci
npm run build
```

Health endpoint:

```bash
curl https://<your-render-service>.onrender.com/health
```
