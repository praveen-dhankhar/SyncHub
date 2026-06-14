"use client";

import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { BackgroundMode } from "@/hooks/use-virtual-background";

interface VirtualBackgroundSelectorProps {
    currentMode: BackgroundMode;
    currentUrl: string;
    onSelect: (mode: BackgroundMode, url?: string) => void;
}

const BG_OPTIONS = [
    { id: "none", label: "None", mode: "none" as BackgroundMode },
    { id: "blur", label: "Blur", mode: "blur" as BackgroundMode },
    { id: "th1", label: "Office 1", mode: "image" as BackgroundMode, url: "/backgrounds/Th1.jpg" },
    { id: "th2", label: "Office 2", mode: "image" as BackgroundMode, url: "/backgrounds/Th2.jpg" },
    { id: "th3", label: "Living Room", mode: "image" as BackgroundMode, url: "/backgrounds/Th3.jpg" },
];

export function VirtualBackgroundSelector({ currentMode, currentUrl, onSelect }: VirtualBackgroundSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`grid shrink-0 place-items-center rounded-xl border p-3 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:p-3.5 ${currentMode !== "none" ? "border-primary/30 bg-primary text-primary-foreground shadow-signal hover:bg-primary/90" : "border-border bg-card/60 text-foreground hover:bg-accent"}`}
                title="Virtual Background"
                aria-label="Virtual background"
            >
                <ImageIcon size={18} className="sm:w-5 sm:h-5" />
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-1/2 z-50 mb-4 w-72 -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card/95 shadow-soft backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between border-b border-border bg-muted/20 p-3">
                        <h3 className="font-semibold text-sm">Virtual Background</h3>
                        <button onClick={() => setIsOpen(false)} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Close virtual background menu">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="p-3 grid grid-cols-3 gap-2">
                        {BG_OPTIONS.map((opt) => {
                            const isActive = currentMode === opt.mode && (opt.mode !== "image" || currentUrl === opt.url);

                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        onSelect(opt.mode, opt.url);
                                        setIsOpen(false);
                                    }}
                                    className={`group relative aspect-video overflow-hidden rounded-lg border-2 transition-all ${isActive ? "border-primary" : "border-border hover:border-primary/50"}`}
                                >
                                    {opt.mode === "none" && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-muted text-xs font-medium text-muted-foreground">
                                            None
                                        </div>
                                    )}
                                    {opt.mode === "blur" && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-muted text-xs font-medium text-foreground backdrop-blur-md">
                                            Blur
                                        </div>
                                    )}
                                    {opt.mode === "image" && opt.url && (
                                        <img
                                            src={opt.url}
                                            alt={opt.label}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    )}
                                    {isActive && (
                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/20">
                                            <div className="w-2 h-2 rounded-full bg-primary" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
