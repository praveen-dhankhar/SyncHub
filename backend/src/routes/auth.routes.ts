import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import passport from "passport";
import { oauthSuccess } from "../controllers/oauth.controllers.js";

const router = Router();

function handleOAuthCallback(strategy: "google" | "discord") {
  return (req: any, res: any, next: any) => {
    passport.authenticate(strategy, { session: false }, (err: unknown, user: unknown, info: any) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        const message = info?.message || `${strategy} authentication failed`;
        return res.status(401).json({
          success: false,
          data: null,
          message,
        });
      }

      req.user = user;
      return oauthSuccess(req, res).catch(next);
    })(req, res, next);
  };
}

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
// GOOGLE
router.get(
  "/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/google/callback",
  handleOAuthCallback("google")
);

// DISCORD
router.get(
  "/discord",
  passport.authenticate("discord")
);

router.get(
  "/discord/callback",
  handleOAuthCallback("discord")
);


router.get("/me", protect, (req, res) => {
  res.json({ userId: req.userId });
});

// Returns the access token so the client can use it for WebSocket auth
// (cookies are httpOnly and can't be read by JS for cross-origin WS)
router.get("/ws-token", protect, (req, res) => {
  const token = req.cookies.accessToken;
  res.json({ token });
});

// Cross-origin OAuth token bridge: client sends tokens received via URL fragment,
// backend sets them as httpOnly cookies for the client domain
import { setAuthCookies } from "../lib/cookies.js";
router.post("/set-tokens", (req, res) => {
  const { accessToken, refreshToken } = req.body;
  if (!accessToken || !refreshToken) {
    return res.status(400).json({ message: "Missing tokens" });
  }
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ success: true });
});

export default router;
