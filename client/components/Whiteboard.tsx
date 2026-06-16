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

    const fillBg = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.fillStyle = resolveCssColor("--whiteboard-bg");
        ctx.fillRect(0, 0, w, h);

        // Grid lines
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
    }, []);

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
        }
    }, []);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        const rect = canvas.getBoundingClientRect();
        fillBg(ctx, rect.width, rect.height);
    }, [fillBg]);

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
    }, [fillBg, isOpen]);

    useEffect(() => {
        if (!incomingDraw) return;
        drawPoint(incomingDraw);
    }, [drawPoint, incomingDraw]);

    useEffect(() => {
        if (incomingClear) clearCanvas();
    }, [clearCanvas, incomingClear]);

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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgb(6_6_8/0.7)] p-3 backdrop-blur-[20px] sm:p-6">
            <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[rgb(255_255_255/0.06)] shadow-2xl" style={{ backgroundColor: "var(--whiteboard-bg)" }}>
                {/* ── Floating Toolbar ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(255_255_255/0.06)]" style={{ backgroundColor: "#111115" }}>
                    <div className="flex items-center gap-4 flex-wrap">
                        <h3 className="text-[#f1f1f3] font-medium text-sm flex items-center gap-2">
                            Whiteboard
                        </h3>
                        <div className="w-px h-5 bg-[rgb(255_255_255/0.06)]" />

                        {/* Tools */}
                        <div className="flex items-center rounded-lg p-1 gap-1 border border-[rgb(255_255_255/0.06)] bg-[rgb(255_255_255/0.03)]">
                            <button
                                onClick={() => setTool("pen")}
                                className={`p-1.5 rounded-md transition-all ${tool === "pen" ? "bg-[#00d9f5] text-[#060608]" : "text-[#8b8b9a] hover:text-[#f1f1f3] hover:bg-[rgb(255_255_255/0.06)]"}`}
                                title="Pen"
                            >
                                <Pencil size={16} />
                            </button>
                            <button
                                onClick={() => setTool("eraser")}
                                className={`p-1.5 rounded-md transition-all ${tool === "eraser" ? "bg-[#00d9f5] text-[#060608]" : "text-[#8b8b9a] hover:text-[#f1f1f3] hover:bg-[rgb(255_255_255/0.06)]"}`}
                                title="Eraser"
                            >
                                <Eraser size={16} />
                            </button>
                        </div>

                        {/* Color swatches — 8 circular */}
                        <div className="flex items-center gap-2">
                            {COLORS.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => { setColor(c); setTool("pen"); }}
                                    className={`h-5 w-5 rounded-full border transition-all ${color === c && tool === "pen"
                                        ? "scale-110 ring-2 ring-[#00d9f5] ring-offset-2 ring-offset-[#111115]"
                                        : "border-[rgb(255_255_255/0.1)] opacity-80 hover:opacity-100"
                                        }`}
                                    style={{ backgroundColor: `var(${c})` }}
                                    aria-label={`Select ${c.replace("--wb-ink-", "ink ")} color`}
                                />
                            ))}
                        </div>

                        <div className="w-px h-5 bg-[rgb(255_255_255/0.06)] hidden sm:block" />

                        {/* Line width */}
                        <div className="hidden sm:flex items-center gap-2 border border-[rgb(255_255_255/0.06)] bg-[rgb(255_255_255/0.03)] rounded-lg px-2 py-1">
                            <button onClick={() => setLineWidth(Math.max(1, lineWidth - 1))} className="text-[#8b8b9a] hover:text-[#f1f1f3] transition-colors p-1">
                                <Minus size={14} />
                            </button>
                            <div className="flex items-center justify-center w-6">
                                <div className="rounded-full bg-[#f1f1f3]" style={{ width: `${Math.min(lineWidth * 2, 16)}px`, height: `${Math.min(lineWidth * 2, 16)}px` }} />
                            </div>
                            <button onClick={() => setLineWidth(Math.min(20, lineWidth + 1))} className="text-[#8b8b9a] hover:text-[#f1f1f3] transition-colors p-1">
                                <Plus size={14} />
                            </button>
                        </div>

                        <div className="w-px h-5 bg-[rgb(255_255_255/0.06)] hidden sm:block" />

                        {/* Clear */}
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#f5223a] border border-transparent hover:border-[#f5223a]/20 hover:bg-[#f5223a]/10 transition-all"
                        >
                            <Trash2 size={14} />
                            Clear
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-lg border border-transparent p-2 text-[#8b8b9a] transition-all hover:border-[#f5223a]/30 hover:bg-[#f5223a]/10 hover:text-[#f1f1f3]"
                        title="Close Whiteboard"
                        aria-label="Close whiteboard"
                    >
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
