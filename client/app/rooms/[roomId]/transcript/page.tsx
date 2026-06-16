"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { TranscriptRenderer } from "@/components/TranscriptRenderer";
import { AppShell } from "@/components/app-shell";

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
        <AppShell>
            <div className="mx-auto max-w-[720px]">
                {/* Page header */}
                <div className="mb-6 flex items-center gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-elevated">
                        <FileText size={16} className="text-signal-cyan" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="dash-title truncate text-base">
                            {data?.roomName || "Meeting Transcript"}
                        </h1>
                        <p className="dash-subtitle text-xs">
                            {data?.date
                                ? new Date(data.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                                : "Read-only transcript"
                            }
                        </p>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center rounded-xl border border-border-subtle bg-elevated p-10 text-text-secondary">
                        <Loader2 size={20} className="mr-2 animate-spin text-signal-cyan" />
                        <span className="text-sm">Loading transcript...</span>
                    </div>
                )}

                {/* Error */}
                {error && !loading && (
                    <div className="rounded-xl border border-brand-red/20 bg-brand-red/5 p-5">
                        <p className="text-sm font-medium text-brand-red">{error}</p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="profile-btn-danger mt-3 px-3 py-1.5 text-xs"
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
            </div>
        </AppShell>
    );
}
