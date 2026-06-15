import { Request, Response } from "express";
import crypto from "crypto";
import { generateAccessToken, generateRefreshToken } from "../lib/jwt.js";
import { setAuthCookies } from "../lib/cookies.js";
import { hashToken } from "../lib/hash.js";
import { prisma } from "../lib/prisma.js";

// ─── One-Time Auth Code Store ────────────────────────────
// Replaces the insecure URL-fragment token approach.
// Codes are random, single-use, and expire after 60 seconds.
interface PendingAuth {
  userId: string;
  createdAt: number;
}

const AUTH_CODE_TTL_MS = 60_000; // 60 seconds
const pendingAuthCodes = new Map<string, PendingAuth>();

// Cleanup expired codes every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [code, entry] of pendingAuthCodes) {
    if (now - entry.createdAt > AUTH_CODE_TTL_MS) {
      pendingAuthCodes.delete(code);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[OAuth] Cleaned ${cleaned} expired auth codes, ${pendingAuthCodes.size} remaining`);
  }
}, 5 * 60_000);

function generateAuthCode(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ─── Helpers ─────────────────────────────────────────────

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getOAuthClientRedirectBaseUrl() {
  const configuredUrl = process.env.CLIENT_URL || process.env.CLIENT_URLS?.split(",")[0];

  if (configuredUrl?.trim()) {
    return normalizeBaseUrl(configuredUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  return null;
}

// ─── OAuth Success Handler ───────────────────────────────
// Called after Passport authenticates the user.
// Generates a one-time code and redirects to the client.
export const oauthSuccess = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    console.log("[OAuth:oauthSuccess] called — user:", user?.id ?? "MISSING");

    if (!user?.id) {
      console.error("[OAuth:oauthSuccess] FAIL — req.user is missing or has no id");
      return res.status(401).json({
        success: false,
        data: null,
        message: "OAuth login failed: missing authenticated user",
      });
    }

    const clientUrl = getOAuthClientRedirectBaseUrl();
    console.log("[OAuth:oauthSuccess] clientUrl:", clientUrl);

    if (!clientUrl) {
      console.error("[OAuth:oauthSuccess] FAIL — CLIENT_URL not configured");
      return res.status(500).json({
        success: false,
        data: null,
        message: "OAuth redirect URL is not configured",
      });
    }

    // Generate a one-time auth code (replaces URL-fragment tokens)
    const code = generateAuthCode();
    pendingAuthCodes.set(code, {
      userId: user.id,
      createdAt: Date.now(),
    });

    const redirectUrl = new URL("/auth/callback", clientUrl);
    redirectUrl.searchParams.set("code", code);

    console.log(`[OAuth:oauthSuccess] Redirecting userId=${user.id} → ${redirectUrl.toString().replace(code, code.slice(0, 8) + "...")}`);
    console.log(`[OAuth:oauthSuccess] pendingAuthCodes.size = ${pendingAuthCodes.size}`);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("[OAuth:oauthSuccess] EXCEPTION:", error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "OAuth login failed",
    });
  }
};

// ─── Code Exchange Handler ───────────────────────────────
// Client sends the one-time code, receives httpOnly cookie tokens.
// This replaces the insecure `/set-tokens` endpoint.
export const exchangeCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    console.log(`[OAuth:exchangeCode] called — code=${code ? code.slice(0, 8) + "..." : "MISSING"}`);
    console.log(`[OAuth:exchangeCode] pendingAuthCodes.size = ${pendingAuthCodes.size}`);

    if (!code || typeof code !== "string") {
      console.error("[OAuth:exchangeCode] FAIL — Missing or invalid code");
      return res.status(400).json({
        success: false,
        data: null,
        message: "Missing authorization code",
      });
    }

    const pending = pendingAuthCodes.get(code);
    console.log(`[OAuth:exchangeCode] pending lookup:`, pending ? `userId=${pending.userId}` : "NOT FOUND");

    // Delete immediately — codes are single-use
    pendingAuthCodes.delete(code);

    if (!pending) {
      console.error("[OAuth:exchangeCode] FAIL — Code not found in map (expired or already used)");
      return res.status(401).json({
        success: false,
        data: null,
        message: "Invalid or expired authorization code",
      });
    }

    // Check expiry
    const ageMs = Date.now() - pending.createdAt;
    if (ageMs > AUTH_CODE_TTL_MS) {
      console.error(`[OAuth:exchangeCode] FAIL — Code expired (age=${ageMs}ms, TTL=${AUTH_CODE_TTL_MS}ms)`);
      return res.status(401).json({
        success: false,
        data: null,
        message: "Authorization code has expired",
      });
    }

    console.log(`[OAuth:exchangeCode] Code valid (age=${ageMs}ms). Generating tokens for userId=${pending.userId}`);

    const accessToken = generateAccessToken(pending.userId);
    const refreshToken = generateRefreshToken(pending.userId);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: pending.userId,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    console.log(`[OAuth:exchangeCode] RefreshToken stored in DB for userId=${pending.userId}`);

    setAuthCookies(res, accessToken, refreshToken);
    console.log(`[OAuth:exchangeCode] Cookies set. Returning success.`);

    return res.json({
      success: true,
      data: { userId: pending.userId },
      message: "Authentication successful",
    });
  } catch (error) {
    console.error("[OAuth:exchangeCode] EXCEPTION:", error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Code exchange failed",
    });
  }
};
