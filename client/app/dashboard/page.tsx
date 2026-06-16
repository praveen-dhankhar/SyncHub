"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Brain,
  Calendar,
  Clock,
  Crown,
  Phone,
  Timer,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "@/lib/api";

/* ───────────────────────────────────────────────────────── */
/* Types                                                    */
/* ───────────────────────────────────────────────────────── */

interface MeetingRecord {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  endedAt: string | null;
  isActive: boolean;
  durationMs: number;
  participantCount: number;
  hostName: string;
  isHost: boolean;
}

interface Stats {
  totalMeetings: number;
  totalDurationMs: number;
  avgDurationMs: number;
  meetingsByType: Record<string, number>;
  recentMeetings: MeetingRecord[];
  dailyActivity: { date: string; count: number }[];
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ───────────────────────────────────────────────────────── */
/* Ease-out-expo count-up hook                              */
/* ───────────────────────────────────────────────────────── */

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (target === 0) return;
    startedRef.current = true;

    let startTime: number;
    let rafId: number;

    function tick(now: number) {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = easeOutExpo(progress);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return value;
}

/* ───────────────────────────────────────────────────────── */
/* Dashboard Page                                           */
/* ───────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest("/rooms/stats", undefined, "GET");
        setStats(data);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "";
        if (
          message.includes("Unauthorized") ||
          message.includes("No token")
        ) {
          router.replace("/auth/login");
          return;
        }
        console.error("Failed to fetch stats:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const activityData = useMemo(
    () =>
      (stats?.dailyActivity ?? []).map((day) => ({
        ...day,
        label: day.date.slice(5),
      })),
    [stats?.dailyActivity],
  );

  const hostedCount = useMemo(
    () => stats?.recentMeetings.filter((m) => m.isHost).length ?? 0,
    [stats?.recentMeetings],
  );

  /* ─── Loading ────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="dash-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-brand-cyan border-t-transparent" />
          <span className="dash-subtitle">Loading analytics…</span>
        </div>
      </div>
    );
  }

  /* ─── Render ─────────────────────────────────────────── */

  return (
    <div className="dash-page">
      {/* Header */}
      <header className="dash-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="dash-back-btn"
              onClick={() => router.push("/")}
              aria-label="Back to home"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <h1 className="dash-title">Meeting Analytics</h1>
              <p className="dash-subtitle">
                Room activity, meeting mix, and recent outcomes
              </p>
            </div>
          </div>
          <button
            type="button"
            className="dash-ask-btn"
            onClick={() => router.push("/dashboard/ask")}
          >
            <Brain className="size-4" />
            <span className="hidden sm:inline">Ask SyncHub</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6 lg:px-8">
        {/* ── Metric Cards ────────────────────────────── */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total meetings"
            value={stats?.totalMeetings ?? 0}
            icon={Video}
            iconBg="bg-signal-cyan-dim"
            iconColor="text-signal-cyan"
          />
          <MetricCard
            label="Total time"
            value={stats?.totalDurationMs ?? 0}
            icon={Clock}
            iconBg="bg-state-ai-dim"
            iconColor="text-brand-purple"
            formatter={formatDuration}
          />
          <MetricCard
            label="Avg duration"
            value={stats?.avgDurationMs ?? 0}
            icon={Timer}
            iconBg="bg-state-warning-dim"
            iconColor="text-warning"
            formatter={formatDuration}
          />
          <MetricCard
            label="Meetings hosted"
            value={hostedCount}
            icon={Crown}
            iconBg="bg-state-success-dim"
            iconColor="text-success"
          />
        </section>

        {/* ── Charts ──────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.54fr]">
          {/* Activity Chart (65%) */}
          <div className="dash-chart-panel">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="size-4 text-signal-cyan" />
                <div>
                  <h2 className="dash-chart-title">Meeting Activity</h2>
                  <p className="dash-chart-desc">
                    Daily room starts · last 30 days
                  </p>
                </div>
              </div>
              <span className="dash-chart-badge">30d</span>
            </div>

            {stats && stats.totalMeetings > 0 ? (
              <ActivityChart data={activityData} />
            ) : (
              <div className="flex h-56 flex-col items-center justify-center text-center">
                <BarChart3 className="mb-3 size-9 text-text-secondary opacity-30" />
                <p className="dash-chart-desc">
                  No meeting activity in the last 30 days
                </p>
              </div>
            )}
          </div>

          {/* Meeting Mix (35%) */}
          <div className="dash-chart-panel">
            <div className="mb-6 flex items-center gap-2.5">
              <Users className="size-4 text-brand-purple" />
              <h2 className="dash-chart-title">Meeting Mix</h2>
            </div>
            <MeetingMix
              meetingsByType={stats?.meetingsByType ?? {}}
              total={stats?.totalMeetings ?? 0}
            />
          </div>
        </section>

        {/* ── Recent Meetings ─────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-elevated">
          <div className="flex items-center gap-2.5 border-b border-border-subtle px-6 py-4">
            <Calendar className="size-4 text-signal-cyan" />
            <h2 className="dash-chart-title">Recent Meetings</h2>
          </div>

          {/* Column headers */}
          <div className="dash-table-header">
            <span />
            <span>Room</span>
            <span>Date</span>
            <span>Participants</span>
            <span>Duration</span>
            <span />
          </div>

          {/* Rows */}
          <div>
            {stats?.recentMeetings.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                onJoin={(id, type) =>
                  router.push(
                    type === "GROUP" ? `/group/${id}` : `/call/${id}`,
                  )
                }
              />
            ))}
            {(!stats?.recentMeetings ||
              stats.recentMeetings.length === 0) && (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <Video className="mb-3 size-10 text-text-secondary opacity-25" />
                <p className="text-sm text-text-secondary">
                  No meetings yet. Start a room to see your history here.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Metric Card with count-up                                */
/* ───────────────────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  formatter,
}: {
  label: string;
  value: number;
  icon: typeof Video;
  iconBg: string;
  iconColor: string;
  formatter?: (ms: number) => string;
}) {
  const animated = useCountUp(value);
  const display = formatter ? formatter(animated) : String(animated);

  return (
    <div className="dash-metric-card">
      <div>
        <p className="dash-metric-label">{label}</p>
        <p className="dash-metric-value">{display}</p>
      </div>
      <div className={`dash-metric-icon ${iconBg}`}>
        <Icon className={`size-[18px] ${iconColor}`} />
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Activity Bar Chart                                       */
/* ───────────────────────────────────────────────────────── */

function ActivityChart({
  data,
}: {
  data: { date: string; label: string; count: number }[];
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
          onMouseMove={(state) => {
            if (state?.activeTooltipIndex != null) {
              setActiveIdx(Number(state.activeTooltipIndex));
            }
          }}
          onMouseLeave={() => setActiveIdx(null)}
        >
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="4 6"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={activeIdx !== null ? { fill: "var(--text-secondary)", fontSize: 10 } : false}
            tickLine={false}
            axisLine={false}
            minTickGap={20}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "var(--row-alt)" }}
            content={<DashTooltip />}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill="var(--signal-cyan)"
                fillOpacity={activeIdx === i ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Tooltip                                                  */
/* ───────────────────────────────────────────────────────── */

function DashTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const count = Number(payload[0].value ?? 0);
  return (
    <div className="dash-tooltip">
      <p className="dash-tooltip-label">{label}</p>
      <p className="dash-tooltip-value">
        {count} {count === 1 ? "meeting" : "meetings"}
      </p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Meeting Mix                                              */
/* ───────────────────────────────────────────────────────── */

const mixLabels: Record<string, string> = {
  ONE_TO_ONE: "1:1 calls",
  GROUP: "Group calls",
  VIRTUAL_ROOM: "Virtual rooms",
};

const mixColors: Record<string, string> = {
  ONE_TO_ONE: "var(--chart-1)",
  GROUP: "var(--chart-3)",
  VIRTUAL_ROOM: "var(--chart-4)",
};

function MeetingMix({
  meetingsByType,
  total,
}: {
  meetingsByType: Record<string, number>;
  total: number;
}) {
  const entries = Object.entries(meetingsByType);

  if (entries.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-secondary">
        No meetings yet
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {entries.map(([type, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={type}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="dash-mix-label">
                {mixLabels[type] || type}
              </span>
              <span className="dash-mix-value">
                {count} ({pct}%)
              </span>
            </div>
            <div className="dash-mix-track">
              <div
                className="dash-mix-fill"
                style={{
                  width: `${pct}%`,
                  background: mixColors[type] || "var(--chart-1)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Meeting Table Row                                        */
/* ───────────────────────────────────────────────────────── */

function MeetingRow({
  meeting,
  onJoin,
}: {
  meeting: MeetingRecord;
  onJoin: (id: string, type: string) => void;
}) {
  const iconBg =
    meeting.type === "ONE_TO_ONE"
      ? "bg-signal-cyan-dim"
      : "bg-state-ai-dim";
  const iconColor =
    meeting.type === "ONE_TO_ONE"
      ? "text-signal-cyan"
      : "text-brand-purple";

  return (
    <div className="dash-table-row">
      {/* Icon */}
      <div className={`dash-table-icon ${iconBg}`}>
        {meeting.type === "ONE_TO_ONE" ? (
          <Phone className={`size-3.5 ${iconColor}`} />
        ) : (
          <Users className={`size-3.5 ${iconColor}`} />
        )}
      </div>

      {/* Name */}
      <span className="dash-table-name">{meeting.name || "Meeting"}</span>

      {/* Date */}
      <span className="dash-table-cell">{formatDate(meeting.createdAt)}</span>

      {/* Participants */}
      <span className="dash-table-mono">{meeting.participantCount}</span>

      {/* Duration / Status badges */}
      <span className="flex items-center gap-2">
        {meeting.isHost && (
          <span className="dash-badge-host">HOST</span>
        )}
        {meeting.isActive ? (
          <span className="dash-badge-live">
            <span className="dash-badge-live-dot" />
            LIVE
          </span>
        ) : (
          <span className="dash-table-mono">
            {formatDuration(meeting.durationMs)}
          </span>
        )}
      </span>

      {/* Join */}
      <span className="text-right">
        {meeting.isActive && (
          <button
            type="button"
            className="dash-join-btn"
            onClick={() => onJoin(meeting.id, meeting.type)}
          >
            Join
          </button>
        )}
      </span>
    </div>
  );
}
