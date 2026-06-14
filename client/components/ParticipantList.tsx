"use client";

import { X, Mic, MicOff, Crown, User } from "lucide-react";

interface Participant {
    peerId: string;
    userId: string;
    isLocal?: boolean;
    isMuted?: boolean;
}

interface ParticipantListProps {
    isOpen: boolean;
    onClose: () => void;
    participants: Participant[];
}

export function ParticipantList({ isOpen, onClose, participants }: ParticipantListProps) {
    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <div
                className={`fixed right-0 top-0 z-50 h-full w-80 transform border-l border-border bg-card/95 shadow-soft backdrop-blur-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold">Participants</h2>
                        <span className="text-xs font-medium bg-primary/15 text-primary px-2.5 py-1 rounded-full">
                            {participants.length}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        title="Close"
                        aria-label="Close participants"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Participant List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {participants.map((p) => (
                        <div
                            key={p.peerId}
                            className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50"
                        >
                            {/* Avatar */}
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${p.isLocal
                                        ? "bg-primary/20 text-primary"
                                        : "bg-muted/70 text-muted-foreground"
                                    }`}
                            >
                                {p.isLocal ? (
                                    <Crown size={16} />
                                ) : (
                                    <User size={16} />
                                )}
                            </div>

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {p.isLocal ? "You" : p.userId.slice(0, 12)}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {p.isLocal ? "Host" : "Participant"}
                                </p>
                            </div>

                            {/* Mic Status */}
                            <div className="shrink-0">
                                {p.isMuted ? (
                                    <MicOff size={16} className="text-danger" />
                                ) : (
                                    <Mic size={16} className="text-muted-foreground" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border/50">
                    <p className="text-xs text-center text-muted-foreground">
                        End-to-end encrypted - Powered by SyncHub
                    </p>
                </div>
            </div>
        </>
    );
}
