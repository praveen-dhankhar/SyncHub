"use client";

import { Mic, MicOff, Video, VideoOff, PhoneOff, ScreenShare, MessageSquare, Circle, Subtitles } from "lucide-react";
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
    const baseButton = "grid shrink-0 place-items-center rounded-xl border p-3 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:p-3.5";
    const idleButton = "border-border bg-card/60 text-foreground hover:bg-accent";
    const activeButton = "border-primary/30 bg-primary text-primary-foreground shadow-signal hover:bg-primary/90";
    const dangerButton = "border-danger/30 bg-danger text-danger-foreground hover:bg-danger/90";

    return (
        <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-card/80 px-3 py-3 shadow-soft backdrop-blur-2xl animate-in slide-in-from-bottom-6 duration-300 sm:bottom-8 sm:gap-3 sm:px-5">
            {/* Audio Toggle */}
            <button
                onClick={onToggleAudio}
                className={`${baseButton} ${isAudioMuted ? dangerButton : idleButton}`}
                title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
                aria-label={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
            >
                {isAudioMuted ? <MicOff size={18} className="sm:w-5 sm:h-5" /> : <Mic size={18} className="sm:w-5 sm:h-5" />}
            </button>

            {/* Video Toggle */}
            <button
                onClick={onToggleVideo}
                className={`${baseButton} ${isVideoOff ? dangerButton : idleButton}`}
                title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
            >
                {isVideoOff ? <VideoOff size={18} className="sm:w-5 sm:h-5" /> : <Video size={18} className="sm:w-5 sm:h-5" />}
            </button>

            {/* Virtual Background */}
            {onSelectBg && (
                <VirtualBackgroundSelector currentMode={bgMode} currentUrl={bgUrl} onSelect={onSelectBg} />
            )}

            <div className="w-px h-8 bg-border hidden sm:block mx-1" />

            {/* Screen Share */}
            <button
                onClick={onToggleScreenShare}
                className={`${baseButton} ${isScreenSharing ? activeButton : idleButton}`}
                title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
                aria-label={isScreenSharing ? "Stop screen sharing" : "Share screen"}
            >
                <ScreenShare size={18} className="sm:w-5 sm:h-5" />
            </button>

            {/* Chat Button */}
            <button
                onClick={onToggleChat}
                className={`${baseButton} ${idleButton} relative`}
                title="Chat"
                aria-label="Open meeting sidebar"
            >
                <MessageSquare size={18} className="sm:w-5 sm:h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-live text-[9px] font-bold text-live-foreground animate-in zoom-in-50">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Record Button */}
            <button
                onClick={onToggleRecording}
                className={`${baseButton} ${isRecording ? "border-live/30 bg-live text-live-foreground hover:bg-live/90" : idleButton}`}
                title={isRecording ? "Stop Recording" : "Start Recording"}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
                <Circle size={18} className={`sm:w-5 sm:h-5 ${isRecording ? "fill-current animate-pulse" : ""}`} />
            </button>

            {/* Captions Button */}
            {onToggleCaptions && (
                <button
                    onClick={onToggleCaptions}
                    className={`${baseButton} ${isCaptionsOn ? activeButton : idleButton}`}
                    title={isCaptionsOn ? "Turn Off Captions" : "Turn On Captions"}
                    aria-label={isCaptionsOn ? "Turn captions off" : "Turn captions on"}
                >
                    <Subtitles size={18} className="sm:w-5 sm:h-5" />
                </button>
            )}

            <button
                onClick={onEndCall}
                className="group flex shrink-0 items-center gap-2 rounded-xl border border-danger/30 bg-danger px-4 py-3 font-bold text-danger-foreground shadow-soft transition-all hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-5 sm:py-3.5"
                title="Leave Meeting"
                aria-label="Leave meeting"
            >
                <PhoneOff size={18} className="sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
                <span className="hidden md:inline text-sm">Leave</span>
            </button>
        </div>
    );
}
