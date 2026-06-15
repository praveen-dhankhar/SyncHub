// ─── API Client ──────────────────────────────────────────
// All API requests go through the Next.js rewrite proxy at /api/*
// which forwards to the Render backend. This makes cookies first-party
// (same domain as the frontend), avoiding third-party cookie blocking.
//
// In production:  /api/auth/me → sync-hub-olive.vercel.app/api/auth/me → <render>/auth/me
// In local dev:   /api/auth/me → localhost:3000/api/auth/me → localhost:5001/auth/me

const API_BASE = "/api";

export async function apiRequest(
  endpoint: string,
  data?: unknown,
  method: "POST" | "GET" = "POST"
) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // cookies are now first-party, but keep this for safety
    body: method === "GET" ? undefined : JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Request failed");
  }

  return res.json();
}
