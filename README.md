<h1 align="center">SyncHub</h1>

<p align="center">
  A full-stack, real-time video conferencing platform built from scratch on native WebRTC and mediasoup —
  no third-party media SDKs.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/WebRTC-P2P%20%2B%20SFU-FF6600?logo=webrtc&logoColor=white" alt="WebRTC" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white" alt="Prisma 7" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
</p>

---

## Overview

SyncHub is a production-grade video conferencing application with full control over the media
pipeline. One-to-one calls run peer-to-peer over native WebRTC; group calls scale through a
[mediasoup](https://mediasoup.org) Selective Forwarding Unit. Signaling, chat, whiteboard sync,
and E2E key exchange all flow through a custom WebSocket server.

Because the media pipeline is owned end to end, SyncHub supports capabilities that off-the-shelf
SDKs can't:

- **End-to-end encrypted messaging** — ECDH key exchange + AES-256-GCM via the Web Crypto API
- **AI meeting intelligence** — summaries, action items, smart replies, and RAG-powered Q&A across meeting history (Google Gemini)
- **Fully local recording** — canvas-composited multi-participant recording that never touches the server, delivered to peers over `RTCDataChannel`
- **Virtual backgrounds** — real-time ML segmentation with MediaPipe, running entirely in the browser

## Features

**Calling**
- 1:1 peer-to-peer calls with STUN/TURN fallback for NAT traversal
- Group calls (10+ participants) via mediasoup SFU
- Screen sharing with live stream switching
- Adaptive quality and ICE candidate pool optimization

**Local recording and P2P transfer**
- All participant streams composited onto a single `<canvas>` grid, audio mixed via `AudioContext`, captured with `MediaRecorder` as one WebM file
- Finished recordings sent directly to peers over `RTCDataChannel` in 64 KB chunks with backpressure handling
- Zero server involvement: no upload endpoints, no cloud storage, no transcoding

**AI meeting intelligence (Gemini)**
- One-click meeting summaries with key points and decisions
- Structured action-item extraction (assignee, due date, confidence)
- Live smart-reply suggestions from the running transcript
- RAG-powered Q&A across full meeting history — transcripts are chunked, embedded, and retrieved with citations

**Security**
- JWT access/refresh token rotation in httpOnly cookies
- Google and Discord OAuth 2.0, plus email/password with bcrypt and SMTP OTP verification
- Multi-tier rate limiting (global, auth, AI, room creation) and Helmet security headers

**Collaboration**
- In-call chat with emoji picker and image sharing
- Real-time collaborative whiteboard synced over WebSocket
- Floating emoji reactions broadcast to all participants
- Live captions and full transcripts via the browser-native Web Speech API — no external transcription API

**Product**
- Analytics dashboard: meeting totals, 30-day activity charts, history, and type breakdown
- 11 call themes, dark/light mode, fully responsive UI
- Post-meeting transcript viewer at `/rooms/:id/transcript`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI, Framer Motion |
| Media | Native WebRTC (P2P), mediasoup 3 (SFU), mediasoup-client, MediaPipe Selfie Segmentation |
| Backend | Node.js, Express 5, TypeScript, `ws` WebSocket server |
| Database | PostgreSQL (Neon), Prisma 7 |
| AI | Google Gemini (`@google/generative-ai`), vector embeddings for RAG |
| Auth | JWT (access + refresh rotation), OAuth 2.0 (Google, Discord), bcrypt, Nodemailer OTP |
| Infrastructure | Docker, Docker Compose, Vercel (client), Render (backend) |

## Architecture

```
                        ┌────────────────────────────┐
                        │        Next.js Client       │
                        │  React 19 · WebRTC · Canvas │
                        └──────┬──────────────┬───────┘
                        HTTPS  │              │  WSS
                               ▼              ▼
                  ┌────────────────┐   ┌────────────────┐
                  │  Express API   │   │  WS Signaling   │
                  │  auth · rooms  │   │  P2P + SFU +    │
                  │  AI endpoints  │   │  collaboration  │
                  └───────┬────────┘   └───────┬────────┘
                          │                    │
                          ▼                    ▼
                  ┌────────────────┐   ┌────────────────┐
                  │  PostgreSQL    │   │  mediasoup SFU  │
                  │  (Prisma 7)    │   │  RTP media      │
                  └────────────────┘   └────────────────┘
```

- **1:1 calls** — SDP offers/answers and ICE candidates relayed through the WebSocket server; media flows directly between peers.
- **Group calls** — each participant produces media to the SFU and consumes every other participant's streams; the server forwards RTP without transcoding.

## Getting Started

### Prerequisites

- Node.js ≥ 22 and npm ≥ 10
- PostgreSQL — or a free [Neon](https://neon.tech) database
- Python 3 and C++ build tools (`g++`/`make`, or Visual Studio Build Tools on Windows) — required to compile mediasoup

### 1. Clone

```bash
git clone https://github.com/praveen-dhankhar/SyncHub.git
cd SyncHub
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in your values (see below)
npx prisma generate
npx prisma migrate deploy
npm run dev                 # http://localhost:5001
```

### 3. Frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev                 # http://localhost:3000
```

Open `http://localhost:3000`, create an account (or sign in with Google/Discord), and start a meeting.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (`?sslmode=require` for Neon) |
| `JWT_SECRET`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | Strong random strings for token signing |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP credentials for OTP verification emails |
| `GEMINI_API_KEY` | Google Gemini key — free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `CLIENT_URL` / `CLIENT_URLS` | Allowed frontend origin(s) for CORS and OAuth redirects |
| `PORT` | API port (default `5001`) |
| `MEDIASOUP_ANNOUNCED_ADDRESS` | Public IP/hostname clients can reach (production) |
| `MEDIASOUP_LISTEN_IP` | Interface to bind for RTP (default `0.0.0.0`) |
| `MEDIASOUP_RTC_MIN_PORT` / `MEDIASOUP_RTC_MAX_PORT` | UDP/TCP media port range (default `10000–10100`) |

### Client (`client/.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL, used by Next.js `/api/*` rewrites |
| `NEXT_PUBLIC_WS_URL` | WebSocket signaling URL used directly by the browser |

Full templates live in [`backend/.env.example`](backend/.env.example) and
[`client/.env.example`](client/.env.example).

## Docker

```bash
docker compose up --build
# Client  → http://localhost:3000
# Backend → http://localhost:5001
```

Both services use multi-stage Dockerfiles; the backend image compiles mediasoup's native worker
during build. For platform deployment (Vercel + Render), see [DEPLOYMENT.md](DEPLOYMENT.md) and
[render.yaml](render.yaml).

## API Overview

All protected routes require a valid access token (httpOnly cookie).

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/google` · `GET /auth/discord` · `POST /auth/exchange-code` · `GET /auth/me` · `GET /auth/ws-token` |
| Rooms | `POST /rooms` · `GET /rooms` · `GET /rooms/stats` · `GET /rooms/:id` · `GET /rooms/:id/transcript` · `POST /rooms/:id/join` · `POST /rooms/join/:inviteCode` · `POST /rooms/:id/leave` · `POST /rooms/:id/end` |
| AI | `POST /ai/suggest` · `POST /ai/summary` · `POST /ai/action-items` · `POST /ai/ask` |
| Health | `GET /health` |

### WebSocket Protocol

Messages are JSON: `{ type: string, ...payload }`.

| Category | Message types |
|----------|---------------|
| P2P signaling | `join-room`, `peer-joined`, `offer`, `answer`, `ice-candidate`, `peer-left` |
| SFU | `getRouterCapabilities`, `createTransport`, `connectTransport`, `produce`, `consume` |
| Collaboration | `chat-message`, `reaction`, `whiteboard-draw`, `whiteboard-clear`, `e2e-public-key` |

## Project Structure

```
.
├── backend/
│   └── src/
│       ├── ai/            # Gemini integration, embeddings, RAG
│       ├── controllers/   # Route handlers
│       ├── middleware/     # Auth, rate limiting, validation
│       ├── realtime/       # WebSocket server, WebRTC signaling, SFU services
│       ├── routes/         # auth, rooms, ai
│       └── services/       # Business logic
├── client/
│   ├── app/               # Next.js app router (auth, call, dashboard, rooms, ...)
│   ├── components/        # UI components
│   ├── hooks/             # WebRTC, recording, transcription hooks
│   └── lib/               # Client utilities, crypto, API client
├── docker-compose.yml
├── render.yaml
└── DEPLOYMENT.md
```

## Testing

```bash
cd backend
npm run typecheck   # TypeScript strict checks
npm test            # AI module tests (node --test)
```

## Contributing

1. Fork the repository and create a feature branch
2. Follow the existing TypeScript patterns and file structure
3. Test WebRTC flows in at least Chrome and Firefox
4. Open a pull request with a clear description

## License

Released under the [ISC License](LICENSE).

---

<p align="center">Built by <strong>Praveen Dhankhar</strong></p>
