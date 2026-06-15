import { Response, CookieOptions } from "express";

// Detect production by checking if the configured client URL is HTTPS.
// This is more reliable than NODE_ENV, which may not be set on all platforms.
const IS_PROD =
  process.env.NODE_ENV === "production" ||
  (process.env.CLIENT_URL || "").startsWith("https://");

/**
 * Cookie options for auth tokens.
 *
 * With the Next.js rewrite proxy, all API calls go through the same Vercel
 * domain as the frontend. This makes cookies **first-party**, so we can use
 * `sameSite: "lax"` (more secure than "none") and don't need special
 * cross-domain cookie config.
 *
 * - `secure: true`      — only sent over HTTPS in production
 * - `sameSite: "lax"`   — first-party cookies, blocks CSRF from cross-site POSTs
 * - `path: "/"`         — cookies available on all routes
 * - NO explicit `domain` — scoped to the Vercel domain automatically
 */
function getCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
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
