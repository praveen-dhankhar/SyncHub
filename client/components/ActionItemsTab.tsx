"use client";

import { CheckSquare, Download, Loader2, UserRound, CalendarDays } from "lucide-react";
import { useState } from "react";

export type ClientActionItem = {
    id: string;
    text: string;
    owner?: string | null;
    dueDate?: string | null;
    confidence?: number;
    extractionPass?: number;
    createdAt?: string;
};

type ActionItemsTabProps = {
    items: ClientActionItem[];
    isLoading?: boolean;
    onExportMarkdown: () => void;
};

export function ActionItemsTab({ items, isLoading, onExportMarkdown }: ActionItemsTabProps) {
    const [checked, setChecked] = useState<Set<string>>(new Set());

    const toggleCheck = (id: string) => {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="flex h-full flex-col bg-transparent">
            <div className="flex-1 overflow-y-auto px-3 py-3">
                {items.length === 0 && !isLoading && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[#8b8b9a]">
                        <CheckSquare size={32} className="opacity-30" />
                        <p className="text-xs font-medium">No action items yet</p>
                        <p className="max-w-48 text-[10px]">Clear follow-ups will appear here as the transcript grows.</p>
                    </div>
                )}

                {isLoading && items.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-[#8b8b9a]">
                        <Loader2 size={24} className="animate-spin text-[#00d9f5]" />
                        <p className="text-xs" style={{ fontFamily: "var(--font-geist), var(--font-body), ui-sans-serif, system-ui, sans-serif" }}>Extracting action items...</p>
                    </div>
                )}

                <div className="space-y-2">
                    {items.map((item) => (
                        <div key={item.id} className="rounded-lg border border-[rgb(255_255_255/0.06)] bg-[#111115] p-3">
                            <div className="flex items-start gap-2.5">
                                {/* Visual-only checkbox */}
                                <button
                                    type="button"
                                    onClick={() => toggleCheck(item.id)}
                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${checked.has(item.id)
                                        ? "border-[#00d9f5] bg-[#00d9f5] text-[#060608]"
                                        : "border-[rgb(255_255_255/0.18)] bg-transparent hover:border-[#00d9f5]/50"
                                        }`}
                                    aria-label="Visual completion checkbox"
                                >
                                    {checked.has(item.id) && (
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="1.5,5.5 4,8 8.5,2" />
                                        </svg>
                                    )}
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm leading-relaxed text-[#f1f1f3] transition-all ${checked.has(item.id) ? "line-through opacity-50" : ""}`}>
                                        {item.text}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#8b8b9a]" style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
                                        {item.owner && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(0_217_245/0.1)] px-2 py-0.5 text-[#00d9f5]">
                                                <UserRound size={10} />
                                                {item.owner}
                                            </span>
                                        )}
                                        {item.dueDate && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(250_204_21/0.1)] px-2 py-0.5 text-[#facc15]">
                                                <CalendarDays size={10} />
                                                {formatDueDate(item.dueDate)}
                                            </span>
                                        )}
                                        <span>{relativeExtractionTime(item.createdAt)}</span>
                                        {item.extractionPass === 2 && <span className="font-semibold text-[#58d68d]">final</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="shrink-0 border-t border-[rgb(255_255_255/0.06)] p-3">
                <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[rgb(255_255_255/0.06)] bg-[rgb(255_255_255/0.03)] px-4 py-2.5 text-xs font-medium text-[#8b8b9a] transition-all hover:bg-[rgb(255_255_255/0.06)] hover:text-[#f1f1f3] disabled:opacity-30"
                    onClick={onExportMarkdown}
                    disabled={items.length === 0}
                >
                    <Download size={14} />
                    Export as Markdown
                </button>
            </div>
        </div>
    );
}

function relativeExtractionTime(createdAt?: string) {
    if (!createdAt) return "just now";
    const elapsed = Date.now() - new Date(createdAt).getTime();
    if (!Number.isFinite(elapsed) || elapsed < 60_000) return "just now";
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 60) return `extracted ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `extracted ${hours}h ago`;
}

function formatDueDate(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
