import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
} from "../controllers/auth.controller.js";
import { requestOtp, verifyOtp } from "../controllers/otp.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

// ─── Standard Auth Routes ────────────────────────────────
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

// ─── Email OTP Verification ──────────────────────────────
// Passwordless login: request a 6-digit code emailed to the user,
// then verify it to receive httpOnly cookie tokens. Auto-creates
// the account on first verification for a given email.
router.post("/otp/request", requestOtp);
router.post("/otp/verify", verifyOtp);

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

// ─── Profile Update ──────────────────────────────────────
router.post("/profile", protect, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== "string" || username.trim().length < 2) {
      return res.status(400).json({
        success: false,
        data: null,
        message: "Username must be at least 2 characters",
      });
    }

    const { prisma } = await import("../lib/prisma.js");

    // Check uniqueness
    const existing = await prisma.user.findUnique({
      where: { username: username.trim() },
    });

    if (existing && existing.id !== req.userId) {
      return res.status(409).json({
        success: false,
        data: null,
        message: "Username is already taken",
      });
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { username: username.trim() },
      select: { id: true, username: true, email: true, avatar: true, createdAt: true },
    });

    return res.json({
      success: true,
      data: updated,
      message: "Profile updated",
    });
  } catch (error) {
    console.error(`[Auth:/profile] EXCEPTION:`, error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Failed to update profile",
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

