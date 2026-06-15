import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // ─── API Proxy ────────────────────────────────────────────
  // Proxy all /api/* requests through Vercel to the Render backend.
  // This makes cookies first-party (same domain as the frontend),
  // bypassing third-party cookie blocking in modern browsers.
  //
  // Browser: sync-hub-olive.vercel.app/api/auth/me
  //       → Vercel rewrites to: <RENDER_BACKEND>/auth/me
  //
  // Cookies are set on sync-hub-olive.vercel.app (first-party), not onrender.com.
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
