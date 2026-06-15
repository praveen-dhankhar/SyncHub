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
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-muted transition-all text-muted-foreground hover:text-foreground">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <FileText className="text-primary" size={24} />
                            {data?.roomName || "Meeting Transcript"}
                        </h1>
                        <p className="text-sm text-muted-foreground">Read-only meeting transcript</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading && (
                    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground">
                        <Loader2 size={24} className="mr-2 animate-spin text-primary" />
                        Loading transcript...
                    </div>
                )}

                {error && !loading && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {data && !loading && !error && (
                    <section className="rounded-2xl border border-border bg-card p-5">
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
