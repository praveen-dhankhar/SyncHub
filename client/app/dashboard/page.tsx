"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
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
import { Button } from "@/components/ui/button";

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
                if (message.includes("Unauthorized") || message.includes("No token")) {
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
                fill: day.count > 0 ? "var(--chart-1)" : "var(--muted)",
            })),
        [stats?.dailyActivity],
    );

    if (loading) {
        return (
            <div className="sync-mesh-bg flex min-h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/85 px-8 py-7 shadow-soft backdrop-blur">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <span className="text-sm font-medium text-muted-foreground">Loading analytics...</span>
                </div>
            </div>
        );
    }

    const statCards = [
        {
            label: "Total meetings",
            value: stats?.totalMeetings ?? 0,
            icon: Video,
            color: "text-primary",
            bgColor: "bg-primary/10",
        },
        {
            label: "Total time",
            value: formatDuration(stats?.totalDurationMs ?? 0),
            icon: Clock,
            color: "text-ai",
            bgColor: "bg-ai/10",
        },
        {
            label: "Avg duration",
            value: formatDuration(stats?.avgDurationMs ?? 0),
            icon: Timer,
            color: "text-warning",
            bgColor: "bg-warning/10",
        },
        {
            label: "Hosted by you",
            value: stats?.recentMeetings.filter((m) => m.isHost).length ?? 0,
            icon: Crown,
            color: "text-success",
            bgColor: "bg-success/10",
        },
    ];

    return (
        <div className="sync-mesh-bg min-h-screen">
            <header className="sticky top-0 z-50 border-b border-border bg-background/75 backdrop-blur-2xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/")} aria-label="Back to home">
                            <ArrowLeft size={20} />
                        </Button>
                        <div>
                            <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
                                <BarChart3 className="text-primary" size={24} />
                                Meeting Analytics
                            </h1>
                            <p className="text-sm text-muted-foreground">Room activity, meeting mix, and recent outcomes</p>
                        </div>
                    </div>
                    <Button onClick={() => router.push("/dashboard/ask")}>
                        <Brain size={16} />
                        Ask SyncHub
                    </Button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {statCards.map((card) => (
                        <div key={card.label} className="relative overflow-hidden rounded-2xl border border-border bg-card/90 p-5 shadow-soft backdrop-blur transition-transform duration-200 hover:-translate-y-0.5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-muted-foreground">{card.label}</p>
                                    <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p>
                                </div>
                                <div className={`rounded-xl p-2.5 ${card.bgColor}`}>
                                    <card.icon size={20} className={card.color} />
                                </div>
                            </div>
                        </div>
                    ))}
                </section>

                <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-soft backdrop-blur lg:col-span-2">
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <div>
                                <h2 className="flex items-center gap-2 font-bold text-foreground">
                                    <TrendingUp size={18} className="text-primary" />
                                    Meeting Activity
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">Daily room starts over the last 30 days</p>
                            </div>
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">30 days</span>
                        </div>

                        {stats && stats.totalMeetings > 0 ? (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={activityData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                        <CartesianGrid stroke="var(--border)" strokeDasharray="4 6" vertical={false} />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                                            tickLine={false}
                                            axisLine={false}
                                            minTickGap={18}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                                            tickLine={false}
                                            axisLine={false}
                                            width={36}
                                        />
                                        <Tooltip cursor={{ fill: "var(--accent)" }} content={<ActivityTooltip />} />
                                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                            {activityData.map((entry) => (
                                                <Cell key={entry.date} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex h-64 flex-col items-center justify-center text-center text-muted-foreground">
                                <BarChart3 size={38} className="mb-3 opacity-40" />
                                <p className="text-sm font-medium">No meeting activity in the last 30 days</p>
                                <p className="mt-1 text-xs">Start a room to populate this chart.</p>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-soft backdrop-blur">
                        <h2 className="mb-5 flex items-center gap-2 font-bold text-foreground">
                            <Users size={18} className="text-primary" />
                            Meeting Mix
                        </h2>
                        <div className="space-y-5">
                            {Object.entries(stats?.meetingsByType ?? {}).map(([type, count]) => {
                                const total = stats?.totalMeetings ?? 1;
                                const pct = Math.round((count / total) * 100);
                                const colors: Record<string, string> = {
                                    ONE_TO_ONE: "bg-chart-1",
                                    GROUP: "bg-chart-3",
                                    VIRTUAL_ROOM: "bg-chart-4",
                                };
                                const labels: Record<string, string> = {
                                    ONE_TO_ONE: "1:1 calls",
                                    GROUP: "Group calls",
                                    VIRTUAL_ROOM: "Virtual rooms",
                                };
                                return (
                                    <div key={type}>
                                        <div className="mb-1.5 flex items-center justify-between text-sm">
                                            <span className="font-medium text-foreground">{labels[type] || type}</span>
                                            <span className="text-muted-foreground">{count} ({pct}%)</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div className={`h-full rounded-full ${colors[type] || "bg-primary"} transition-all`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {Object.keys(stats?.meetingsByType ?? {}).length === 0 && (
                                <p className="py-8 text-center text-sm text-muted-foreground">No meetings yet</p>
                            )}
                        </div>
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-border bg-card/90 shadow-soft backdrop-blur">
                    <div className="border-b border-border px-6 py-4">
                        <h2 className="flex items-center gap-2 font-bold text-foreground">
                            <Calendar size={18} className="text-primary" />
                            Recent Meetings
                        </h2>
                    </div>
                    <div className="divide-y divide-border">
                        {stats?.recentMeetings.map((meeting) => (
                            <div key={meeting.id} className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meeting.type === "ONE_TO_ONE" ? "bg-primary/10 text-primary" : meeting.type === "GROUP" ? "bg-ai/10 text-ai" : "bg-warning/10 text-warning"}`}>
                                        {meeting.type === "ONE_TO_ONE" ? <Phone size={18} /> : <Users size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{meeting.name || "Meeting"}</p>
                                        <p className="text-xs text-muted-foreground">{formatDate(meeting.createdAt)} · {meeting.participantCount} participants</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 pl-14 sm:pl-0">
                                    {meeting.isHost && (
                                        <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">HOST</span>
                                    )}
                                    {meeting.isActive ? (
                                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">LIVE</span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">{formatDuration(meeting.durationMs)}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {(!stats?.recentMeetings || stats.recentMeetings.length === 0) && (
                            <div className="px-6 py-12 text-center text-muted-foreground">
                                <BarChart3 size={40} className="mx-auto mb-3 opacity-40" />
                                <p className="text-sm">No meetings yet. Start a room to see analytics.</p>
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}

function ActivityTooltip({
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
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-soft">
            <p className="font-semibold text-foreground">{label}</p>
            <p className="text-muted-foreground">
                {count} {count === 1 ? "meeting" : "meetings"}
            </p>
        </div>
    );
}
