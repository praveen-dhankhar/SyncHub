"use client";

import { useState } from "react";
import { X, Download, FileVideo, HardDrive } from "lucide-react";

export interface RecordingEntry {
    name: string;
    blob: Blob;
    size: number;
    receivedAt: number;
}

interface RecordingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    recordings: RecordingEntry[];
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatTimestamp(ts: number) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
        " · " + d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function RecordingsModal({ isOpen, onClose, recordings }: RecordingsModalProps) {
    const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());

    const handleDownload = (rec: RecordingEntry) => {
        const url = URL.createObjectURL(rec.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${rec.name}-recording.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setDownloadedSet(prev => new Set(prev).add(rec.name));
    };

    const handleDownloadAll = () => {
        for (const rec of recordings) {
            handleDownload(rec);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card/95 shadow-soft backdrop-blur-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                            <FileVideo className="text-primary" size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-foreground">Meeting Recordings</h2>
                            <p className="text-xs text-muted-foreground">
                                {recordings.length} recording{recordings.length !== 1 ? "s" : ""} received via P2P
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        aria-label="Close recordings"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 max-h-[60vh] overflow-y-auto">
                    {recordings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <HardDrive size={48} className="mb-3 opacity-50" />
                            <p className="text-sm font-medium">No recordings received yet</p>
                            <p className="text-xs mt-1">Recordings from other participants will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recordings.map((rec, i) => (
                                <div
                                    key={`${rec.name}-${i}`}
                                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-live/10">
                                            <FileVideo size={18} className="text-live" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">{rec.name}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {formatBytes(rec.size)} · {formatTimestamp(rec.receivedAt)}
                                                {downloadedSet.has(rec.name) && <span className="ml-1 text-success">Downloaded</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDownload(rec)}
                                        className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 opacity-70 group-hover:opacity-100"
                                        title="Download"
                                    >
                                        <Download size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {recordings.length > 0 && (
                    <div className="p-5 border-t border-border flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            Total: {formatBytes(recordings.reduce((sum, r) => sum + r.size, 0))}
                        </p>
                        <button
                            onClick={handleDownloadAll}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
                        >
                            <Download size={16} />
                            Download All ({recordings.length})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
