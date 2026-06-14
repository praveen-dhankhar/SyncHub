"use client";

import { useState, useEffect, useCallback } from "react";
import { SmilePlus } from "lucide-react";

const REACTION_EMOJIS = ["👏", "🎉", "❤️", "😂", "🔥", "👍"];

interface FloatingEmoji {
    id: string;
    emoji: string;
    x: number; // random horizontal position (%)
    sender?: string;
}

interface EmojiReactionsProps {
    onSendReaction: (emoji: string) => void;
    incomingReaction?: { emoji: string; sender: string } | null;
}

export function EmojiReactions({ onSendReaction, incomingReaction }: EmojiReactionsProps) {
    const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
    const [showBar, setShowBar] = useState(false);

    const addFloating = useCallback((emoji: string, sender?: string) => {
        const id = `${Date.now()}-${Math.random()}`;
        const x = 10 + Math.random() * 80; // 10-90% horizontal
        setFloatingEmojis(prev => [...prev, { id, emoji, x, sender }]);
        // Remove after animation ends
        setTimeout(() => {
            setFloatingEmojis(prev => prev.filter(e => e.id !== id));
        }, 3000);
    }, []);

    // Handle incoming remote reactions
    useEffect(() => {
        if (!incomingReaction) return;
        const timeoutId = window.setTimeout(() => {
            addFloating(incomingReaction.emoji, incomingReaction.sender);
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [incomingReaction, addFloating]);

    const handleClick = (emoji: string) => {
        addFloating(emoji, "You");
        onSendReaction(emoji);
        setShowBar(false);
    };

    return (
        <>
            {/* Floating emojis */}
            <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
                {floatingEmojis.map((fe) => (
                    <div
                        key={fe.id}
                        className="absolute animate-emoji-float"
                        style={{
                            left: `${fe.x}%`,
                            bottom: "10%",
                        }}
                    >
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-4xl sm:text-5xl drop-shadow-lg">{fe.emoji}</span>
                            {fe.sender && (
                                <span className="rounded-full border border-border bg-card/80 px-2 py-0.5 text-[9px] font-bold text-foreground backdrop-blur-sm">
                                    {fe.sender}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Reaction trigger button */}
            <button
                onClick={() => setShowBar(prev => !prev)}
                className={`fixed bottom-28 right-6 z-50 rounded-full p-3 shadow-soft transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${showBar
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card/80 text-foreground backdrop-blur-xl hover:bg-accent"
                    }`}
                title="React"
                aria-label="Open reaction picker"
            >
                <SmilePlus size={22} />
            </button>

            {/* Reaction bar */}
            {showBar && (
                <div className="fixed bottom-44 right-4 z-50 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-2 shadow-soft backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-200">
                    {REACTION_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => handleClick(emoji)}
                            className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all hover:bg-muted active:scale-90"
                            aria-label={`Send ${emoji} reaction`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {/* CSS for float animation */}
            <style jsx global>{`
                @keyframes emoji-float {
                    0% {
                        transform: translateY(0) scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: translateY(-40vh) scale(1.3);
                        opacity: 0.8;
                    }
                    100% {
                        transform: translateY(-80vh) scale(0.8);
                        opacity: 0;
                    }
                }
                .animate-emoji-float {
                    animation: emoji-float 3s ease-out forwards;
                }
            `}</style>
        </>
    );
}
