# ─── SyncHub Backend ──────────────────────────────────
# Multi-stage build for smaller final image
# mediasoup requires native C++ compilation

# ── Stage 1: Build ──
FROM node:22-bookworm-slim AS builder

# Install ALL build tools mediasoup needs (including pip for invoke)
RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (Docker cache optimization)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy Prisma schema + config and generate client
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npx tsc

# ── Stage 2: Production ──
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Copy only production dependencies + built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/package.json ./

# Environment
ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:5001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
