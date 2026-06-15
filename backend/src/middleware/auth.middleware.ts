import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const protect = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.accessToken;
  console.log(`[Auth:protect] ${req.method} ${req.path} — accessToken cookie: ${token ? "present" : "MISSING"}`);

  if (!token)
    return res.status(401).json({
      success: false,
      data: null,
      message: "Not authenticated",
    });

  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET!
    ) as any;

    console.log(`[Auth:protect] Token valid — userId=${decoded.userId}`);
    req.userId = decoded.userId; // 🔥 attached here
    next();
  } catch (err) {
    console.error(`[Auth:protect] Token verification FAILED:`, (err as Error).message);
    res.status(401).json({
      success: false,
      data: null,
      message: "Token expired",
    });
  }
};