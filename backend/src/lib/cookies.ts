import { Response, CookieOptions } from "express";

// Detect production by checking if the configured client URL is HTTPS.
// This is more reliable than NODE_ENV, which may not be set on all platforms.
const IS_PROD =
  process.env.NODE_ENV === "production" ||
  (process.env.CLIENT_URL || "").startsWith("https://");

/**
 * Cookie options for cross-domain auth (Render backend ↔ Vercel frontend).
 *
 * - `secure: true`      — required for sameSite "none"; always true in prod
 * - `sameSite: "none"`  — required for cross-origin cookie delivery
 * - `path: "/"`         — cookies available on all routes
 * - NO explicit `domain` — let the browser scope it to the backend origin
 */
function getCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
    path: "/",
    maxAge,
  };
}

export const COOKIE_OPTIONS = {
  accessToken: getCookieOptions(15 * 60 * 1000),       // 15 minutes
  refreshToken: getCookieOptions(7 * 24 * 60 * 60 * 1000), // 7 days
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
) => {
  res.cookie("accessToken", accessToken, COOKIE_OPTIONS.accessToken);
  res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS.refreshToken);
};
