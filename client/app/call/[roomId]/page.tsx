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
import { Video, Clock, Users, Share2, Shield, Loader2, Sparkles, PenTool, Lock } from "lucide-react";
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
        // Throttle: at most once every 30 seconds
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
            // Collect all available streams
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

    if (callState === "joining") {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
                <Loader2 className="animate-spin text-primary" size={48} />
                <p className="text-xl font-medium text-foreground animate-pulse">Joining Meeting...</p>
            </div>
        );
    }

    if (callState === "error") {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background gap-4 p-6 text-center">
                <div className="bg-destructive/10 p-6 rounded-full text-destructive mb-4">
                    <Users size={64} />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Connection Failed</h1>
                <p className="text-muted-foreground max-w-sm">
                    {errorMessage || "We couldn't establish a connection to the meeting."}
                </p>
                <button
                    onClick={() => window.location.href = "/"}
                    className="mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all"
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
        <div className={`h-screen ${theme.bgClass} text-foreground flex flex-col overflow-hidden relative`}>
            {/* ── Header ── */}
            <header className="sync-surface-strong z-50 flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-8">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
                        <Video className="text-primary" size={22} />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="font-bold text-base sm:text-lg leading-tight text-foreground">SyncHub Meeting</h1>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">#{roomId.slice(0, 8)}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isRecording && (
                        <div className="flex items-center gap-2 rounded-full border border-live/30 bg-live/10 px-3 py-1.5">
                            <div className="h-2 w-2 rounded-full bg-live animate-pulse" />
                            <span className="text-xs font-bold text-live">REC</span>
                        </div>
                    )}
                    <div className="hidden items-center gap-4 rounded-full border border-border bg-card/60 px-4 py-1.5 md:flex">
                        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                            <Clock size={14} className="text-primary" />
                            <span>{formatTime(time)}</span>
                        </div>
                    </div>

                    {/* E2E badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${isE2EReady
                        ? 'bg-success/10 border-success/30 text-success'
                        : 'bg-card/60 border-border text-muted-foreground'
                        }`} title={isE2EReady ? 'End-to-end encrypted' : 'Establishing encryption...'}>
                        <Lock size={12} />
                        <span className="hidden sm:inline">{isE2EReady ? 'E2E' : '...'}</span>
                    </div>

                    <CallThemeSwitcher currentThemeId={theme.id} onSelect={setTheme} />

                    <button
                        onClick={() => setShowShare(true)}
                        className="flex items-center gap-1.5 rounded-xl border border-border bg-card/60 px-4 py-2 text-sm font-semibold text-foreground transition-all hover:bg-accent"
                        title="Invite Participant"
                    >
                        <Share2 size={16} />
                        <span className="hidden sm:inline">Invite</span>
                    </button>

                    {/* AI Summary button — also starts transcription */}
                    <button
                        onClick={handleAIClick}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${isTranscribing
                            ? 'bg-ai/20 border-ai/40 text-ai'
                            : 'bg-ai/10 border-ai/20 text-ai'
                            } hover:bg-ai/20`}
                        title={isTranscribing ? 'AI Listening — Click for Summary' : 'Start AI — Click to begin listening'}
                    >
                        {isTranscribing && <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                        <Sparkles size={16} />
                        <span className="hidden sm:inline">{isTranscribing ? 'AI On' : 'AI'}</span>
                    </button>

                    {/* Whiteboard button */}
                    <button
                        onClick={() => setShowWhiteboard(prev => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${showWhiteboard
                            ? 'bg-warning/20 border-warning/40 text-warning'
                            : 'bg-card/60 border-border text-foreground hover:bg-accent'
                            }`}
                        title="Whiteboard"
                    >
                        <PenTool size={16} />
                        <span className="hidden sm:inline">Board</span>
                    </button>
                </div>
            </header>

            {/* ── Main Content ── */}
            <div className="flex-1 flex overflow-hidden">
                {/* Video area */}
                <main className={`flex-1 flex flex-col p-3 sm:p-4 md:p-6 overflow-hidden relative transition-all duration-300 ${showChat ? 'mr-0' : ''}`}>
                    {/* Error Toast */}
                    {errorMessage && (
                        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100]">
                            <div className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger px-6 py-3 text-danger-foreground shadow-soft">
                                <Shield size={20} />
                                <span className="text-sm font-bold">{errorMessage}</span>
                                <button onClick={() => window.location.reload()} className="ml-2 underline text-xs font-black">Reload</button>
                            </div>
                        </div>
                    )}

                    {/* Remote Recording Notification */}
                    {remoteRecording && (
                        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-5 duration-300">
                            <div className="flex items-center gap-3 rounded-2xl border border-live/30 bg-card/90 px-5 py-2.5 shadow-soft backdrop-blur">
                                <div className="h-2.5 w-2.5 rounded-full bg-live animate-pulse" />
                                <span className="text-sm font-bold text-live">
                                    {remoteRecording.recorder} is recording this meeting
                                </span>
                            </div>
                        </div>
                    )}
                    {/* ── Video Grid ── */}
                    <div className="flex-1 min-h-0 relative">
                        <div className={`h-full w-full grid gap-4 md:gap-6 ${remoteStream ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
                            {remoteStream ? (
                                <div className="h-full min-h-0">
                                    <VideoPlayer stream={remoteStream} label="Remote Participant" isScreenShare={remoteIsScreenSharing} isMuted={remoteIsAudioMuted} isVideoOff={remoteIsVideoOff} />
                                </div>
                            ) : (
                                <div className="signal-grid relative flex h-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-card/70">
                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                                        <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 backdrop-blur">
                                            <Users size={14} className="text-primary" />
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Waiting for participant...</span>
                                        </div>
                                    </div>
                                    <div className="z-10 rounded-full border border-border bg-muted p-8 text-muted-foreground">
                                        <Users size={48} />
                                    </div>
                                </div>
                            )}

                            <div className={remoteStream ? "h-full min-h-0" : "absolute bottom-4 right-4 w-48 sm:w-64 md:w-80 h-auto aspect-video z-20"}>
                                <VideoPlayer
                                    stream={localStream}
                                    label="You"
                                    isLocal
                                    isMuted={isAudioMuted}
                                    isVideoOff={isVideoOff}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="h-20 shrink-0" />

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
                        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[90%] pointer-events-none animate-in fade-in duration-200">
                            <div className="rounded-2xl bg-foreground/80 px-6 py-3 text-center text-background shadow-soft backdrop-blur-sm">
                                <p className="text-sm sm:text-base font-medium leading-relaxed">{currentText}</p>
                            </div>
                        </div>
                    )}

                    {callState === "disconnected" && (
                        <div className="fixed top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-danger-foreground shadow-soft animate-in fade-in slide-in-from-top-2">
                            Connection Interrupted
                        </div>
                    )}
                </main>

                {/* Chat Panel — full overlay on mobile, sidebar on desktop */}
                {showChat && (
                    <>
                        {/* Mobile backdrop */}
                        <div
                            className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-sm md:hidden"
                            onClick={toggleChat}
                        />
                        <div className="fixed inset-0 z-50 md:relative md:inset-auto md:z-auto md:w-80 md:shrink-0 md:h-full md:border-l md:border-border animate-in slide-in-from-right-10 duration-300">
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
