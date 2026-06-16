"use client";

import React, {
  ComponentType,
  FormEvent,
  ChangeEvent,
  useState,
  useEffect,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { apiRequest } from "@/lib/api";
import {
  ArrowRight,
  ChevronLeft,
  Lock,
  Mail,
  MessageCircle,
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
  const searchParams = useSearchParams();

  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

          {/* OAuth buttons */}
          <motion.div variants={v} className="space-y-2.5">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full justify-center"
              onClick={loginWithGoogle}
            >
              <GoogleIcon className="me-2 size-4" />
              Continue with Google
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full justify-center"
              onClick={loginWithDiscord}
            >
              <MessageCircle strokeWidth={2.5} className="me-2 size-4" />
              Continue with Discord
            </Button>
          </motion.div>

          {/* Divider */}
          <motion.div
            variants={v}
            className="relative flex items-center gap-4 py-1"
          >
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              or continue with email
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

/* ───────────────────────────────────────────────────────── */
/* Inline Google SVG icon                                    */
/* ───────────────────────────────────────────────────────── */

const GoogleIcon = (props: React.ComponentProps<"svg">) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
  </svg>
);
