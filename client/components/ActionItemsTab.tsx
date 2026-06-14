"use client";

import { CheckSquare, Download, Loader2, UserRound, CalendarDays } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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
    return (
        <div className="flex h-full flex-col bg-card/95">
            <div className="flex-1 overflow-y-auto px-3 py-3">
                {items.length === 0 && !isLoading && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                        <CheckSquare size={32} className="opacity-30" />
                        <p className="text-xs font-medium">No action items yet</p>
                        <p className="max-w-48 text-[10px]">Clear follow-ups will appear here as the transcript grows.</p>
                    </div>
                )}

                {isLoading && items.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 size={24} className="animate-spin text-primary" />
                        <p className="text-xs">Checking transcript...</p>
                    </div>
                )}

                <div className="space-y-2">
                    {items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-border bg-background/70 p-3 shadow-sm animate-in fade-in duration-200">
                            <div className="flex items-start gap-2">
                                <Checkbox checked={false} aria-label="Visual completion checkbox" className="mt-0.5 pointer-events-none" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-relaxed text-foreground">{item.text}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                        {item.owner && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                                <UserRound size={10} />
                                                {item.owner}
                                            </span>
                                        )}
                                        {item.dueDate && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-warning">
                                                <CalendarDays size={10} />
                                                {formatDueDate(item.dueDate)}
                                            </span>
                                        )}
                                        <span>{relativeExtractionTime(item.createdAt)}</span>
                                        {item.extractionPass === 2 && <span className="font-semibold text-success">final</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="shrink-0 border-t border-border p-3">
                <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-center gap-2"
                    onClick={onExportMarkdown}
                    disabled={items.length === 0}
                >
                    <Download size={14} />
                    Export as Markdown
                </Button>
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
