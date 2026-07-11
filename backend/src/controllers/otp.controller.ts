import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { hashToken } from "../lib/hash.js";
import { sendOtpEmail } from "../lib/mailer.js";
import { generateAccessToken, generateRefreshToken } from "../lib/jwt.js";
import { setAuthCookies } from "../lib/cookies.js";
import {
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  generateOtpCode,
  hashOtpCode,
  isValidEmail,
  buildEmailUsername,
} from "../lib/otp.js";

/* REQUEST OTP */
export const requestOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      data: null,
      message: "A valid email is required",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const mostRecent = await prisma.emailOtp.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: "desc" },
    });

    if (mostRecent && Date.now() - mostRecent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return res.status(429).json({
        success: false,
        data: null,
        message: "Please wait before requesting another code",
      });
    }

    const code = generateOtpCode();

    // Invalidate any still-pending codes for this email before issuing a new one.
    await prisma.emailOtp.deleteMany({ where: { email: normalizedEmail } });

    await prisma.emailOtp.create({
      data: {
        email: normalizedEmail,
        codeHash: hashOtpCode(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await sendOtpEmail(normalizedEmail, code);

    return res.json({
      success: true,
      data: null,
      message: "Verification code sent",
    });
  } catch (error) {
    console.error("[OTP:requestOtp] EXCEPTION:", error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Failed to send verification code",
    });
  }
};

/* VERIFY OTP */
export const verifyOtp = async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!isValidEmail(email) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return res.status(400).json({
      success: false,
      data: null,
      message: "A valid email and 6-digit code are required",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const pending = await prisma.emailOtp.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: "desc" },
    });

    if (!pending) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "Invalid or expired code",
      });
    }

    if (pending.expiresAt.getTime() < Date.now()) {
      await prisma.emailOtp.delete({ where: { id: pending.id } });
      return res.status(401).json({
        success: false,
        data: null,
        message: "Code has expired, please request a new one",
      });
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.emailOtp.delete({ where: { id: pending.id } });
      return res.status(429).json({
        success: false,
        data: null,
        message: "Too many attempts, please request a new code",
      });
    }

    if (hashOtpCode(code) !== pending.codeHash) {
      await prisma.emailOtp.update({
        where: { id: pending.id },
        data: { attempts: { increment: 1 } },
      });
      return res.status(401).json({
        success: false,
        data: null,
        message: "Incorrect code",
      });
    }

    // Code is valid and single-use — remove it immediately.
    await prisma.emailOtp.delete({ where: { id: pending.id } });

    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: {
        email: normalizedEmail,
        username: buildEmailUsername(normalizedEmail),
        // Placeholder — column is NOT NULL and this account never uses password login
        // unless the user later sets one via a dedicated "set password" flow.
        password: crypto.randomBytes(32).toString("hex"),
      },
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    return res.json({
      success: true,
      data: { userId: user.id },
      message: "Verification successful",
    });
  } catch (error) {
    console.error("[OTP:verifyOtp] EXCEPTION:", error);
    return res.status(500).json({
      success: false,
      data: null,
      message: "Verification failed",
    });
  }
};
