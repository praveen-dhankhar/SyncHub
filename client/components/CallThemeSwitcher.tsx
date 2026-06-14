"use client";

import { useState, useCallback } from "react";
import { Palette, Check, X } from "lucide-react";

// ─── Theme Definitions ──────────────────────────────────
export interface CallTheme {
    id: string;
    name: string;
    /** CSS applied to the call page background */
    bgClass: string;
    /** CSS variable used to draw the theme preview swatch */
    previewVar: string;
}

export const CALL_THEMES: CallTheme[] = [
    {
        id: "default",
        name: "Signal Mesh",
        bgClass: "call-theme-default",
        previewVar: "--call-preview-default",
    },
    {
        id: "focus",
        name: "Focus Blue",
        bgClass: "call-theme-focus",
        previewVar: "--call-preview-focus",
    },
    {
        id: "aurora",
        name: "Aurora Sync",
        bgClass: "call-theme-aurora",
        previewVar: "--call-preview-aurora",
    },
    {
        id: "studio",
        name: "Studio Signal",
        bgClass: "call-theme-studio",
        previewVar: "--call-preview-studio",
    },
    {
        id: "slate",
        name: "Clean Slate",
        bgClass: "call-theme-slate",
        previewVar: "--call-preview-slate",
    },
    {
        id: "cobalt",
        name: "Cobalt Room",
        bgClass: "call-theme-cobalt",
        previewVar: "--call-preview-cobalt",
    },
    {
        id: "calm",
        name: "Calm Board",
        bgClass: "call-theme-calm",
        previewVar: "--call-preview-calm",
    },
    {
        id: "ember",
        name: "Ember Review",
        bgClass: "call-theme-ember",
        previewVar: "--call-preview-ember",
    },
    {
        id: "graphite",
        name: "Graphite",
        bgClass: "call-theme-graphite",
        previewVar: "--call-preview-graphite",
    },
    {
        id: "lumen",
        name: "Lumen",
        bgClass: "call-theme-lumen",
        previewVar: "--call-preview-lumen",
    },
    {
        id: "deep",
        name: "Deep Focus",
        bgClass: "call-theme-deep",
        previewVar: "--call-preview-deep",
    },
];

// ─── Hook ───────────────────────────────────────────────
export function useCallTheme() {
    const [themeId, setThemeId] = useState(() => {
        if (typeof window === "undefined") return "default";
        return localStorage.getItem("call-theme") || "default";
    });

    const setTheme = useCallback((id: string) => {
        setThemeId(id);
        localStorage.setItem("call-theme", id);
    }, []);

    const theme = CALL_THEMES.find((t) => t.id === themeId) || CALL_THEMES[0];
    return { theme, setTheme };
}

// ─── Theme Switcher Component ───────────────────────────
interface CallThemeSwitcherProps {
    currentThemeId: string;
    onSelect: (id: string) => void;
}

export function CallThemeSwitcher({ currentThemeId, onSelect }: CallThemeSwitcherProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${isOpen ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-card/70 text-foreground hover:bg-accent"
                    }`}
                title="Change Background Theme"
            >
                <Palette size={16} />
                <span className="hidden sm:inline">Theme</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-12 z-[70] w-72 overflow-hidden rounded-2xl border border-border bg-card/95 shadow-soft backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between p-3 border-b border-border/40">
                            <span className="text-sm font-semibold">Call atmosphere</span>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-2 grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                            {CALL_THEMES.map((theme) => (
                                <button
                                    key={theme.id}
                                    onClick={() => {
                                        onSelect(theme.id);
                                        setIsOpen(false);
                                    }}
                                    className={`relative overflow-hidden rounded-xl border bg-background transition-all hover:-translate-y-0.5 active:scale-95 ${currentThemeId === theme.id
                                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                        : "border-border hover:border-primary/40"
                                        }`}
                                >
                                    <div
                                        className="h-16 w-full"
                                        style={{ background: `var(${theme.previewVar})` }}
                                    />
                                    <div className="px-2 py-1.5 text-xs font-medium text-left truncate flex items-center gap-1">
                                        {currentThemeId === theme.id && (
                                            <Check size={12} className="text-primary shrink-0" />
                                        )}
                                        <span className="truncate">{theme.name}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
