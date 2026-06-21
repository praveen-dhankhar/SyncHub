import type { NextConfig } from "next";

function normalizeBackendUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

const nextConfig: NextConfig = {
  output: "standalone",

  // ─── API Proxy ────────────────────────────────────────────
  // Proxy all /api/* requests through Vercel to the Render backend.
  // This makes cookies first-party (same domain as the frontend),
  // bypassing third-party cookie blocking in modern browsers.
  //
  // Vercel env: NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com
  // Browser:    https://<vercel-app>/api/auth/me
  // Rewrites:   https://<render-service>.onrender.com/auth/me
  async rewrites() {
    const backendUrl = normalizeBackendUrl(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001");
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
