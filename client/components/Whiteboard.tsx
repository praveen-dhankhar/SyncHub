"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Pencil, Eraser, Trash2, X, Minus, Plus } from "lucide-react";

const COLORS = [
    "--wb-ink-1",
    "--wb-ink-2",
    "--wb-ink-3",
    "--wb-ink-4",
    "--wb-ink-5",
    "--wb-ink-6",
    "--wb-ink-7",
    "--wb-ink-8",
];

interface DrawPoint {
    x: number;
    y: number;
    color: string;
    lineWidth: number;
    tool: "pen" | "eraser";
    isStart: boolean;
}

interface WhiteboardProps {
    isOpen: boolean;
    onClose: () => void;
    onDraw: (point: DrawPoint) => void;
    onClear: () => void;
    incomingDraw?: DrawPoint | null;
    incomingClear?: boolean;
}

export function Whiteboard({ isOpen, onClose, onDraw, onClear, incomingDraw, incomingClear }: WhiteboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const [tool, setTool] = useState<"pen" | "eraser">("pen");
    const [color, setColor] = useState("--wb-ink-6");
    const [lineWidth, setLineWidth] = useState(3);

    // Initialize canvas with grid background
    useEffect(() => {
        if (!isOpen) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = () => {
            const rect = canvas.parentElement!.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            const ctx = canvas.getContext("2d")!;
            ctx.scale(dpr, dpr);
            fillBg(ctx, rect.width, rect.height);
        };
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, [isOpen]);

    const fillBg = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        // Solid background
        ctx.fillStyle = resolveCssColor("--whiteboard-bg");
        ctx.fillRect(0, 0, w, h);

        // Grid lines (professional look)
        ctx.strokeStyle = resolveCssColor("--whiteboard-grid");
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < w; x += 40) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y < h; y += 40) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
    };

    // Draw incoming remote points
    useEffect(() => {
        if (!incomingDraw) return;
        drawPoint(incomingDraw);
    }, [incomingDraw]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle incoming clear
    useEffect(() => {
        if (incomingClear) clearCanvas();
    }, [incomingClear]); // eslint-disable-line react-hooks/exhaustive-deps

    const drawPoint = useCallback((point: DrawPoint) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        const rect = canvas.getBoundingClientRect();
        const x = point.x * rect.width;
        const y = point.y * rect.height;

        if (point.isStart) {
            ctx.beginPath();
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
            if (point.tool === "eraser") {
                ctx.strokeStyle = resolveCssColor("--whiteboard-bg");
                ctx.lineWidth = point.lineWidth * 4;
            } else {
                ctx.strokeStyle = resolveCssColor(point.color);
                ctx.lineWidth = point.lineWidth;
            }
            ctx.globalAlpha = 1;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke();
            // Removed shadow effects for a cleaner, professional look
        }
    }, []);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        const rect = canvas.getBoundingClientRect();
        fillBg(ctx, rect.width, rect.height);
    }, []);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        let clientX: number, clientY: number;
        if ("touches" in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height,
        };
    };

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        isDrawingRef.current = true;
        const pos = getPos(e);
        const point: DrawPoint = { ...pos, color: resolveCssColor(color), lineWidth, tool, isStart: true };
        drawPoint(point);
        onDraw(point);
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        const pos = getPos(e);
        const point: DrawPoint = { ...pos, color: resolveCssColor(color), lineWidth, tool, isStart: false };
        drawPoint(point);
        onDraw(point);
    };

    const handleEnd = () => {
        isDrawingRef.current = false;
    };

    const handleClear = () => {
        clearCanvas();
        onClear();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
            <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border shadow-soft" style={{ backgroundColor: "var(--whiteboard-bg)" }}>
                {/* Toolbar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                    <div className="flex items-center gap-4 flex-wrap">
                        <h3 className="text-foreground font-semibold text-sm flex items-center gap-2">
                            Whiteboard
                        </h3>
                        <div className="w-px h-5 bg-border" />

                        {/* Tools */}
                        <div className="flex items-center bg-muted/40 rounded-lg p-1 gap-1 border border-border/50">
                            <button
                                onClick={() => setTool("pen")}
                                className={`p-1.5 rounded-md transition-all ${tool === "pen" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                                title="Pen"
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                onClick={() => setTool("eraser")}
                                className={`p-1.5 rounded-md transition-all ${tool === "eraser" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                                title="Eraser"
                            >
                                <Eraser size={16} />
                            </button>
                        </div>

                        {/* Colors */}
                        <div className="flex items-center gap-2">
                            {COLORS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => { setColor(c); setTool("pen"); }}
                                    className={`h-5 w-5 rounded-full border transition-all ${color === c && tool === "pen" ? "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border opacity-80 hover:opacity-100"}`}
                                    style={{ backgroundColor: `var(${c})` }}
                                    aria-label={`Select ${c.replace("--wb-ink-", "ink ")} color`}
                                />
                            ))}
                        </div>

                        <div className="w-px h-5 bg-border hidden sm:block" />

                        {/* Line width */}
                        <div className="hidden sm:flex items-center gap-2 bg-muted/40 border border-border/50 rounded-lg px-2 py-1">
                            <button onClick={() => setLineWidth(Math.max(1, lineWidth - 1))} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                <Minus size={14} />
                            </button>
                            <div className="flex items-center justify-center w-6">
                                <div className="rounded-full bg-foreground" style={{ width: `${Math.min(lineWidth * 2, 16)}px`, height: `${Math.min(lineWidth * 2, 16)}px` }} />
                            </div>
                            <button onClick={() => setLineWidth(Math.min(20, lineWidth + 1))} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                <Plus size={14} />
                            </button>
                        </div>

                        <div className="w-px h-5 bg-border hidden sm:block" />

                        {/* Clear */}
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all"
                        >
                            <Trash2 size={14} />
                            Clear
                        </button>
                    </div>

                    <button onClick={onClose} className="rounded-lg border border-transparent p-2 text-primary-foreground/70 transition-all hover:border-danger/30 hover:bg-danger/20 hover:text-primary-foreground" title="Close Whiteboard" aria-label="Close whiteboard">
                        <X size={20} />
                    </button>
                </div>

                {/* Canvas */}
                <div className="flex-1 relative cursor-crosshair">
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full touch-none"
                        onMouseDown={handleStart}
                        onMouseMove={handleMove}
                        onMouseUp={handleEnd}
                        onMouseLeave={handleEnd}
                        onTouchStart={handleStart}
                        onTouchMove={handleMove}
                        onTouchEnd={handleEnd}
                    />
                </div>
            </div>
        </div>
    );
}

function resolveCssColor(value: string) {
    if (!value.startsWith("--")) return value;
    if (typeof window === "undefined") return value;
    return getComputedStyle(document.documentElement).getPropertyValue(value).trim() || value;
}
