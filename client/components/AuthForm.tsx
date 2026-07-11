"use client";

import {
  ComponentType,
  FormEvent,
  ChangeEvent,
  useState,
  useEffect,
  Suspense,
} from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { apiRequest } from "@/lib/api";
import {
  ArrowRight,
  Check,
  Lock,
  LockKeyhole,
  Mail,
  Shield,
  Sparkles,
  User,
  Video,
} from "lucide-react";

/* ───────────────────────────────────────────────────────── */
/* Entry point – wrapped in Suspense for useSearchParams    */
/* ───────────────────────────────────────────────────────── */

export default function AuthForm({ type }: { type: "login" | "register" }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-void">
          <div className="size-8 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
        </div>
      }
    >
      <AuthFormContent type={type} />
    </Suspense>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Motion config – pure ease-out-expo, no bounce            */
/* ───────────────────────────────────────────────────────── */

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOutExpo },
  },
};

const reducedVariants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
};

/* ───────────────────────────────────────────────────────── */
/* Core auth form                                           */
/* ───────────────────────────────────────────────────────── */

function AuthFormContent({ type }: { type: "login" | "register" }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [otpStep, setOtpStep] = useState<"idle" | "request" | "sent">("idle");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const v = reduceMotion ? reducedVariants : fadeSlideUp;
  const container = reduceMotion
    ? { hidden: {}, show: {} }
    : staggerContainer;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const onChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload =
        type === "register"
          ? form
          : { email: form.email, password: form.password };
      await apiRequest(`/auth/${type}`, payload);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp() {
    setOtpError("");
    setOtpLoading(true);
    try {
      await apiRequest("/auth/otp/request", { email: otpEmail });
      setOtpStep("sent");
      setResendCooldown(60);
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setOtpLoading(false);
    }
  }

  function onRequestOtpSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void requestOtp();
  }

  async function verifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOtpError("");
    setOtpLoading(true);
    try {
      await apiRequest("/auth/otp/verify", { email: otpEmail, code: otpCode });
      router.push("/");
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setOtpLoading(false);
    }
  }

  function resetOtp() {
    setOtpStep("idle");
    setOtpCode("");
    setOtpError("");
  }

  return (
    <main className="auth-layout">
      {/* ─── Left Panel: Brand & Social Proof ─────────── */}
      <section className="auth-proof-panel hidden lg:flex">
        <div aria-hidden className="auth-proof-noise" />

        <div className="relative space-y-10">
          {/* Animated SyncHub Logo */}
          <SyncHubAnimatedLogo />

          {/* Massive stat */}
          <div className="space-y-3 pt-4">
            <p className="auth-stat">
              14 mins saved
              <br />
              per meeting.
            </p>
            <p className="max-w-xs text-sm leading-7 text-text-secondary">
              Context stays inside the room. Summaries, action items, and
              recordings ship themselves so nobody rewatches the call.
            </p>
          </div>
        </div>

        {/* Feature rows */}
        <div className="relative space-y-0">
          <div className="mb-8">
            <AuthFeatureRow
              icon={LockKeyhole}
              label="E2E Encrypted rooms"
            />
            <AuthFeatureRow
              icon={Sparkles}
              label="AI Summaries & action items"
            />
            <AuthFeatureRow icon={Video} label="1-click local recording" />
          </div>

          {/* Trust anchors */}
          <div className="auth-trust-row">
            <Shield className="size-4" />
            <Lock className="size-4" />
            <Check className="size-4" />
          </div>
        </div>
      </section>

      {/* ─── Right Panel: Auth Form ───────────────────── */}
      <section className="auth-form-panel">
        <div aria-hidden className="auth-form-noise" />

        <motion.div
          initial="hidden"
          animate="show"
          variants={container}
          className="relative z-10 w-full max-w-md space-y-7"
        >
          {/* Mobile logo – only visible below lg */}
          <motion.div variants={v} className="lg:hidden">
            <SyncHubAnimatedLogo />
          </motion.div>

          {/* Heading */}
          <motion.div variants={v} className="space-y-2">
            <h1 className="auth-form-title">
              {type === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="auth-form-subtitle">
              {type === "login"
                ? "Enter your credentials to open your meeting dashboard."
                : "Set up an account to start rooms, invite teammates, and keep meeting outcomes organized."}
            </p>
          </motion.div>

          {/* Error banner */}
          {error && (
            <motion.div variants={v} className="auth-error">
              {error}
            </motion.div>
          )}

          {/* Email OTP */}
          <motion.div variants={v} className="grid gap-2.5">
            {otpStep === "idle" && (
              <button
                type="button"
                onClick={() => setOtpStep("request")}
                className="auth-oauth-button"
              >
                <Mail className="size-4.5" />
                Continue with email code
              </button>
            )}

            {otpStep === "request" && (
              <form onSubmit={onRequestOtpSubmit} className="space-y-3">
                <AuthInput
                  label="Email"
                  icon={Mail}
                  name="otpEmail"
                  type="email"
                  placeholder="you@company.com"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                />
                {otpError && <div className="auth-error">{otpError}</div>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="auth-submit flex-1"
                  >
                    {otpLoading ? "Sending…" : "Send code"}
                  </button>
                  <button
                    type="button"
                    onClick={resetOtp}
                    className="auth-oauth-button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {otpStep === "sent" && (
              <form onSubmit={verifyOtp} className="space-y-3">
                <p className="text-xs text-text-secondary">
                  Code sent to <span className="font-medium">{otpEmail}</span>
                </p>
                <AuthInput
                  label="6-digit code"
                  icon={Lock}
                  name="otpCode"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                {otpError && <div className="auth-error">{otpError}</div>}
                <button
                  type="submit"
                  disabled={otpLoading || otpCode.length !== 6}
                  className="auth-submit w-full"
                >
                  {otpLoading ? "Verifying…" : "Verify & continue"}
                </button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || otpLoading}
                    onClick={() => void requestOtp()}
                    className="auth-link disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={resetOtp}
                    className="text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}
          </motion.div>

          {/* Divider */}
          <motion.div variants={v} className="auth-divider">
            <span className="auth-divider-text">or use a password</span>
          </motion.div>

          {/* Form */}
          <motion.form
            variants={container}
            onSubmit={onSubmit}
            className="space-y-4"
          >
            <motion.div variants={v}>
              <AuthInput
                label="Email"
                icon={Mail}
                name="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={onChange}
              />
            </motion.div>

            {type === "register" && (
              <motion.div variants={v}>
                <AuthInput
                  label="Username"
                  icon={User}
                  name="username"
                  placeholder="Choose a display name"
                  value={form.username}
                  onChange={onChange}
                />
              </motion.div>
            )}

            <motion.div variants={v}>
              <AuthInput
                label="Password"
                icon={Lock}
                name="password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={onChange}
              />
            </motion.div>

            {type === "login" && (
              <motion.div
                variants={v}
                className="flex items-center justify-between text-sm"
              >
                <label className="flex cursor-pointer items-center gap-2 text-text-secondary transition-colors hover:text-text-primary">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="auth-checkbox"
                  />
                  <span className="text-xs">Remember me</span>
                </label>
                <a href="#" className="auth-link text-xs">
                  Forgot password?
                </a>
              </motion.div>
            )}

            <motion.div variants={v}>
              <button
                type="submit"
                disabled={loading}
                className="auth-submit"
              >
                {loading
                  ? "Please wait…"
                  : type === "login"
                    ? "Log in"
                    : "Create account"}
                {!loading && <ArrowRight className="size-4" />}
              </button>
            </motion.div>
          </motion.form>

          {/* Switch auth mode */}
          <motion.p
            variants={v}
            className="text-center text-sm text-text-secondary"
          >
            {type === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <a href="/auth/register" className="auth-link">
                  Sign up
                </a>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <a href="/auth/login" className="auth-link">
                  Sign in
                </a>
              </>
            )}
          </motion.p>
        </motion.div>
      </section>
    </main>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Animated SyncHub Logo – SVG nodes that draw on mount     */
/* ───────────────────────────────────────────────────────── */

function SyncHubAnimatedLogo() {
  const reduceMotion = useReducedMotion();

  const nodeDelay = (i: number) => (reduceMotion ? 0 : i * 0.12);
  const lineDelay = (i: number) => (reduceMotion ? 0 : 0.36 + i * 0.1);

  /* Four geometric nodes representing sync connections */
  const nodes = [
    { cx: 18, cy: 14, r: 5 },
    { cx: 42, cy: 10, r: 4.5 },
    { cx: 36, cy: 34, r: 5.5 },
    { cx: 12, cy: 38, r: 4 },
  ];

  /* Connection lines between nodes */
  const lines = [
    { x1: 18, y1: 14, x2: 42, y2: 10 },
    { x1: 42, y1: 10, x2: 36, y2: 34 },
    { x1: 36, y1: 34, x2: 12, y2: 38 },
    { x1: 12, y1: 38, x2: 18, y2: 14 },
    { x1: 18, y1: 14, x2: 36, y2: 34 },
  ];

  return (
    <div className="flex items-center gap-3.5">
      <svg
        width="52"
        height="48"
        viewBox="0 0 52 48"
        fill="none"
        className="flex-shrink-0"
      >
        {/* Connection lines */}
        {lines.map((line, i) => (
          <motion.line
            key={`line-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="var(--brand-cyan)"
            strokeWidth="1"
            strokeOpacity="0.35"
            strokeDasharray="60"
            strokeDashoffset={reduceMotion ? 0 : 60}
            animate={{ strokeDashoffset: 0 }}
            transition={{
              duration: 0.5,
              ease: easeOutExpo,
              delay: lineDelay(i),
            }}
          />
        ))}

        {/* Geometric nodes */}
        {nodes.map((node, i) => (
          <motion.circle
            key={`node-${i}`}
            cx={node.cx}
            cy={node.cy}
            r={node.r}
            fill="var(--brand-cyan)"
            fillOpacity={i === 0 ? 0.9 : 0.5 + i * 0.1}
            initial={
              reduceMotion
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.4 }
            }
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.5,
              ease: easeOutExpo,
              delay: nodeDelay(i),
            }}
          />
        ))}

        {/* Center pulse ring */}
        <motion.circle
          cx="27"
          cy="24"
          r="8"
          fill="none"
          stroke="var(--brand-cyan)"
          strokeWidth="0.8"
          strokeOpacity="0.2"
          initial={reduceMotion ? { scale: 1, opacity: 0.2 } : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.2 }}
          transition={{
            duration: 0.7,
            ease: easeOutExpo,
            delay: 0.5,
          }}
        />
      </svg>

      <div>
        <p className="text-base font-semibold tracking-wide text-text-primary">
          SyncHub
        </p>
        <p className="text-[0.68rem] font-medium tracking-widest text-text-secondary">
          SECURE ROOMS
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Auth Input                                               */
/* ───────────────────────────────────────────────────────── */

type AuthInputProps = {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function AuthInput({
  label,
  icon: Icon,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
}: AuthInputProps) {
  return (
    <div className="auth-input-wrapper">
      <label htmlFor={name} className="auth-input-label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required
        value={value}
        onChange={onChange}
        className="auth-input"
      />
      <Icon size={16} className="auth-input-icon" />
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Auth Feature Row                                         */
/* ───────────────────────────────────────────────────────── */

function AuthFeatureRow({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
}) {
  return (
    <div className="auth-feature-row">
      <span className="auth-feature-icon">
        <Icon size={14} />
      </span>
      {label}
    </div>
  );
}

