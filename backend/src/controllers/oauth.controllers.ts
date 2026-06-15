import { Request, Response } from "express";
import { generateAccessToken, generateRefreshToken } from "../lib/jwt.js";
import { setAuthCookies } from "../lib/cookies.js";
import { hashToken } from "../lib/hash.js";
import { prisma } from "../lib/prisma.js";

export const oauthSuccess = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;

    if (!user?.id) {
      return res.status(401).json({
        success: false,
        data: null,
        message: "OAuth login failed: missing authenticated user",
      });
    }

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

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    res.redirect(`${clientUrl}/auth/callback#access=${accessToken}&refresh=${refreshToken}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth login failed";
    console.error("[OAuth] callback failed:", message);
    return res.status(500).json({
      success: false,
      data: null,
      message,
    });
  }
};
