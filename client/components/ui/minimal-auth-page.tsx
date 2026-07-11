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
import { Button } from "@/components/ui/button";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { apiRequest } from "@/lib/api";
import {
  ArrowRight,
  ChevronLeft,
  Lock,
  Mail,
  Radar,
  User,
} from "lucide-react";

/* ───────────────────────────────────────────────────────── */
/* Entry point                                               */
/* ───────────────────────────────────────────────────────── */

export default function MinimalAuthPage({
  type,
}: {
  type: "login" | "register";
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <MinimalAuthContent type={type} />
    </Suspense>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Motion config                                             */
/* ───────────────────────────────────────────────────────── */

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOutExpo },
  },
};

const reducedVariants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
};

/* ───────────────────────────────────────────────────────── */
/* Core auth content                                         */
/* ───────────────────────────────────────────────────────── */

function MinimalAuthContent({ type }: { type: "login" | "register" }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="relative md:h-screen md:overflow-hidden w-full">
      {/* Unified background — matches landing page */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-void" />
        <DottedSurface className="!fixed opacity-60" style={{ zIndex: 1 }} />
        <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ zIndex: 2 }}>
          <div className="landing-noise absolute inset-0" />
          <div className="landing-orb landing-orb-cyan" />
          <div className="landing-orb landing-orb-purple" />
        </div>
      </div>

      {/* Content */}
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4">
        {/* Back to Home */}
        <Button
          variant="ghost"
          className="absolute top-4 left-4 text-muted-foreground"
          asChild
        >
          <a href="/">
            <ChevronLeft className="me-1 size-4" />
            Home
          </a>
        </Button>

        {/* Auth Card */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={container}
          className="mx-auto w-full space-y-5 sm:w-sm"
        >
          {/* Logo */}
          <motion.div variants={v} className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-signal">
              <Radar className="size-[18px]" />
            </div>
            <p className="text-xl font-semibold tracking-tight">SyncHub</p>
          </motion.div>

          {/* Heading */}
          <motion.div variants={v} className="flex flex-col space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">
              {type === "login"
                ? "Welcome back"
                : "Sign up or join now!"}
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              {type === "login"
                ? "Enter your credentials to open your meeting dashboard."
                : "Create your SyncHub account for secure rooms, live AI, and meeting outcomes."}
            </p>
          </motion.div>

          {/* Error banner */}
          {error && (
            <motion.div
              variants={v}
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              {error}
            </motion.div>
          )}

          {/* Email OTP */}
          <motion.div variants={v} className="space-y-2.5">
            {otpStep === "idle" && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full justify-center"
                onClick={() => setOtpStep("request")}
              >
                <Mail className="me-2 size-4" />
                Continue with email code
              </Button>
            )}

            {otpStep === "request" && (
              <form onSubmit={onRequestOtpSubmit} className="space-y-2.5">
                <MinimalInput
                  label="Email"
                  icon={Mail}
                  name="otpEmail"
                  type="email"
                  placeholder="you@company.com"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                />
                {otpError && (
                  <p className="text-xs font-medium text-destructive">{otpError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={otpLoading}
                    className="flex-1 justify-center"
                  >
                    {otpLoading ? "Sending…" : "Send code"}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="ghost"
                    onClick={resetOtp}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {otpStep === "sent" && (
              <form onSubmit={verifyOtp} className="space-y-2.5">
                <p className="text-xs text-muted-foreground">
                  Code sent to <span className="font-medium text-foreground">{otpEmail}</span>
                </p>
                <MinimalInput
                  label="6-digit code"
                  icon={Lock}
                  name="otpCode"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                {otpError && (
                  <p className="text-xs font-medium text-destructive">{otpError}</p>
                )}
                <Button
                  type="submit"
                  size="lg"
                  disabled={otpLoading || otpCode.length !== 6}
                  className="w-full justify-center"
                >
                  {otpLoading ? "Verifying…" : "Verify & continue"}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || otpLoading}
                    onClick={() => void requestOtp()}
                    className="font-medium text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={resetOtp}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}
          </motion.div>

          {/* Divider */}
          <motion.div
            variants={v}
            className="relative flex items-center gap-4 py-1"
          >
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              or use a password
            </span>
            <div className="h-px flex-1 bg-border" />
          </motion.div>

          {/* Email + Password Form */}
          <motion.form
            variants={container}
            onSubmit={onSubmit}
            className="space-y-3.5"
          >
            <motion.div variants={v}>
              <MinimalInput
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
                <MinimalInput
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
              <MinimalInput
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
                className="flex items-center justify-end"
              >
                <a
                  href="#"
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </a>
              </motion.div>
            )}

            <motion.div variants={v}>
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full justify-center"
              >
                {loading
                  ? "Please wait…"
                  : type === "login"
                    ? "Log in"
                    : "Create account"}
                {!loading && <ArrowRight className="ml-1.5 size-4" />}
              </Button>
            </motion.div>
          </motion.form>

          {/* Switch mode */}
          <motion.p
            variants={v}
            className="text-center text-sm text-muted-foreground"
          >
            {type === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <a
                  href="/auth/register"
                  className="font-semibold text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
                >
                  Sign up
                </a>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <a
                  href="/auth/login"
                  className="font-semibold text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
                >
                  Sign in
                </a>
              </>
            )}
          </motion.p>

          {/* Legal */}
          <motion.p
            variants={v}
            className="text-muted-foreground mt-6 text-xs leading-relaxed"
          >
            By clicking continue, you agree to our{" "}
            <a
              href="#"
              className="hover:text-primary underline underline-offset-4 transition-colors"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="hover:text-primary underline underline-offset-4 transition-colors"
            >
              Privacy Policy
            </a>
            .
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Minimal input with floating label + icon                  */
/* ───────────────────────────────────────────────────────── */

type MinimalInputProps = {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function MinimalInput({
  label,
  icon: Icon,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
}: MinimalInputProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <Icon
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          required
          value={value}
          onChange={onChange}
          className="h-11 w-full rounded-lg border border-input bg-background/80 pl-10 pr-3 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
        />
      </div>
    </div>
  );
}
