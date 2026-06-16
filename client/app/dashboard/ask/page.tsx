"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Brain, Calendar, Loader2, Search, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

type AskCitation = {
    roomId: string;
    roomName: string;
    chunkStartMs: number | null;
    chunkEndMs: number | null;
    snippet: string;
};

type AskResponse = {
    answer: string;
    citations: AskCitation[];
};

export default function AskSyncHubPage() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<AskResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        const trimmed = query.trim();
        if (!trimmed || loading) return;

        setLoading(true);
        setError(null);
        try {
            const data = await apiRequest("/ai/ask", { query: trimmed }, "POST");
            setResult(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Ask SyncHub is unavailable");
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

    return (
        <AppShell>
            <div className="mx-auto max-w-[680px] space-y-6">
                {/* ── Search Section ── */}
                <section>
                    {/* AI badge */}
                    <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--state-ai-dim)] px-2.5 py-1 text-[10px] font-semibold text-[var(--state-ai)]" style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
                            <Sparkles size={10} />
                            Searches across your meeting history
                        </span>
                    </div>

                    {/* Search input */}
                    <div className="relative">
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault();
                                    void submit();
                                }
                            }}
                            placeholder="What did we decide about the launch plan?"
                            className="w-full min-h-[56px] max-h-32 resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3.5 pr-28 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 outline-none transition-all focus:border-[var(--signal-cyan)] focus:shadow-[0_0_0_3px_rgba(0,217,245,0.1)]"
                            style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}
                            maxLength={1000}
                        />

                        {/* Submit button + shortcut inside input */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <span className="hidden sm:inline text-[10px] text-[var(--text-muted)]" style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
                                {isMac ? "⌘" : "Ctrl"} ⏎
                            </span>
                            <button
                                type="button"
                                onClick={() => void submit()}
                                disabled={!query.trim() || loading}
                                className="flex items-center gap-1.5 rounded-md bg-[var(--signal-cyan)] px-3 py-1.5 text-xs font-medium text-[var(--bg-void)] transition-all hover:opacity-90 disabled:opacity-30"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                {loading ? "..." : "Search"}
                            </button>
                        </div>
                    </div>

                    <p className="mt-2 text-[10px] text-[var(--text-muted)]" style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}>
                        Answers use only meetings you participated in.
                    </p>
                </section>

                {/* ── Loading State ── */}
                {loading && (
                    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-8 text-center">
                        <Loader2 size={24} className="mx-auto mb-3 animate-spin text-[var(--state-ai)]" />
                        <p className="text-sm text-[var(--text-muted)]" style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}>
                            Searching your meetings...
                        </p>
                    </section>
                )}

                {/* ── Error State ── */}
                {error && !loading && (
                    <section className="rounded-lg border border-[#f5223a]/20 bg-[#f5223a]/5 p-5">
                        <p className="text-sm font-medium text-[#f5223a]">{error}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">This is recoverable. Try again in a moment.</p>
                        <button
                            type="button"
                            onClick={() => void submit()}
                            className="mt-3 flex items-center gap-1.5 rounded-md border border-[#f5223a]/20 bg-[#f5223a]/10 px-3 py-1.5 text-xs font-medium text-[#f5223a] transition-colors hover:bg-[#f5223a]/20"
                        >
                            Retry
                        </button>
                    </section>
                )}

                {/* ── Empty State ── */}
                {!loading && !error && !result && (
                    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-10 text-center">
                        <Brain size={36} className="mx-auto mb-3 text-[var(--text-muted)] opacity-25" />
                        <p className="text-sm font-medium text-[var(--text-muted)]">Ask a question to search completed meetings.</p>
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]/60">Meetings become searchable after they end with a transcript.</p>
                    </section>
                )}

                {/* ── Answer Surface ── */}
                {result && !loading && (
                    <section className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] border-l-2 border-l-[var(--state-ai)]">
                        <div className="border-b border-[var(--border-subtle)] px-5 py-4 flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--state-ai-dim)]">
                                <Sparkles size={12} className="text-[var(--state-ai)]" />
                            </div>
                            <h2 className="text-sm font-medium text-[var(--text-primary)]" style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}>
                                Answer
                            </h2>
                        </div>
                        <div className="space-y-5 p-5">
                            <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap" style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}>
                                {result.answer}
                            </p>

                            {result.citations.length > 0 ? (
                                <div className="space-y-3">
                                    <h3
                                        className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                                        style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
                                    >
                                        Sources
                                    </h3>
                                    <div className="space-y-2">
                                        {result.citations.map((citation, index) => (
                                            <Link
                                                key={`${citation.roomId}-${citation.chunkStartMs}-${index}`}
                                                href={citationHref(citation)}
                                                className="group flex items-start gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] p-3.5 transition-colors hover:border-[var(--signal-cyan)]/30"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                                                        <Calendar size={12} className="text-[var(--signal-cyan)] shrink-0" />
                                                        {citation.roomName}
                                                    </div>
                                                    <p
                                                        className="mb-1.5 text-[10px] text-[var(--text-muted)]"
                                                        style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
                                                    >
                                                        {formatRange(citation)}
                                                    </p>
                                                    <p className="line-clamp-3 text-xs leading-relaxed text-[var(--text-primary)]">
                                                        {citation.snippet}
                                                    </p>
                                                </div>
                                                <ArrowUpRight
                                                    size={14}
                                                    className="mt-0.5 shrink-0 text-[var(--signal-cyan)] opacity-0 transition-opacity group-hover:opacity-100"
                                                />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-4 py-3 text-xs text-[var(--text-muted)]">
                                    No citations were returned for this answer.
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </AppShell>
    );
}

function citationHref(citation: AskCitation) {
    const params = new URLSearchParams();
    if (citation.chunkStartMs !== null && citation.chunkEndMs !== null) {
        params.set("highlight", `${citation.chunkStartMs}-${citation.chunkEndMs}`);
    }
    const suffix = params.toString();
    return `/rooms/${citation.roomId}/transcript${suffix ? `?${suffix}` : ""}`;
}

function formatRange(citation: AskCitation) {
    if (citation.chunkStartMs === null || citation.chunkEndMs === null) return "Transcript excerpt";
    return `${formatMs(citation.chunkStartMs)}-${formatMs(citation.chunkEndMs)}`;
}

function formatMs(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
