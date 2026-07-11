import crypto from "crypto";

export const OTP_TTL_MS = 10 * 60_000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60_000; // 1 minute between sends

export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function buildEmailUsername(email: string) {
  const localPart = email.split("@")[0] ?? "user";
  const cleaned = localPart
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 24) || "user";

  return `${cleaned}-${crypto.randomBytes(3).toString("hex")}`;
}
