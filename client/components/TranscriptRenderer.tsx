"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

type TranscriptRendererProps = {
    transcript: string;
    highlightStartMs?: number | null;
    highlightEndMs?: number | null;
    emptyMessage?: string;
};

type TranscriptLine = {
    id: string;
    speaker: string | null;
    text: string;
    startMs: number | null;
    endMs: number | null;
    timestampLabel: string | null;
};

const LINE_RE = /^\s*(?:\[([^\]]+)\]\s*)?([^:\n]{1,80}):\s*(.+?)\s*$/;

export function TranscriptRenderer({ transcript, highlightStartMs, highlightEndMs, emptyMessage = "No transcript available." }: TranscriptRendererProps) {
    const lines = parseTranscript(transcript);
    const highlightRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to first highlighted block
    useEffect(() => {
        if (highlightRef.current) {
            highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [highlightStartMs, highlightEndMs]);

    if (lines.length === 0) {
        return (
            <div className="rounded-md border border-[rgb(255_255_255/0.06)] bg-[rgb(255_255_255/0.03)] px-4 py-6 text-center text-sm text-[#8b8b9a]">
                {emptyMessage}
            </div>
        );
    }

    let firstHighlightFound = false;

    return (
        <div className="space-y-1.5">
            {lines.map((line) => {
                const highlighted = isHighlighted(line, highlightStartMs, highlightEndMs);
                const isFirst = highlighted && !firstHighlightFound;
                if (isFirst) firstHighlightFound = true;

                return (
                    <div
                        key={line.id}
                        ref={isFirst ? highlightRef : undefined}
                        className={cn(
                            "rounded-md px-3.5 py-2.5 text-sm transition-colors",
                            highlighted
                                ? "bg-[rgb(0_217_245/0.06)] border-l-2 border-l-[#00d9f5] border border-[rgb(0_217_245/0.12)]"
                                : "bg-[#111115] border border-[rgb(255_255_255/0.06)]",
                        )}
                    >
                        <div className="mb-1 flex items-center gap-3 text-[11px]">
                            {line.timestampLabel && (
                                <span
                                    className="text-[#00d9f5] font-medium shrink-0"
                                    style={{
                                        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                                        width: "60px",
                                    }}
                                >
                                    {line.timestampLabel}
                                </span>
                            )}
                            <span
                                className="font-medium text-[#f1f1f3]"
                                style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}
                            >
                                {line.speaker || "Transcript"}
                            </span>
                        </div>
                        <p
                            className="leading-relaxed text-[#8b8b9a] whitespace-pre-wrap"
                            style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}
                        >
                            {line.text}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

export function parseTranscript(transcript: string): TranscriptLine[] {
    if (!transcript.trim()) return [];

    const lines: TranscriptLine[] = [];

    transcript.split(/\r?\n/).forEach((rawLine, index) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return;

        const match = trimmed.match(LINE_RE);
        if (!match) {
            const previous = lines[lines.length - 1];
            if (previous) {
                previous.text = `${previous.text}\n${trimmed}`;
            } else {
                lines.push({
                    id: `${index}`,
                    speaker: null,
                    text: trimmed,
                    startMs: null,
                    endMs: null,
                    timestampLabel: null,
                });
            }
            return;
        }

        const timestamp = match[1] ? parseTimestamp(match[1]) : { startMs: null, endMs: null, label: null };
        lines.push({
            id: `${index}`,
            speaker: match[2]?.trim() || null,
            text: match[3]?.trim() || "",
            startMs: timestamp.startMs,
            endMs: timestamp.endMs,
            timestampLabel: timestamp.label,
        });
    });

    return lines;
}

function isHighlighted(line: TranscriptLine, highlightStartMs?: number | null, highlightEndMs?: number | null) {
    if (highlightStartMs === null || highlightStartMs === undefined) return false;
    if (highlightEndMs === null || highlightEndMs === undefined) return false;
    if (line.startMs === null && line.endMs === null) return false;

    const start = line.startMs ?? line.endMs ?? 0;
    const end = line.endMs ?? line.startMs ?? start;
    return start <= highlightEndMs && end >= highlightStartMs;
}

function parseTimestamp(raw: string): { startMs: number | null; endMs: number | null; label: string | null } {
    const range = raw.match(/^(.+?)\s*[-–]\s*(.+)$/);
    if (range) {
        const startMs = parseSingleTimestamp(range[1]);
        const endMs = parseSingleTimestamp(range[2]);
        return {
            startMs,
            endMs,
            label: startMs !== null && endMs !== null ? `${formatMs(startMs)}-${formatMs(endMs)}` : raw,
        };
    }

    const startMs = parseSingleTimestamp(raw);
    return { startMs, endMs: startMs, label: startMs !== null ? formatMs(startMs) : raw };
}

function parseSingleTimestamp(raw: string): number | null {
    const value = raw.trim().toLowerCase();
    const explicitMs = value.match(/^(\d+)\s*ms$/);
    if (explicitMs) return Number(explicitMs[1]);
    if (/^\d+$/.test(value)) return Number(value);

    const parts = value.split(":").map(Number);
    if (parts.length >= 2 && parts.length <= 3 && parts.every(Number.isFinite)) {
        const totalSeconds = parts.length === 2
            ? parts[0] * 60 + parts[1]
            : parts[0] * 3600 + parts[1] * 60 + parts[2];
        return Math.round(totalSeconds * 1000);
    }

    return null;
}

function formatMs(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
