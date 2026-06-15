"use client";

import { ComponentType, FormEvent, ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Activity, Chrome, Lock, Mail, MessageCircle, Radio, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export default function AuthForm({ type }: { type: "login" | "register" }) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

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
    window.location.href = `${API_BASE}/auth/google`;
  };

  const loginWithDiscord = () => {
    window.location.href = `${API_BASE}/auth/discord`;
  };

  return (
    <main className="sync-mesh-bg flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card/90 shadow-soft backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden min-h-[640px] overflow-hidden border-r border-border bg-secondary/45 p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="signal-grid absolute inset-0 opacity-70" />
          <div className="relative space-y-8">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-signal">
                <Radio size={22} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">SyncHub</p>
                <p className="text-xs font-semibold text-muted-foreground">Live meeting workspace</p>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight">
                Sign in where the room, notes, and next steps stay connected.
              </h1>
              <p className="max-w-md leading-7 text-muted-foreground">
                Join secure video rooms, keep shared context in the sidebar, and return to every meeting outcome from your dashboard.
              </p>
            </div>
          </div>

          <div className="relative grid gap-3">
            {[
              "E2E key exchange for private rooms",
              "Live captions and AI action items",
              "Whiteboards, reactions, recordings",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-border bg-card/75 px-4 py-3 text-sm font-semibold text-foreground backdrop-blur">
                <Activity size={16} className="text-primary" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2 text-center sm:text-left">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground shadow-signal sm:mx-0 lg:hidden">
                <Radio size={22} />
              </div>
              <h2 className="text-3xl font-bold">
                {type === "login" ? "Welcome back" : "Create your SyncHub account"}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {type === "login"
                  ? "Enter your workspace credentials to reopen your meeting dashboard."
                  : "Set up an account to start rooms, invite teammates, and keep meeting outcomes organized."}
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <AuthInput
                label="Email"
                icon={Mail}
                name="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={onChange}
              />

              {type === "register" && (
                <AuthInput
                  label="Username"
                  icon={User}
                  name="username"
                  placeholder="Choose a display name"
                  value={form.username}
                  onChange={onChange}
                />
              )}

              <AuthInput
                label="Password"
                icon={Lock}
                name="password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={onChange}
              />

              {type === "login" && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex cursor-pointer items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="size-4 rounded border-border bg-background text-primary focus:ring-2 focus:ring-ring/40"
                    />
                    Remember me
                  </label>
                  <a href="#" className="font-semibold text-primary transition-colors hover:text-primary/80">
                    Forgot password?
                  </a>
                </div>
              )}

              <Button type="submit" disabled={loading} className="h-11 w-full">
                {loading ? "Please wait..." : type === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold uppercase text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-2">
              <Button type="button" variant="outline" onClick={loginWithGoogle} className="h-11 justify-center bg-background/70">
                <Chrome size={18} />
                Continue with Google
              </Button>
              <Button type="button" variant="outline" onClick={loginWithDiscord} className="h-11 justify-center bg-background/70">
                <MessageCircle size={18} />
                Continue with Discord
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {type === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <a href="/auth/register" className="font-semibold text-primary hover:text-primary/80">
                    Sign up
                  </a>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <a href="/auth/login" className="font-semibold text-primary hover:text-primary/80">
                    Sign in
                  </a>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

type AuthInputProps = {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function AuthInput({ label, icon: Icon, name, type = "text", placeholder, value, onChange }: AuthInputProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          required
          value={value}
          onChange={onChange}
          className="h-11 w-full rounded-lg border border-input bg-background/80 pl-10 pr-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
    </div>
  );
}
