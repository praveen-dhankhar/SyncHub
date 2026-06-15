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
    passport.authenticate(strategy, { session: false }, (err: unknown, user: unknown, info: any) => {
      if (err) {
        console.error(`[OAuth] ${strategy} callback error:`, err);
        return res.redirect(getOAuthErrorRedirect("oauth_callback_failed"));
      }

      if (!user) {
        const message = info?.message || `${strategy} authentication failed`;
        console.warn(`[OAuth] ${strategy} callback: no user — ${message}`);
        return res.redirect(getOAuthErrorRedirect("oauth_denied"));
      }

      req.user = user;
      return oauthSuccess(req, res).catch((e) => {
        console.error(`[OAuth] ${strategy} oauthSuccess error:`, e);
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
router.get("/me", protect, (req, res) => {
  res.json({ userId: req.userId });
});

// Returns the access token so the client can use it for WebSocket auth
// (cookies are httpOnly and can't be read by JS for cross-origin WS)
router.get("/ws-token", protect, (req, res) => {
  const token = req.cookies.accessToken;
  res.json({ token });
});

export default router;
