const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

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
    credentials: "include", // 🔴 REQUIRED for cookies
    body: method === "GET" ? undefined : JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Request failed");
  }

  return res.json();
}
