import express from "express";
import type { NextFunction, Request, Response } from "express";
import authRoutes from "./routes/auth.routes.js"
import roomRoutes from "./routes/room.routes.js"
import aiRoutes from "./routes/ai.routes.js"
import cookieParser from "cookie-parser"
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { prisma } from "./lib/prisma.js";
import { sfuService } from "./realtime/services/sfu.service.js";

const app = express();

// Strip trailing slashes so "https://example.com/" matches "https://example.com"
function normalizeOrigin(url: string) {
  return url.trim().replace(/\/+$/, "");
}

function getAllowedOrigins() {
  const rawOrigins = [
    process.env.CLIENT_URL,
    process.env.CLIENT_URLS,
    // Always include the production Vercel URL and localhost for dev
    "https://sync-hub-olive.vercel.app",
    "http://localhost:3000",
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  return new Set(rawOrigins);
}

function isAllowedOrigin(origin: string) {
  const normalized = normalizeOrigin(origin);
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.has(normalized)) {
    return true;
  }

  // Also match by protocol + host (strips port differences, etc.)
  try {
    const url = new URL(normalized);
    return allowedOrigins.has(`${url.protocol}//${url.host}`);
  } catch {
    return false;
  }
}

// Trust reverse proxies (Render, Vercel, Nginx, etc.) so rate-limit reads real client IP.
app.set("trust proxy", 1);

// ─── CORS ────────────────────────────────────────────────
// MUST be mounted BEFORE all other middleware so OPTIONS preflight
// always gets the correct Access-Control-* headers.
app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin) {
      return callback(null, true);
    }

    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    // Reject gracefully — returning `false` sends a CORS-less response
    // instead of throwing, which would cause a 500 on OPTIONS preflight.
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Security Headers ────────────────────────────────────
// Helmet sets various HTTP headers to help protect the app
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // CSP handled by Next.js frontend
}));

// ─── Request Logging ─────────────────────────────────────
// Compact dev-friendly logs: method, url, status, response time
app.use(morgan("dev"));

// ─── Response Compression ────────────────────────────────
// Gzip/Brotli compress all responses > 1KB — reduces bandwidth
app.use(compression());

// ─── Body Parsing ────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ─── Rate Limiters ───────────────────────────────────────

// Global limiter: 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 200,                   // limit each IP to 200 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Auth limiter: strict — 10 attempts per 15 minutes (prevents brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again in 15 minutes." },
});

// AI limiter: 20 requests per minute (prevent Gemini API abuse)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "AI rate limit exceeded, please wait a moment." },
});

// Apply global limiter to all routes
app.use(globalLimiter);

// ─── Routes ──────────────────────────────────────────────
// Auth routes with strict rate limit on login/register
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/otp", authLimiter);
app.use("/auth", authRoutes);

// Room routes (creation-only rate limit is applied inside room.routes.ts,
// scoped to POST /rooms — not the whole /rooms/* surface)
app.use("/rooms", roomRoutes);

// AI routes with AI-specific limiter
app.use("/ai", aiLimiter);
app.use("/ai", aiRoutes);

// ─── Health Check ────────────────────────────────────────
// Checks DB connectivity and mediasoup worker liveness, not just process
// uptime — otherwise a dead mediasoup worker (see SFUService worker "died"
// handler) or a lost DB connection would report "ok" forever, and
// Render/Docker would never restart a container stuck in that state.
app.get("/health", async (_req, res) => {
  const checks = { database: false, sfu: sfuService.isHealthy() };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (err) {
    console.error("[Health] Database check failed:", err instanceof Error ? err.message : err);
  }

  const healthy = checks.database && checks.sfu;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    checks,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ─── Catch-all ───────────────────────────────────────────
app.use("/", (_req, res) => {
  res.send("SyncHub API v1.0");
});

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[API] Unhandled error:", message);

  return res.status(500).json({
    success: false,
    data: null,
    message: "Internal server error",
  });
});

export default app;
