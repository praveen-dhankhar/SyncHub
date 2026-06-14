"use client";

import { useEffect, useRef } from "react";

interface VideoPlayerProps {
    stream: MediaStream | null;
    label: string;
    isLocal?: boolean;
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenShare?: boolean;
    backgroundClass?: string;
}

export function VideoPlayer({ stream, label, isLocal = false, isMuted = false, isVideoOff = false, isScreenShare = false, backgroundClass }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className={`video-container group relative h-full w-full overflow-hidden rounded-2xl border shadow-soft transition-all duration-300 hover:ring-2 hover:ring-ring/40 md:rounded-3xl ${backgroundClass || 'border-border bg-card/70'}`}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className={`h-full w-full ${isScreenShare ? 'bg-foreground object-contain' : 'object-cover'} transition-transform duration-700 ${isScreenShare ? '' : 'group-hover:scale-[1.01]'} ${isVideoOff ? 'hidden' : ''}`}
            />

            {/* Camera off overlay */}
            {isVideoOff && (
                <div className="signal-grid absolute inset-0 flex items-center justify-center bg-muted/70">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-soft md:h-20 md:w-20">
                        <span className="text-xl font-bold uppercase md:text-2xl">
                            {label.charAt(0)}
                        </span>
                    </div>
                </div>
            )}

            {/* Glass Overlay for depth */}
            {!isVideoOff && (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-foreground/20 opacity-60" />
            )}

            {/* Label Overlay — compact */}
            <div className="video-label absolute bottom-2 left-2 z-10">
                <div className="flex items-center gap-1.5 rounded-lg border border-background/20 bg-foreground/60 px-2 py-1 text-background backdrop-blur-md">
                    <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${isMuted ? 'bg-danger' : isLocal ? 'bg-primary' : 'bg-success'}`} />
                    <span className="max-w-[80px] truncate text-[10px] font-semibold sm:max-w-[140px] sm:text-xs">
                        {label}{isLocal && " (You)"}
                    </span>
                </div>
            </div>

            {/* Mute Indicator — compact top-right badges */}
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                {isMuted && (
                    <div className="rounded-lg bg-danger/90 p-1 text-danger-foreground backdrop-blur-sm sm:p-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="1" y1="1" x2="23" y2="23" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.35 2.18" />
                            <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    </div>
                )}
                {isVideoOff && (
                    <div className="rounded-lg bg-danger/90 p-1 text-danger-foreground backdrop-blur-sm sm:p-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="1" y1="1" x2="23" y2="23" />
                            <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Subtle highlight edge */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl border border-background/10 md:rounded-3xl" />
        </div>
    );
}
