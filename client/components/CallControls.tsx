"use client";

import { useEffect, useRef, useState } from "react";
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    ScreenShare,
    MessageSquare,
    Circle,
    Subtitles,
} from "lucide-react";
import { VirtualBackgroundSelector } from "./VirtualBackgroundSelector";
import { BackgroundMode } from "@/hooks/use-virtual-background";

interface CallControlsProps {
    isAudioMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing?: boolean;
    isRecording?: boolean;
    isCaptionsOn?: boolean;
    unreadCount?: number;
    bgMode?: BackgroundMode;
    bgUrl?: string;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onToggleScreenShare?: () => void;
    onToggleChat?: () => void;
    onToggleRecording?: () => void;
    onToggleCaptions?: () => void;
    onSelectBg?: (mode: BackgroundMode, url?: string) => void;
    onEndCall: () => void;
}

export function CallControls({
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    isRecording,
    isCaptionsOn,
    unreadCount = 0,
    bgMode = "none",
    bgUrl = "",
    onToggleAudio,
    onToggleVideo,
    onToggleScreenShare,
    onToggleChat,
    onToggleRecording,
    onToggleCaptions,
    onSelectBg,
    onEndCall,
}: CallControlsProps) {
    /* ── Auto-hide: 3s inactivity → opacity 0.3 ── */
    const [dockOpacity, setDockOpacity] = useState(1);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const resetTimer = () => {
            setDockOpacity(1);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setDockOpacity(0.3), 3000);
        };

        resetTimer();
        window.addEventListener("mousemove", resetTimer);
        window.addEventListener("touchstart", resetTimer);

        return () => {
            window.removeEventListener("mousemove", resetTimer);
            window.removeEventListener("touchstart", resetTimer);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const btn = (active: boolean) =>
        `call-dock-btn ${active ? "call-dock-btn-active" : ""}`;

    return (
        <div
            className="call-dock"
            style={{ opacity: dockOpacity }}
            onMouseEnter={() => setDockOpacity(1)}
        >
            {/* Mute */}
            <button
                onClick={onToggleAudio}
                className={btn(isAudioMuted)}
                title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
                aria-label={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
            >
                {isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Camera */}
            <button
                onClick={onToggleVideo}
                className={btn(isVideoOff)}
                title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
            >
                {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
            </button>

            {/* Virtual Background */}
            {onSelectBg && (
                <VirtualBackgroundSelector
                    currentMode={bgMode}
                    currentUrl={bgUrl}
                    onSelect={onSelectBg}
                />
            )}

            {/* Screen Share */}
            {onToggleScreenShare && (
                <button
                    onClick={onToggleScreenShare}
                    className={btn(!!isScreenSharing)}
                    title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                    aria-label={isScreenSharing ? "Stop screen sharing" : "Share screen"}
                >
                    <ScreenShare size={18} />
                </button>
            )}

            <div className="call-dock-sep" />

            {/* Chat */}
            {onToggleChat && (
                <button
                    onClick={onToggleChat}
                    className="call-dock-btn"
                    title="Chat"
                    aria-label="Open meeting chat"
                >
                    <MessageSquare size={18} />
                    {unreadCount > 0 && (
                        <span className="call-dock-badge">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Record */}
            {onToggleRecording && (
                <button
                    onClick={onToggleRecording}
                    className={btn(!!isRecording)}
                    title={isRecording ? "Stop Recording" : "Start Recording"}
                    aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                    <Circle
                        size={18}
                        className={isRecording ? "fill-current" : ""}
                    />
                </button>
            )}

            {/* Captions */}
            {onToggleCaptions && (
                <button
                    onClick={onToggleCaptions}
                    className={btn(!!isCaptionsOn)}
                    title={isCaptionsOn ? "Turn Off Captions" : "Turn On Captions"}
                    aria-label={isCaptionsOn ? "Turn captions off" : "Turn captions on"}
                >
                    <Subtitles size={18} />
                </button>
            )}

            <div className="call-dock-sep" />

            {/* Leave */}
            <button
                onClick={onEndCall}
                className="call-dock-btn call-dock-leave"
                title="Leave Meeting"
                aria-label="Leave meeting"
            >
                <PhoneOff size={18} />
                <span className="hidden md:inline">Leave</span>
            </button>
        </div>
    );
}
