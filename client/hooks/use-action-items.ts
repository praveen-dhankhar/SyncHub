"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { ClientActionItem } from "@/components/ActionItemsTab";

type UseActionItemsOptions = {
    roomId: string;
    transcript: string;
    isActive: boolean;
    serverItems?: ClientActionItem[];
};

export function useActionItems({ roomId, transcript, isActive, serverItems = [] }: UseActionItemsOptions) {
    const [items, setItems] = useState<ClientActionItem[]>(serverItems);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inFlightRef = useRef(false);
    const lastSentTranscriptRef = useRef("");

    useEffect(() => {
        setItems(serverItems);
    }, [serverItems]);

    useEffect(() => {
        if (!isActive || !roomId) return;

        const sendTranscript = async () => {
            const currentTranscript = transcript.trim();
            if (!currentTranscript) return;
            if (currentTranscript === lastSentTranscriptRef.current) return;
            if (inFlightRef.current) return;

            inFlightRef.current = true;
            setIsLoading(true);
            setError(null);

            try {
                const data = await apiRequest("/ai/action-items", {
                    roomId,
                    transcript: currentTranscript,
                }, "POST");
                if (Array.isArray(data.items)) {
                    setItems(data.items);
                }
                lastSentTranscriptRef.current = currentTranscript;
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Action items unavailable");
            } finally {
                inFlightRef.current = false;
                setIsLoading(false);
            }
        };

        const interval = window.setInterval(sendTranscript, 60_000);
        void sendTranscript();

        return () => {
            window.clearInterval(interval);
        };
    }, [roomId, transcript, isActive]);

    const markdown = useMemo(() => {
        if (items.length === 0) return "## Action Items\n\nNo action items captured.\n";
        return [
            "## Action Items",
            "",
            ...items.map((item) => {
                const meta = [
                    item.owner ? `Owner: ${item.owner}` : null,
                    item.dueDate ? `Due: ${formatDate(item.dueDate)}` : null,
                ].filter(Boolean).join(" | ");
                return `- [ ] ${item.text}${meta ? ` (${meta})` : ""}`;
            }),
            "",
        ].join("\n");
    }, [items]);

    const exportMarkdown = () => {
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `meeting-action-items-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return { items, isLoading, error, markdown, exportMarkdown };
}

function formatDate(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
