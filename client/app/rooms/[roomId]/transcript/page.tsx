"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { TranscriptRenderer } from "@/components/TranscriptRenderer";

type TranscriptResponse = {
    roomId: string;
    roomName: string;
    transcript: string;
    highlightStartMs?: number;
    highlightEndMs?: number;
    date?: string;
};

export default function TranscriptPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [data, setData] = useState<TranscriptResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const query = new URLSearchParams();
        const highlight = searchParams.get("highlight");
        if (highlight) query.set("highlight", highlight);
        const highlightStartMs = searchParams.get("highlightStartMs");
        const highlightEndMs = searchParams.get("highlightEndMs");
        if (highlightStartMs) query.set("highlightStartMs", highlightStartMs);
        if (highlightEndMs) query.set("highlightEndMs", highlightEndMs);

        const suffix = query.toString() ? `?${query.toString()}` : "";

        (async () => {
            try {
                const transcriptData = await apiRequest(`/rooms/${roomId}/transcript${suffix}`, undefined, "GET");
                setData(transcriptData);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Failed to load transcript");
            } finally {
                setLoading(false);
            }
        })();
    }, [roomId, searchParams]);

    return (
        <div className="min-h-screen bg-[var(--bg-void)]">
            {/* ── Sticky Header ── */}
            <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-void)]/80 backdrop-blur-xl">
                <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-3 sm:px-6">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-glass)] hover:text-[var(--text-primary)]"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1
                            className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2 truncate"
                            style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}
                        >
                            <FileText size={16} className="text-[var(--signal-cyan)] shrink-0" />
                            {data?.roomName || "Meeting Transcript"}
                        </h1>
                        <p
                            className="text-[10px] text-[var(--text-muted)] mt-0.5"
                            style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
                        >
                            {data?.date
                                ? new Date(data.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                                : "Read-only transcript"
                            }
                        </p>
                    </div>
                </div>
            </header>

            {/* ── Main Content ── */}
            <main className="mx-auto max-w-[720px] px-4 py-8 sm:px-6">
                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-10 text-[var(--text-muted)]">
                        <Loader2 size={20} className="mr-2 animate-spin text-[var(--signal-cyan)]" />
                        <span className="text-sm" style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}>
                            Loading transcript...
                        </span>
                    </div>
                )}

                {/* Error */}
                {error && !loading && (
                    <div className="rounded-lg border border-[#f5223a]/20 bg-[#f5223a]/5 p-5">
                        <p className="text-sm font-medium text-[#f5223a]">{error}</p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-3 flex items-center gap-1.5 rounded-md border border-[#f5223a]/20 bg-[#f5223a]/10 px-3 py-1.5 text-xs font-medium text-[#f5223a] transition-colors hover:bg-[#f5223a]/20"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Transcript */}
                {data && !loading && !error && (
                    <section>
                        <TranscriptRenderer
                            transcript={data.transcript}
                            highlightStartMs={data.highlightStartMs}
                            highlightEndMs={data.highlightEndMs}
                        />
                    </section>
                )}
            </main>
        </div>
    );
}
