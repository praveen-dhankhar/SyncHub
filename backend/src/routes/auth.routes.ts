import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import passport from "passport";
import { oauthSuccess, exchangeCode } from "../controllers/oauth.controllers.js";

const router = Router();

// ─── OAuth Error Redirect Helper ─────────────────────────
// Redirects to client login page with error parameter instead of
// returning raw JSON to the browser.
function getOAuthErrorRedirect(errorCode: string) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  return `${clientUrl.replace(/\/+$/, "")}/auth/login?error=${encodeURIComponent(errorCode)}`;
}

// ─── OAuth Callback Handler ──────────────────────────────
// Uses Passport's custom callback pattern for session-less OAuth.
function handleOAuthCallback(strategy: "google" | "discord") {
  return (req: any, res: any, next: any) => {
    console.log(`[OAuth:${strategy}] Callback hit — starting passport.authenticate`);
    passport.authenticate(strategy, { session: false }, (err: unknown, user: unknown, info: any) => {
      if (err) {
        console.error(`[OAuth:${strategy}] passport.authenticate error:`, err);
        return res.redirect(getOAuthErrorRedirect("oauth_callback_failed"));
      }

      if (!user) {
        const message = info?.message || `${strategy} authentication failed`;
        console.error(`[OAuth:${strategy}] passport.authenticate returned NO user — ${message}`);
        console.error(`[OAuth:${strategy}] info object:`, JSON.stringify(info));
        return res.redirect(getOAuthErrorRedirect("oauth_denied"));
      }

      console.log(`[OAuth:${strategy}] passport.authenticate SUCCESS — user:`, (user as any)?.id);
      req.user = user;
      return oauthSuccess(req, res).catch((e) => {
        console.error(`[OAuth:${strategy}] oauthSuccess EXCEPTION:`, e);
        return res.redirect(getOAuthErrorRedirect("oauth_failed"));
      });
    })(req, res, next);
  };
}

// ─── Standard Auth Routes ────────────────────────────────
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

// ─── Google OAuth ────────────────────────────────────────
router.get("/google", (req, res, next) => {
  passport.authenticate("google", {
    scope: ["email", "profile"],
    session: false,
  })(req, res, (err: unknown) => {
    if (err) {
      console.error("[OAuth] Google init failed:", err);
      return res.redirect(getOAuthErrorRedirect("oauth_init_failed"));
    }
    next();
  });
});

router.get("/google/callback", handleOAuthCallback("google"));

// ─── Discord OAuth ───────────────────────────────────────
router.get("/discord", (req, res, next) => {
  passport.authenticate("discord", {
    session: false,
  })(req, res, (err: unknown) => {
    if (err) {
      console.error("[OAuth] Discord init failed:", err);
      return res.redirect(getOAuthErrorRedirect("oauth_init_failed"));
    }
    next();
  });
});

router.get("/discord/callback", handleOAuthCallback("discord"));

// ─── Auth Code Exchange (secure OAuth token delivery) ────
// Replaces the old `/set-tokens` endpoint.
// Client sends the one-time code from the OAuth redirect,
// receives httpOnly cookie tokens in response.
router.post("/exchange-code", exchangeCode);

// ─── Protected Routes ────────────────────────────────────
router.get("/me", protect, async (req, res) => {
  try {
    console.log(`[Auth:/me] called — userId=${req.userId}`);
    const user = await import("../lib/prisma.js").then(m => m.prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, email: true, avatar: true, createdAt: true },
    }));

    if (!user) {
      console.error(`[Auth:/me] User not found in DB for userId=${req.userId}`);
      return res.status(404).json({
        success: false,
        data: null,
        message: "User not found",
      });
    }

    console.log(`[Auth:/me] SUCCESS — returning user ${user.email}`);
    return res.json({
      success: true,
      data: user,
      message: "User found",
    });
  } catch (error) {
    console.error(`[Auth:/me] EXCEPTION:`, error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Failed to fetch user",
    });
  }
});

// Returns the access token so the client can use it for WebSocket auth
// (cookies are httpOnly and can't be read by JS for cross-origin WS)
router.get("/ws-token", protect, (req, res) => {
  console.log(`[Auth:/ws-token] called — userId=${req.userId}`);
  const token = req.cookies.accessToken;
  res.json({ token });
});

export default router;
