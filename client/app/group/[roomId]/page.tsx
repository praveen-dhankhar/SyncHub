"use client";

import { useGroupWebRTC } from "@/hooks/use-group-webrtc";
import { useRecording } from "@/hooks/use-recording";
import { useTranscription } from "@/hooks/use-transcription";
import { useActionItems } from "@/hooks/use-action-items";
import { useEncryption } from "@/hooks/use-encryption";
import { VideoPlayer } from "@/components/VideoPlayer";
import { CallControls } from "@/components/CallControls";
import { ParticipantList } from "@/components/ParticipantList";
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
    LayoutGrid,
    Loader2,
    Maximize,
    PenTool,
    Share2,
    Shield,
    Sparkles,
    UserRound,
    Users,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

type ViewMode = "gallery" | "speaker";

export default function GroupCallPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);
    const {
        callState,
        localStream,
        remotePeers,
        participantCount,
        localUsername,
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
    } = useGroupWebRTC(roomId);

    const { isRecording, startRecording, stopRecording } = useRecording(roomId, localUsername);
    const { isTranscribing, isSupported: speechSupported, transcript, currentText, startTranscription, stopTranscription, getRecentTranscript, getFullTranscript } = useTranscription();
    const { isE2EReady, publicKeyJwk, initKeys, deriveSharedKey } = useEncryption();

    const [time, setTime] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("gallery");
    const [showParticipants, setShowParticipants] = useState(false);
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
        const timer = setInterval(() => setTime((p) => p + 1), 1000);
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
            if (publicKeyJwk) sendE2EPublicKey(publicKeyJwk);
        }
    }, [incomingE2EKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        apiRequest(`/rooms/${roomId}`, undefined, "GET")
            .then((room) => setInviteCode(room.inviteCode))
            .catch(() => { });
    }, [roomId]);

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

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

    const ensureTranscription = useCallback(() => {
        if (!isTranscribing && speechSupported) {
            startTranscription(localUsername || "You");
        }
    }, [isTranscribing, speechSupported, startTranscription, localUsername]);

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

    useEffect(() => {
        if (transcript.length > 0 && transcript.length % 5 === 0) {
            const timeoutId = window.setTimeout(fetchSuggestions, 0);
            return () => window.clearTimeout(timeoutId);
        }
    }, [transcript.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRequestSuggestions = useCallback(() => {
        ensureTranscription();
        fetchSuggestions();
    }, [ensureTranscription, fetchSuggestions]);

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
            if (localStream) streams.push({ stream: localStream, label: localUsername || "You" });
            remotePeers.forEach(p => {
                if (p.stream) streams.push({ stream: p.stream, label: p.userId });
            });
            startRecording(streams);
            sendSignal({ type: "recording-status", isRecording: true });
        }
    };

    const leaveRoom = async () => {
        if (isRecording) stopRecording();
        if (isTranscribing) stopTranscription();
        try {
            await apiRequest(`/rooms/${roomId}/end`, {
                transcript: getFullTranscript(),
                duration: formatTime(time),
                participantCount,
            }, "POST");
        } catch {
            // Participants may not be allowed to end the room; local hangup still proceeds.
        }
        endCall();
        window.location.href = "/";
    };

    const copyInviteLink = () => {
        const link = `${window.location.origin}/group/${roomId}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    /* ── Dynamic grid class ── */
    const totalParticipants = remotePeers.length + 1;
    const activeSpeaker = remotePeers[0];
    const presentationPeer = remotePeers.find((p) => p.isScreen);
    const isPresentationMode = !!presentationPeer;

    const getGridClass = (count: number): string => {
        if (count <= 1) return "call-grid-1";
        if (count === 2) return "call-grid-2";
        if (count <= 4) return `call-grid-${Math.min(count, 4) as 3 | 4}`;
        if (count <= 6) return `call-grid-${Math.min(count, 6) as 5 | 6}`;
        if (count <= 9) return `call-grid-${Math.min(count, 9) as 7 | 8 | 9}`;
        return "call-grid-10";
    };

    // ── Loading State ──
    if (callState === "joining") {
        return (
            <div className="call-room items-center justify-center">
                <Loader2 className="animate-spin text-[#00d9f5]" size={40} />
                <p className="mt-4 call-waiting-text">Joining group call…</p>
            </div>
        );
    }

    // ── Error State ──
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
                    onClick={() => (window.location.href = "/")}
                    className="mt-4 px-5 py-2.5 rounded-lg bg-[#00d9f5] text-[#060608] text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    Return to Home
                </button>
            </div>
        );
    }

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

                    {/* Participant count */}
                    <span className="call-header-room-id hidden md:inline">
                        <UserRound size={12} className="inline mr-1" />
                        {participantCount}
                    </span>

                    {isRecording && (
                        <span className="call-header-rec">● REC</span>
                    )}

                    <CallThemeSwitcher currentThemeId={theme.id} onSelect={setTheme} />

                    {/* View mode toggle */}
                    <div className="hidden md:flex items-center overflow-hidden rounded-lg border border-[rgb(255_255_255/0.06)]">
                        <button
                            type="button"
                            onClick={() => setViewMode("gallery")}
                            className={`p-1.5 transition-colors ${viewMode === "gallery" ? "bg-[#00d9f5] text-[#060608]" : "text-[#8b8b9a] hover:text-[#f1f1f3]"}`}
                            title="Gallery View"
                        >
                            <LayoutGrid size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("speaker")}
                            className={`p-1.5 transition-colors ${viewMode === "speaker" ? "bg-[#00d9f5] text-[#060608]" : "text-[#8b8b9a] hover:text-[#f1f1f3]"}`}
                            title="Speaker View"
                        >
                            <Maximize size={14} />
                        </button>
                    </div>

                    <button
                        type="button"
                        className="call-header-ghost-btn"
                        onClick={() => setShowParticipants(!showParticipants)}
                        title="Participants"
                    >
                        <UserRound size={14} />
                    </button>

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

                    {/* ── Video Area ── */}
                    <div className="flex-1 min-h-0 relative">
                        {remotePeers.length === 0 ? (
                            /* Waiting state */
                            <div className="h-full w-full relative flex items-center justify-center">
                                <div className="call-waiting-bg" aria-hidden />
                                <div className="call-waiting-card">
                                    <div className="call-waiting-ring">
                                        <div className="call-waiting-ring-inner" />
                                        <div className="call-waiting-ring-outer" />
                                    </div>
                                    <p className="call-waiting-text">
                                        Waiting for others to join
                                    </p>
                                    <button
                                        type="button"
                                        className="call-waiting-link"
                                        onClick={copyInviteLink}
                                    >
                                        <Copy size={12} />
                                        {copied
                                            ? "Copied!"
                                            : `${typeof window !== "undefined" ? window.location.origin : ""}/group/${roomId.slice(0, 8)}…`}
                                    </button>
                                </div>

                                {/* Local PiP */}
                                <div className="absolute bottom-4 right-4 w-44 sm:w-56 aspect-video z-20">
                                    <VideoPlayer stream={localStream} label={localUsername} isLocal isMuted={isAudioMuted} isVideoOff={isVideoOff} />
                                </div>
                            </div>
                        ) : isPresentationMode ? (
                            /* Presentation mode */
                            <div className="h-full flex flex-col gap-3">
                                <div className="flex-1 min-h-0">
                                    <VideoPlayer stream={presentationPeer.stream} label={`${presentationPeer.userId}'s Screen`} isScreenShare />
                                </div>
                                <div className="flex gap-3 h-28 md:h-36 shrink-0 overflow-x-auto pb-2">
                                    <div className="aspect-video h-full shrink-0">
                                        <VideoPlayer stream={localStream} label={localUsername} isLocal isMuted={isAudioMuted} isVideoOff={isVideoOff} />
                                    </div>
                                    {remotePeers
                                        .filter((p) => p.peerId !== presentationPeer.peerId && !p.isScreen)
                                        .map((peer) => (
                                            <div key={peer.peerId} className="aspect-video h-full shrink-0">
                                                <VideoPlayer stream={peer.stream} label={peer.userId} isMuted={peer.isAudioMuted} isVideoOff={peer.isVideoOff} />
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ) : viewMode === "gallery" ? (
                            /* Gallery grid */
                            <div className={`h-full w-full grid gap-3 ${getGridClass(totalParticipants)} auto-rows-fr`}>
                                <div className="min-h-0">
                                    <VideoPlayer stream={localStream} label={localUsername} isLocal isMuted={isAudioMuted} isVideoOff={isVideoOff} />
                                </div>
                                {remotePeers.filter(p => !p.isScreen).map((peer) => (
                                    <div key={peer.peerId} className="min-h-0">
                                        <VideoPlayer stream={peer.stream} label={peer.userId} isMuted={peer.isAudioMuted} isVideoOff={peer.isVideoOff} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* Speaker view */
                            <div className="h-full flex flex-col gap-3">
                                <div className="flex-1 min-h-0">
                                    {activeSpeaker ? (
                                        <VideoPlayer stream={activeSpeaker.stream} label={activeSpeaker.userId} isMuted={activeSpeaker.isAudioMuted} isVideoOff={activeSpeaker.isVideoOff} />
                                    ) : (
                                        <VideoPlayer stream={localStream} label={localUsername} isLocal isMuted={isAudioMuted} />
                                    )}
                                </div>
                                <div className="flex gap-3 h-28 md:h-36 shrink-0 overflow-x-auto">
                                    {activeSpeaker && (
                                        <div className="aspect-video h-full shrink-0">
                                            <VideoPlayer stream={localStream} label={localUsername} isLocal isMuted={isAudioMuted} isVideoOff={isVideoOff} />
                                        </div>
                                    )}
                                    {remotePeers
                                        .filter((p) => p.peerId !== activeSpeaker?.peerId && !p.isScreen)
                                        .map((peer) => (
                                            <div key={peer.peerId} className="aspect-video h-full shrink-0">
                                                <VideoPlayer stream={peer.stream} label={peer.userId} isMuted={peer.isAudioMuted} isVideoOff={peer.isVideoOff} />
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom spacer for dock */}
                    <div className="h-20 shrink-0" />

                    {/* ── Controls ── */}
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

                {/* ── Chat Panel ── */}
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
                                localUsername={localUsername}
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

            <ParticipantList
                isOpen={showParticipants}
                onClose={() => setShowParticipants(false)}
                participants={[
                    { peerId: "local", userId: localUsername, isLocal: true, isMuted: isAudioMuted },
                    ...remotePeers.map((p) => ({ peerId: p.peerId, userId: p.userId })),
                ]}
            />

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
                participantCount={participantCount}
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
