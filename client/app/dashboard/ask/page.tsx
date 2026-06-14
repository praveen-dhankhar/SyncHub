"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, BarChart3, Brain, Calendar, Loader2, Search, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push("/")} className="p-2 rounded-xl hover:bg-muted transition-all text-muted-foreground hover:text-foreground">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <Brain className="text-primary" size={24} />
                                Ask SyncHub
                            </h1>
                            <p className="text-sm text-muted-foreground">Search your completed meeting history with citations</p>
                        </div>
                    </div>
                    <Button variant="secondary" onClick={() => router.push("/dashboard")} className="gap-2">
                        <BarChart3 size={16} />
                        Analytics
                    </Button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <section className="rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <Sparkles size={18} className="text-primary" />
                        <h2 className="font-bold text-foreground">Question</h2>
                    </div>
                    <Textarea
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                event.preventDefault();
                                void submit();
                            }
                        }}
                        placeholder="What did we decide about the launch plan?"
                        className="min-h-28 resize-none"
                        maxLength={1000}
                    />
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">Answers use only meetings you participated in.</p>
                        <Button onClick={() => void submit()} disabled={!query.trim() || loading} className="gap-2">
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            Search
                        </Button>
                    </div>
                </section>

                {loading && (
                    <section className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
                        <Loader2 size={28} className="mx-auto mb-3 animate-spin text-primary" />
                        <p className="text-sm">Searching your meetings...</p>
                    </section>
                )}

                {error && !loading && (
                    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                        <p className="text-sm font-medium text-destructive">{error}</p>
                        <p className="mt-1 text-xs text-muted-foreground">This is recoverable. Try again in a moment.</p>
                    </section>
                )}

                {!loading && !error && !result && (
                    <section className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
                        <Brain size={36} className="mx-auto mb-3 opacity-25" />
                        <p className="text-sm font-medium">Ask a question to search completed meetings.</p>
                        <p className="mt-1 text-xs">Meetings become searchable after they end with a transcript.</p>
                    </section>
                )}

                {result && !loading && (
                    <section className="rounded-2xl border border-border bg-card">
                        <div className="border-b border-border px-5 py-4">
                            <h2 className="font-bold text-foreground">Answer</h2>
                        </div>
                        <div className="space-y-5 p-5">
                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{result.answer}</p>

                            {result.citations.length > 0 ? (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sources</h3>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {result.citations.map((citation, index) => (
                                            <Link
                                                key={`${citation.roomId}-${citation.chunkStartMs}-${index}`}
                                                href={citationHref(citation)}
                                                className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
                                            >
                                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                                                    <Calendar size={15} className="text-primary" />
                                                    {citation.roomName}
                                                </div>
                                                <p className="mb-2 text-xs text-muted-foreground">{formatRange(citation)}</p>
                                                <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{citation.snippet}</p>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                    No citations were returned for this answer.
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </main>
        </div>
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
