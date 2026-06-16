"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  Clock,
  Crown,
  Loader2,
  LogOut,
  Mail,
  Save,
  Timer,
  User,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiRequest } from "@/lib/api";

/* ───────────────────────────────────────────────────────── */
/* Types                                                    */
/* ───────────────────────────────────────────────────────── */

interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  createdAt: string;
}

interface Stats {
  totalMeetings: number;
  totalDurationMs: number;
  avgDurationMs: number;
}

/* ───────────────────────────────────────────────────────── */
/* Formatters                                               */
/* ───────────────────────────────────────────────────────── */

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/* ───────────────────────────────────────────────────────── */
/* Profile Page                                             */
/* ───────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editUsername, setEditUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [userData, statsData] = await Promise.all([
          apiRequest("/auth/me", undefined, "GET"),
          apiRequest("/rooms/stats", undefined, "GET").catch(() => null),
        ]);
        const profile = userData.data ?? userData;
        setUser(profile);
        setEditUsername(profile.username);
        setStats(statsData);
      } catch {
        router.replace("/auth/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!editUsername.trim() || editUsername === user?.username) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiRequest("/auth/profile", {
        username: editUsername.trim(),
      }, "POST");
      const updated = res.data ?? res;
      setUser((prev) => (prev ? { ...prev, ...updated } : prev));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }, [editUsername, user?.username]);

  const handleLogout = async () => {
    try {
      await apiRequest("/auth/logout", {}, "POST");
    } catch {
      // Best-effort
    }
    router.replace("/auth/login");
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-brand-cyan" />
            <span className="text-sm text-text-secondary">Loading profile…</span>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();
  const hasChanged = editUsername.trim() !== user.username;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ── Profile Hero Card ── */}
        <section className="profile-hero">
          <div className="profile-hero-banner" />
          <div className="profile-hero-body">
            <div className="profile-avatar-ring">{initials}</div>
            <div className="mt-3">
              <h1 className="profile-name">{user.username}</h1>
              <p className="profile-email">{user.email}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="profile-meta-badge">
                <Calendar className="size-3" />
                Member since {formatMemberSince(user.createdAt)}
              </span>
              {stats && (
                <span className="profile-meta-badge">
                  <Video className="size-3" />
                  {stats.totalMeetings} meeting{stats.totalMeetings !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Meeting Stats ── */}
        {stats && (
          <section className="profile-section">
            <h2 className="profile-section-title">Meeting Statistics</h2>
            <div className="profile-stat-grid">
              <StatCard
                icon={Video}
                label="Total meetings"
                value={String(stats.totalMeetings)}
                iconBg="bg-signal-cyan-dim"
                iconColor="text-signal-cyan"
              />
              <StatCard
                icon={Clock}
                label="Total time"
                value={formatDuration(stats.totalDurationMs)}
                iconBg="bg-state-ai-dim"
                iconColor="text-brand-purple"
              />
              <StatCard
                icon={Timer}
                label="Avg duration"
                value={formatDuration(stats.avgDurationMs)}
                iconBg="bg-state-warning-dim"
                iconColor="text-warning"
              />
            </div>
          </section>
        )}

        {/* ── Account Details ── */}
        <section className="profile-section">
          <h2 className="profile-section-title">Account Details</h2>
          <div className="space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="profile-username" className="profile-field-label">
                <User className="mb-0.5 mr-1.5 inline size-3.5" />
                Username
              </label>
              <div className="flex gap-2">
                <input
                  id="profile-username"
                  type="text"
                  className="profile-input"
                  value={editUsername}
                  onChange={(e) => {
                    setEditUsername(e.target.value);
                    setError("");
                    setSaved(false);
                  }}
                  placeholder="Your username"
                />
                <button
                  type="button"
                  className="profile-btn shrink-0"
                  disabled={!hasChanged || saving}
                  onClick={handleSave}
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : saved ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  {saving ? "Saving…" : saved ? "Saved!" : "Save"}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-xs font-medium text-brand-red">{error}</p>
              )}
            </div>

            {/* Email (read-only) */}
            <div>
              <label htmlFor="profile-email" className="profile-field-label">
                <Mail className="mb-0.5 mr-1.5 inline size-3.5" />
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                className="profile-input"
                value={user.email}
                disabled
              />
              <p className="mt-1.5 text-xs text-text-secondary">
                Email cannot be changed at this time.
              </p>
            </div>
          </div>
        </section>

        {/* ── Quick Actions ── */}
        <section className="profile-section">
          <h2 className="profile-section-title">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="profile-btn-outline"
              onClick={() => router.push("/dashboard")}
            >
              <Crown className="size-3.5" />
              View Dashboard
            </button>
            <button
              type="button"
              className="profile-btn-danger"
              onClick={handleLogout}
            >
              <LogOut className="size-3.5" />
              Logout
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Stat Card                                                */
/* ───────────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: typeof Video;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="dash-metric-card">
      <div>
        <p className="dash-metric-label">{label}</p>
        <p className="dash-metric-value text-xl">{value}</p>
      </div>
      <div className={`dash-metric-icon ${iconBg}`}>
        <Icon className={`size-[18px] ${iconColor}`} />
      </div>
    </div>
  );
}
