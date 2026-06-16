"use client";

import { useWebRTC } from "@/hooks/use-webrtc";
import { useRecording } from "@/hooks/use-recording";
import { useTranscription } from "@/hooks/use-transcription";
import { useActionItems } from "@/hooks/use-action-items";
import { useEncryption } from "@/hooks/use-encryption";
import { VideoPlayer } from "@/components/VideoPlayer";
import { CallControls } from "@/components/CallControls";
import { ShareDialog } from "@/components/ShareDialog";
import { ChatPanel } from "@/components/ChatPanel";
import { MeetingSummaryModal } from "@/components/MeetingSummaryModal";
import { EmojiReactions } from "@/components/EmojiReactions";
import { Whiteboard } from "@/components/Whiteboard";
import { CallThemeSwitcher, useCallTheme } from "@/components/CallThemeSwitcher";
import { useState, useEffect, useCallback, useRef, use } from "react";
import {
    ArrowLeft,
    Copy,
    Loader2,
    PenTool,
    Settings,
    Share2,
    Shield,
    Sparkles,
    Users,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function CallPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);
    const {
        callState,
        localStream,
        remoteStream,
        remoteIsScreenSharing,
        remoteIsAudioMuted,
        remoteIsVideoOff,
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        errorMessage,
        chatMessages,
        remoteRecording,
        incomingReaction,
        incomingDrawPoint,
        incomingClear,
        sendChatMessage,
        sendReaction,
        sendWhiteboardDraw,
        sendWhiteboardClear,
        sendE2EPublicKey,
        incomingE2EKey,
        actionItems: serverActionItems,
        sendSignal,
        endCall,
        bgMode,
        bgUrl,
        setVirtualBackground,
    } = useWebRTC(roomId);

    const { isRecording, startRecording, stopRecording } = useRecording(roomId, "You");
    const { isTranscribing, isSupported: speechSupported, transcript, currentText, startTranscription, stopTranscription, getRecentTranscript, getFullTranscript } = useTranscription();
    const { isE2EReady, publicKeyJwk, initKeys, deriveSharedKey } = useEncryption();

    const [time, setTime] = useState(0);
    const [inviteCode, setInviteCode] = useState<string | undefined>();
    const [showShare, setShowShare] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showSummary, setShowSummary] = useState(false);
    const [showCaptions, setShowCaptions] = useState(false);
    const [showWhiteboard, setShowWhiteboard] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [copied, setCopied] = useState(false);
    const lastSuggestTime = useRef(0);
    const fullTranscript = getFullTranscript();
    const actionItemsState = useActionItems({
        roomId,
        transcript: fullTranscript,
        isActive: callState === "connected",
        serverItems: serverActionItems,
    });
    const { theme, setTheme } = useCallTheme();

    useEffect(() => {
        const timer = setInterval(() => setTime(prev => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // E2E: init keys when connected, send public key
    useEffect(() => {
        if (callState === "connected") {
            initKeys().then(jwk => {
                if (jwk) sendE2EPublicKey(jwk);
            });
        }
    }, [callState]); // eslint-disable-line react-hooks/exhaustive-deps

    // E2E: derive shared key when receiving remote public key
    useEffect(() => {
        if (incomingE2EKey) {
            deriveSharedKey(incomingE2EKey);
            // Also send our key back so both sides can derive
            if (publicKeyJwk) sendE2EPublicKey(publicKeyJwk);
        }
    }, [incomingE2EKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        apiRequest(`/rooms/${roomId}`, undefined, "GET")
            .then((room) => setInviteCode(room.inviteCode))
            .catch(() => { });
    }, [roomId]);

    // Track unread messages when chat is closed
    useEffect(() => {
        if (!showChat && chatMessages.length > 0) {
            const lastMsg = chatMessages[chatMessages.length - 1];
            if (!lastMsg.isLocal) {
                const timeoutId = window.setTimeout(() => setUnreadCount(prev => prev + 1), 0);
                return () => window.clearTimeout(timeoutId);
            }
        }
    }, [chatMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleChat = () => {
        setShowChat(prev => !prev);
        if (!showChat) setUnreadCount(0);
    };

    // Start transcription from user gesture (required by browsers)
    const ensureTranscription = useCallback(() => {
        if (!isTranscribing && speechSupported) {
            startTranscription("You");
        }
    }, [isTranscribing, speechSupported, startTranscription]);

    const toggleCaptions = useCallback(() => {
        if (!showCaptions) ensureTranscription();
        setShowCaptions(prev => !prev);
    }, [showCaptions, ensureTranscription]);

    const fetchSuggestions = useCallback(async () => {
        if (loadingSuggestions) return;
        const now = Date.now();
        if (now - lastSuggestTime.current < 30000) return;
        lastSuggestTime.current = now;
        const recentText = getRecentTranscript(8);
        if (!recentText) return;
        setLoadingSuggestions(true);
        try {
            const data = await apiRequest("/ai/suggest", {
                transcript: recentText,
                lastSpeaker: transcript.length > 0 ? transcript[transcript.length - 1].speaker : "Unknown",
            }, "POST");
            setSuggestions(data.suggestions || []);
        } catch {
            setSuggestions([]);
        }
        setLoadingSuggestions(false);
    }, [loadingSuggestions, getRecentTranscript, transcript]);

    // Auto-fetch suggestions when new transcript entries come in (throttled)
    useEffect(() => {
        if (transcript.length > 0 && transcript.length % 5 === 0) {
            const timeoutId = window.setTimeout(fetchSuggestions, 0);
            return () => window.clearTimeout(timeoutId);
        }
    }, [transcript.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle AI suggest click — ensure transcription is running first
    const handleRequestSuggestions = useCallback(() => {
        ensureTranscription();
        fetchSuggestions();
    }, [ensureTranscription, fetchSuggestions]);

    // Handle AI button click — start transcription + open modal
    const handleAIClick = useCallback(() => {
        ensureTranscription();
        setShowSummary(true);
    }, [ensureTranscription]);

    // ── Canvas Composite Recording ──
    const handleToggleRecording = () => {
        if (isRecording) {
            stopRecording();
            sendSignal({ type: "recording-status", isRecording: false });
        } else {
            const streams: { stream: MediaStream; label: string }[] = [];
            if (localStream) streams.push({ stream: localStream, label: "You" });
            if (remoteStream) streams.push({ stream: remoteStream, label: "Remote" });
            startRecording(streams);
            sendSignal({ type: "recording-status", isRecording: true });
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const copyInviteLink = () => {
        const link = `${window.location.origin}/call/${roomId}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (callState === "joining") {
        return (
            <div className="call-room items-center justify-center">
                <Loader2 className="animate-spin text-[#00d9f5]" size={40} />
                <p className="mt-4 call-waiting-text">Joining meeting…</p>
            </div>
        );
    }

    if (callState === "error") {
        return (
            <div className="call-room items-center justify-center gap-4 p-6 text-center">
                <div className="rounded-full bg-[#f5223a]/10 p-6 mb-4">
                    <Users size={48} className="text-[#f5223a]" />
                </div>
                <h1 className="text-xl font-semibold text-[#f1f1f3]">Connection Failed</h1>
                <p className="text-sm text-[#8b8b9a] max-w-sm">
                    {errorMessage || "We couldn't establish a connection to the meeting."}
                </p>
                <button
                    onClick={() => window.location.href = "/"}
                    className="mt-4 px-5 py-2.5 rounded-lg bg-[#00d9f5] text-[#060608] text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    Return to Home
                </button>
            </div>
        );
    }

    const leaveRoom = async () => {
        if (isRecording) stopRecording();
        if (isTranscribing) stopTranscription();
        try {
            await apiRequest(`/rooms/${roomId}/end`, {
                transcript: getFullTranscript(),
                duration: formatTime(time),
                participantCount: 2,
            }, "POST");
        } catch {
            // Participants may not be allowed to end the room; local hangup still proceeds.
        }
        endCall();
        window.location.href = "/";
    };

    return (
        <div className="call-room">
            {/* ── Header — 52px ── */}
            <header className="call-header">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        className="call-header-exit"
                        onClick={() => { window.location.href = "/"; }}
                    >
                        <ArrowLeft size={14} />
                        Exit
                    </button>

                    <span className="call-header-room-id hidden sm:inline">
                        #{roomId.slice(0, 8)}
                    </span>

                    {isE2EReady && (
                        <span className="call-header-e2e">
                            <span className="call-header-e2e-dot" />
                            E2E
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="call-header-timer hidden sm:inline">
                        {formatTime(time)}
                    </span>

                    {isRecording && (
                        <span className="call-header-rec">● REC</span>
                    )}

                    <CallThemeSwitcher currentThemeId={theme.id} onSelect={setTheme} />

                    <button
                        type="button"
                        className="call-header-ghost-btn"
                        onClick={() => setShowShare(true)}
                        title="Invite"
                    >
                        <Share2 size={14} />
                        <span className="hidden sm:inline">Invite</span>
                    </button>

                    <button
                        type="button"
                        className={`call-header-ghost-btn ${isTranscribing ? "active" : ""}`}
                        onClick={handleAIClick}
                        title="AI Summary"
                    >
                        <Sparkles size={14} />
                        <span className="hidden sm:inline">AI</span>
                    </button>

                    <button
                        type="button"
                        className={`call-header-ghost-btn ${showWhiteboard ? "active" : ""}`}
                        onClick={() => setShowWhiteboard(prev => !prev)}
                        title="Whiteboard"
                    >
                        <PenTool size={14} />
                        <span className="hidden sm:inline">Board</span>
                    </button>
                </div>
            </header>

            {/* ── Main Content ── */}
            <div className="flex-1 flex overflow-hidden">
                <main className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden relative">
                    {/* Error Toast */}
                    {errorMessage && (
                        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100]">
                            <div className="flex items-center gap-3 rounded-lg border border-[#f5223a]/30 bg-[#f5223a] px-5 py-2.5 text-white text-sm font-medium">
                                <Shield size={16} />
                                {errorMessage}
                                <button onClick={() => window.location.reload()} className="ml-2 underline text-xs font-bold">Reload</button>
                            </div>
                        </div>
                    )}

                    {/* Remote Recording Notification */}
                    {remoteRecording && (
                        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100]">
                            <div className="call-header-rec gap-2 px-4 py-1.5 text-xs">
                                ● {remoteRecording.recorder} is recording
                            </div>
                        </div>
                    )}

                    {/* ── Video Grid ── */}
                    <div className="flex-1 min-h-0 relative">
                        {remoteStream ? (
                            /* Connected: 2-column grid */
                            <div className="h-full w-full grid gap-3 grid-cols-1 lg:grid-cols-2 auto-rows-fr">
                                <div className="min-h-0">
                                    <VideoPlayer
                                        stream={remoteStream}
                                        label="Remote Participant"
                                        isScreenShare={remoteIsScreenSharing}
                                        isMuted={remoteIsAudioMuted}
                                        isVideoOff={remoteIsVideoOff}
                                    />
                                </div>
                                <div className="min-h-0">
                                    <VideoPlayer
                                        stream={localStream}
                                        label="You"
                                        isLocal
                                        isMuted={isAudioMuted}
                                        isVideoOff={isVideoOff}
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Unpeered: Waiting state with PiP */
                            <div className="h-full w-full relative flex items-center justify-center">
                                <div className="call-waiting-bg" aria-hidden />

                                <div className="call-waiting-card">
                                    <div className="call-waiting-ring">
                                        <div className="call-waiting-ring-inner" />
                                        <div className="call-waiting-ring-outer" />
                                    </div>
                                    <p className="call-waiting-text">
                                        Waiting for someone to join
                                    </p>
                                    <button
                                        type="button"
                                        className="call-waiting-link"
                                        onClick={copyInviteLink}
                                    >
                                        <Copy size={12} />
                                        {copied
                                            ? "Copied!"
                                            : `${typeof window !== "undefined" ? window.location.origin : ""}/call/${roomId.slice(0, 8)}…`}
                                    </button>
                                </div>

                                {/* Local PiP thumbnail */}
                                <div className="absolute bottom-4 right-4 w-44 sm:w-56 aspect-video z-20">
                                    <VideoPlayer
                                        stream={localStream}
                                        label="You"
                                        isLocal
                                        isMuted={isAudioMuted}
                                        isVideoOff={isVideoOff}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom spacer for dock */}
                    <div className="h-20 shrink-0" />

                    {/* Controls dock */}
                    <CallControls
                        isAudioMuted={isAudioMuted}
                        isVideoOff={isVideoOff}
                        isScreenSharing={isScreenSharing}
                        isRecording={isRecording}
                        isCaptionsOn={showCaptions}
                        unreadCount={unreadCount}
                        bgMode={bgMode}
                        bgUrl={bgUrl}
                        onToggleAudio={toggleAudio}
                        onToggleVideo={toggleVideo}
                        onToggleScreenShare={toggleScreenShare}
                        onToggleChat={toggleChat}
                        onToggleRecording={handleToggleRecording}
                        onToggleCaptions={toggleCaptions}
                        onSelectBg={setVirtualBackground}
                        onEndCall={leaveRoom}
                    />

                    {/* Live Captions Overlay */}
                    {showCaptions && currentText && (
                        <div className="call-caption">
                            <p className="call-caption-text">{currentText}</p>
                        </div>
                    )}

                    {callState === "disconnected" && (
                        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#f5223a] px-4 py-2 text-sm font-semibold text-white">
                            Connection Interrupted
                        </div>
                    )}
                </main>

                {/* Chat Panel — full overlay on mobile, sidebar on desktop */}
                {showChat && (
                    <>
                        <div
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                            onClick={toggleChat}
                        />
                        <div className="fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:w-80 md:shrink-0 md:h-full md:border-l md:border-[rgb(255_255_255/0.06)]">
                            <ChatPanel
                                messages={chatMessages}
                                onSend={sendChatMessage}
                                onClose={toggleChat}
                                localUsername="You"
                                suggestions={suggestions}
                                loadingSuggestions={loadingSuggestions}
                                onRequestSuggestions={handleRequestSuggestions}
                                currentTranscript={currentText}
                                actionItems={actionItemsState.items}
                                actionItemsLoading={actionItemsState.isLoading}
                                onExportActionItems={actionItemsState.exportMarkdown}
                            />
                        </div>
                    </>
                )}
            </div>

            {inviteCode && (
                <ShareDialog
                    isOpen={showShare}
                    onClose={() => setShowShare(false)}
                    roomId={roomId}
                    inviteCode={inviteCode}
                />
            )}

            <EmojiReactions
                onSendReaction={sendReaction}
                incomingReaction={incomingReaction}
            />

            <MeetingSummaryModal
                isOpen={showSummary}
                onClose={() => setShowSummary(false)}
                transcript={getFullTranscript()}
                duration={formatTime(time)}
                participantCount={2}
                actionItems={actionItemsState.items}
            />

            <Whiteboard
                isOpen={showWhiteboard}
                onClose={() => setShowWhiteboard(false)}
                onDraw={sendWhiteboardDraw}
                onClear={sendWhiteboardClear}
                incomingDraw={incomingDrawPoint}
                incomingClear={incomingClear}
            />
        </div>
    );
}
