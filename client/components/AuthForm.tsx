"use client";

import {
  ComponentType,
  FormEvent,
  ChangeEvent,
  useState,
  useEffect,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const v = reduceMotion ? reducedVariants : fadeSlideUp;
  const container = reduceMotion
    ? { hidden: {}, show: {} }
    : staggerContainer;

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      const messages: Record<string, string> = {
        oauth_denied: "OAuth access was denied. Please try again.",
        oauth_init_failed: "Could not connect to the OAuth provider.",
        oauth_callback_failed: "OAuth callback failed. Please try again.",
        oauth_failed: "Authentication failed. Please try again.",
      };
      setError(messages[oauthError] || "An unexpected error occurred.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

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

  const loginWithGoogle = () => {
    window.location.href = "/api/auth/google";
  };
  const loginWithDiscord = () => {
    window.location.href = "/api/auth/discord";
  };

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

          {/* OAuth buttons */}
          <motion.div variants={v} className="grid gap-2.5">
            <button
              type="button"
              onClick={loginWithGoogle}
              className="auth-oauth-button"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={loginWithDiscord}
              className="auth-oauth-button"
            >
              <DiscordIcon />
              Continue with Discord
            </button>
          </motion.div>

          {/* Divider */}
          <motion.div variants={v} className="auth-divider">
            <span className="auth-divider-text">or continue with</span>
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

/* ───────────────────────────────────────────────────────── */
/* Inline SVG icons for OAuth (no external dependencies)    */
/* ───────────────────────────────────────────────────────── */

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.78.42 3.46 1.18 4.93l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
    </svg>
  );
}
