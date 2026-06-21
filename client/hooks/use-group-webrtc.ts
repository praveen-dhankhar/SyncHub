"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import * as mediasoupClient from "mediasoup-client";
import {
    buildWebSocketUrl,
    CALL_MEDIA_CONSTRAINTS,
    GROUP_CAMERA_ENCODINGS,
    GROUP_SCREEN_ENCODINGS,
} from "@/lib/realtime";
import { useVirtualBackground, BackgroundMode } from "./use-virtual-background";
import type { ClientActionItem } from "@/components/ActionItemsTab";

// ─── Types ──────────────────────────────────────────────
export type GroupCallState = "idle" | "joining" | "connected" | "disconnected" | "error";

export interface RemotePeer {
    peerId: string;
    userId: string;
    stream: MediaStream;
    isScreen?: boolean;
    isAudioMuted?: boolean;
    isVideoOff?: boolean;
}

type NetworkInformationLike = {
    effectiveType?: string;
    saveData?: boolean;
    addEventListener?: (type: "change", listener: () => void) => void;
    removeEventListener?: (type: "change", listener: () => void) => void;
};

type ConsumerRecord = {
    peerId: string;
    userId: string;
    streamKey: string;
    consumer: mediasoupClient.types.Consumer;
    producerId: string;
    isScreen?: boolean;
};

type PendingConsumeResponse = {
    resolve: (message: any) => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
};

function createRequestId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getStreamKey(peerId: string, isScreen?: boolean) {
    return isScreen ? `${peerId}:screen` : peerId;
}

function getNetworkConnection(): NetworkInformationLike | undefined {
    if (typeof navigator === "undefined") return undefined;
    return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

function getNetworkProfile() {
    const connection = getNetworkConnection();
    if (connection?.saveData) return "poor";
    if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return "poor";
    if (connection?.effectiveType === "3g") return "constrained";
    return "good";
}

// ─── Hook ───────────────────────────────────────────────
export function useGroupWebRTC(roomId: string) {
    const [callState, setCallState] = useState<GroupCallState>("idle");
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [rawVideoTrack, setRawVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; timestamp: number; isLocal?: boolean }[]>([]);
    const [remoteRecording, setRemoteRecording] = useState<{ isRecording: boolean; recorder: string } | null>(null);
    const [participantCount, setParticipantCount] = useState(1);
    const [localUsername, setLocalUsername] = useState<string>("You");
    const [incomingReaction, setIncomingReaction] = useState<{ emoji: string; sender: string } | null>(null);
    const [incomingDrawPoint, setIncomingDrawPoint] = useState<any>(null);
    const [incomingClear, setIncomingClear] = useState(false);
    const [incomingE2EKey, setIncomingE2EKey] = useState<JsonWebKey | null>(null);
    const [actionItems, setActionItems] = useState<ClientActionItem[]>([]);

    const {
        processedTrack,
        backgroundMode,
        setBackgroundMode,
        backgroundImageUrl,
        setBackgroundImageUrl,
    } = useVirtualBackground(rawVideoTrack);

    const setVirtualBackground = useCallback((mode: BackgroundMode, url?: string) => {
        setBackgroundMode(mode);
        if (url) setBackgroundImageUrl(url);
    }, [setBackgroundMode, setBackgroundImageUrl]);

    const socketRef = useRef<WebSocket | null>(null);
    const deviceRef = useRef<mediasoupClient.Device | null>(null);
    const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
    const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const cameraProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
    const screenProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
    const cleanedUpRef = useRef(false);
    const localPeerIdRef = useRef<string | null>(null);
    const effectIdRef = useRef(0);

    // ── Helper: send JSON ──
    const send = useCallback((data: any) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(data));
        }
    }, []);

    // Consumer tracking: consumerId → remote consumer metadata
    const consumersRef = useRef<Map<string, ConsumerRecord>>(new Map());
    const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
    const remoteStreamMetaRef = useRef<Map<string, { peerId: string; userId: string; isScreen?: boolean }>>(new Map());
    const remotePeerSignatureRef = useRef("");
    const pendingConsumeResponsesRef = useRef<Map<string, PendingConsumeResponse>>(new Map());
    const consumingProducerIdsRef = useRef<Set<string>>(new Set());
    const layerTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map());
    const toggleScreenShareRef = useRef<() => Promise<void>>(null as any);
    // Peer mapping: peerId → { userId, username }
    const peerMapRef = useRef<Map<string, { userId: string; username: string }>>(new Map());
    // Store RTP capabilities after device load
    const rtpCapsRef = useRef<mediasoupClient.types.RtpCapabilities | null>(null);
    // Pending producers to consume (queued before device is ready)
    const pendingProducersRef = useRef<{ producerId: string; peerId: string; userId: string }[]>([]);
    // Remote peer mute states
    const remoteMuteStatesRef = useRef<Map<string, { isAudioMuted: boolean; isVideoOff: boolean }>>(new Map());

    const getTargetSpatialLayer = useCallback((isScreen?: boolean) => {
        const profile = getNetworkProfile();
        const cameraCount = Array.from(remoteStreamMetaRef.current.values()).filter((meta) => !meta.isScreen).length;

        if (profile === "poor") return isScreen ? 1 : 0;
        if (profile === "constrained") return isScreen ? 1 : (cameraCount > 2 ? 0 : 1);
        return isScreen ? 2 : (cameraCount > 4 ? 1 : 2);
    }, []);

    const getTargetTemporalLayer = useCallback(() => {
        return getNetworkProfile() === "poor" ? 0 : 2;
    }, []);

    const sendPreferredLayers = useCallback((consumerId: string, spatialLayer: number, temporalLayer = getTargetTemporalLayer()) => {
        send({
            type: "setConsumerPreferredLayers",
            consumerId,
            spatialLayer,
            temporalLayer,
        });
    }, [getTargetTemporalLayer, send]);

    const clearLayerTimers = useCallback((consumerId: string) => {
        for (const timerId of layerTimersRef.current.get(consumerId) || []) {
            clearTimeout(timerId);
        }
        layerTimersRef.current.delete(consumerId);
    }, []);

    const scheduleLayerUpgrade = useCallback((consumerId: string, isScreen?: boolean) => {
        clearLayerTimers(consumerId);

        const firstStepLayer = isScreen ? 1 : Math.min(1, getTargetSpatialLayer(isScreen));
        const timers = [
            setTimeout(() => {
                if (consumersRef.current.has(consumerId)) {
                    sendPreferredLayers(consumerId, firstStepLayer);
                }
            }, isScreen ? 700 : 500),
            setTimeout(() => {
                if (consumersRef.current.has(consumerId)) {
                    sendPreferredLayers(consumerId, getTargetSpatialLayer(isScreen));
                }
            }, isScreen ? 1800 : 1500),
        ];

        layerTimersRef.current.set(consumerId, timers);
    }, [clearLayerTimers, getTargetSpatialLayer, sendPreferredLayers]);

    const reapplyAdaptiveLayers = useCallback(() => {
        for (const [consumerId, record] of consumersRef.current.entries()) {
            if (record.consumer.kind === "video") {
                sendPreferredLayers(consumerId, getTargetSpatialLayer(record.isScreen));
            }
        }
    }, [getTargetSpatialLayer, sendPreferredLayers]);

    // ── Rebuild remotePeers state from stable MediaStream instances ──
    const rebuildRemotePeers = useCallback(() => {
        if (cleanedUpRef.current) return;

        const peers: RemotePeer[] = [];
        const entries = Array.from(remoteStreamsRef.current.entries()).sort(([aKey], [bKey]) => {
            const aScreen = aKey.endsWith(":screen");
            const bScreen = bKey.endsWith(":screen");
            if (aScreen !== bScreen) return aScreen ? 1 : -1;
            return aKey.localeCompare(bKey);
        });

        for (const [streamKey, stream] of entries) {
            const meta = remoteStreamMetaRef.current.get(streamKey);
            if (!meta || stream.getTracks().length === 0) continue;
            const muteState = remoteMuteStatesRef.current.get(meta.peerId);
            peers.push({
                peerId: meta.isScreen ? streamKey : meta.peerId,
                userId: meta.userId,
                stream,
                isScreen: meta.isScreen,
                isAudioMuted: meta.isScreen ? undefined : (muteState?.isAudioMuted ?? false),
                isVideoOff: meta.isScreen ? undefined : (muteState?.isVideoOff ?? false),
            });
        }

        const signature = peers.map((peer) => {
            const trackIds = peer.stream.getTracks().map((track) => `${track.kind}:${track.id}:${track.readyState}`).sort().join(",");
            return `${peer.peerId}:${peer.userId}:${peer.isScreen ? 1 : 0}:${peer.isAudioMuted ? 1 : 0}:${peer.isVideoOff ? 1 : 0}:${trackIds}`;
        }).join("|");

        if (signature !== remotePeerSignatureRef.current) {
            remotePeerSignatureRef.current = signature;
            setRemotePeers(peers);
        }

        const cameraPeerCount = Array.from(remoteStreamMetaRef.current.values()).filter((meta) => !meta.isScreen).length;
        setParticipantCount(cameraPeerCount + 1);
    }, []);

    const removeRemoteConsumer = useCallback((consumerId: string) => {
        const record = consumersRef.current.get(consumerId);
        if (!record) return;

        clearLayerTimers(consumerId);
        consumingProducerIdsRef.current.delete(record.producerId);

        const stream = remoteStreamsRef.current.get(record.streamKey);
        if (stream && record.consumer.track) {
            for (const track of stream.getTracks()) {
                if (track.id === record.consumer.track.id) {
                    stream.removeTrack(track);
                }
            }
            if (stream.getTracks().length === 0) {
                remoteStreamsRef.current.delete(record.streamKey);
                remoteStreamMetaRef.current.delete(record.streamKey);
            }
        }

        consumersRef.current.delete(consumerId);
        try { record.consumer.close(); } catch { /* ignore */ }
        rebuildRemotePeers();
        if (!cleanedUpRef.current) reapplyAdaptiveLayers();
    }, [clearLayerTimers, rebuildRemotePeers, reapplyAdaptiveLayers]);

    const waitForConsumeResponse = useCallback((requestId: string) => {
        return new Promise<any>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                pendingConsumeResponsesRef.current.delete(requestId);
                reject(new Error("consume response timed out"));
            }, 12_000);

            pendingConsumeResponsesRef.current.set(requestId, { resolve, reject, timeoutId });
        });
    }, []);

    // ── Consume a remote producer ──
    const consumeProducer = useCallback(async (producerId: string, peerId: string, displayName: string) => {
        if (!rtpCapsRef.current || !recvTransportRef.current) {
            console.log(`[GROUP] consumeProducer QUEUED (device not ready): ${producerId.slice(0, 8)} for ${displayName}`);
            pendingProducersRef.current.push({ producerId, peerId, userId: displayName });
            return;
        }

        if (consumingProducerIdsRef.current.has(producerId) || Array.from(consumersRef.current.values()).some((record) => record.producerId === producerId)) {
            return;
        }

        consumingProducerIdsRef.current.add(producerId);

        try {
            console.log(`[GROUP] consumeProducer START: ${producerId.slice(0, 8)} for ${displayName}`);
            const requestId = createRequestId();
            const responsePromise = waitForConsumeResponse(requestId);
            send({ type: "consume", requestId, producerId, rtpCapabilities: rtpCapsRef.current });
            const res = await responsePromise;

            if (res.type === "error") {
                console.warn("[GROUP] consume FAILED:", producerId.slice(0, 8), res.message);
                return;
            }

            const consumerId = res.consumerId || res.id;
            console.log(`[GROUP] consume OK: kind=${res.kind} producerId=${res.producerId?.slice(0, 8)}`);

            const consumer = await recvTransportRef.current!.consume({
                id: consumerId,
                producerId: res.producerId,
                kind: res.kind,
                rtpParameters: res.rtpParameters,
                appData: res.appData,
            });

            const isScreen = Boolean(res.appData?.screen);
            const streamKey = getStreamKey(peerId, isScreen);
            const stream = remoteStreamsRef.current.get(streamKey) || new MediaStream();
            if (!remoteStreamsRef.current.has(streamKey)) {
                remoteStreamsRef.current.set(streamKey, stream);
            }
            remoteStreamMetaRef.current.set(streamKey, { peerId, userId: displayName, isScreen });

            if (!stream.getTracks().some((track) => track.id === consumer.track.id)) {
                if (consumer.kind === "video") consumer.track.contentHint = isScreen ? "detail" : "motion";
                stream.addTrack(consumer.track);
            }

            const record: ConsumerRecord = {
                peerId,
                userId: displayName,
                streamKey,
                consumer,
                producerId: res.producerId,
                isScreen,
            };
            consumersRef.current.set(consumer.id, record);
            peerMapRef.current.set(peerId, { userId: displayName, username: displayName });

            consumer.on("transportclose", () => removeRemoteConsumer(consumer.id));
            consumer.on("trackended", () => removeRemoteConsumer(consumer.id));
            consumer.track.addEventListener("ended", () => removeRemoteConsumer(consumer.id), { once: true });

            if (consumer.kind === "video") {
                sendPreferredLayers(consumer.id, 0, 1);
            }

            send({ type: "resumeConsumer", consumerId: consumer.id });
            try { consumer.resume(); } catch { /* ignore */ }

            console.log(`[GROUP] consumer created: id=${consumer.id.slice(0, 8)} kind=${consumer.kind} track=${consumer.track?.readyState}`);
            rebuildRemotePeers();
            if (consumer.kind === "video") scheduleLayerUpgrade(consumer.id, isScreen);
        } catch (err) {
            console.warn("[GROUP] consumeProducer error for", producerId.slice(0, 8), err);
        } finally {
            consumingProducerIdsRef.current.delete(producerId);
        }
    }, [rebuildRemotePeers, removeRemoteConsumer, scheduleLayerUpgrade, send, sendPreferredLayers, waitForConsumeResponse]);

    useEffect(() => {
        if (!roomId) return;

        // Each effect invocation gets a unique ID.
        // Old handlers check their ID vs current — stale ones bail out.
        const myEffectId = ++effectIdRef.current;
        const isStale = () => myEffectId !== effectIdRef.current;

        cleanedUpRef.current = false;

        let socket: WebSocket | null = null;

        // ── Helper: wait for specific message type (one-shot) ──
        function waitFor(type: string, match?: (msg: any) => boolean): Promise<any> {
            return new Promise((resolve) => {
                function onMsg(event: MessageEvent) {
                    const msg = JSON.parse(event.data);
                    if (msg.type === type && (!match || match(msg))) {
                        socket?.removeEventListener("message", onMsg);
                        resolve(msg);
                    }
                }
                socket?.addEventListener("message", onMsg);
            });
        }

        // ── Setup mediasoup Device + Transports ──
        async function setupDevice(rtpCapabilities: mediasoupClient.types.RtpCapabilities) {
            const device = new mediasoupClient.Device();
            await device.load({ routerRtpCapabilities: rtpCapabilities });
            deviceRef.current = device;
            rtpCapsRef.current = device.rtpCapabilities;

            // --- Send Transport ---
            send({ type: "createTransport", direction: "send" });
            const sendRes = await waitFor("transportCreated", (m) => m.direction === "send");

            const sendTransport = device.createSendTransport({
                id: sendRes.params.id,
                iceParameters: sendRes.params.iceParameters,
                iceCandidates: sendRes.params.iceCandidates,
                dtlsParameters: sendRes.params.dtlsParameters,
            });

            sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                send({ type: "connectTransport", transportId: sendTransport.id, dtlsParameters });
                waitFor("transportConnected", (m) => m.transportId === sendTransport.id)
                    .then(() => callback())
                    .catch(errback);
            });

            sendTransport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
                send({ type: "produce", transportId: sendTransport.id, kind, rtpParameters, appData });
                waitFor("produced")
                    .then((msg) => callback({ id: msg.producerId }))
                    .catch(errback);
            });

            sendTransportRef.current = sendTransport;

            // --- Recv Transport ---
            send({ type: "createTransport", direction: "recv" });
            const recvRes = await waitFor("transportCreated", (m) => m.direction === "recv");

            const recvTransport = device.createRecvTransport({
                id: recvRes.params.id,
                iceParameters: recvRes.params.iceParameters,
                iceCandidates: recvRes.params.iceCandidates,
                dtlsParameters: recvRes.params.dtlsParameters,
            });

            recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                send({ type: "connectTransport", transportId: recvTransport.id, dtlsParameters });
                waitFor("transportConnected", (m) => m.transportId === recvTransport.id)
                    .then(() => callback())
                    .catch(errback);
            });

            recvTransportRef.current = recvTransport;

            // --- Produce local tracks ---
            if (localStreamRef.current) {
                const audio = localStreamRef.current.getAudioTracks()[0];
                const video = localStreamRef.current.getVideoTracks()[0];
                if (audio) await sendTransport.produce({ track: audio });
                if (video) {
                    video.contentHint = "motion";
                    cameraProducerRef.current = await sendTransport.produce({
                        track: video,
                        encodings: GROUP_CAMERA_ENCODINGS,
                        codecOptions: { videoGoogleStartBitrate: 1_500 },
                    });
                }
            }

            // --- Consume any queued producers ---
            const pending = [...pendingProducersRef.current];
            pendingProducersRef.current = [];
            await Promise.allSettled(pending.map((p) => consumeProducer(p.producerId, p.peerId, p.userId)));
        }

        // ── Main Init ──
        async function init() {
            if (isStale()) return;
            setCallState("joining");

            try {
                // 1. Register in DB
                try {
                    await apiRequest(`/rooms/${roomId}/join`, {});
                } catch (e: any) {
                    if (!e.message?.includes("Already")) throw e;
                }

                if (isStale()) return;

                // 2. Get camera/mic with optimized quality
                const stream = await navigator.mediaDevices.getUserMedia(CALL_MEDIA_CONSTRAINTS);

                if (isStale()) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                localStreamRef.current = stream;
                const vidTrack = stream.getVideoTracks()[0] || null;
                setRawVideoTrack(vidTrack);
                setLocalStream(stream);

                // 3. Get WebSocket auth token
                const { token } = await apiRequest("/auth/ws-token", undefined, "GET");

                if (isStale()) return;

                // 4. Connect WebSocket with token in URL
                socket = new WebSocket(buildWebSocketUrl(token));
                socketRef.current = socket;

                socket.addEventListener("open", () => {
                    if (isStale()) { socket?.close(); return; }
                    send({ type: "join", roomId });
                });

                // Main message handler for signaling events
                socket.addEventListener("message", (event) => {
                    if (isStale()) return;
                    const msg = JSON.parse(event.data);

                    if (msg.requestId && (msg.type === "consumed" || msg.type === "error")) {
                        const pending = pendingConsumeResponsesRef.current.get(msg.requestId);
                        if (pending) {
                            clearTimeout(pending.timeoutId);
                            pendingConsumeResponsesRef.current.delete(msg.requestId);
                            pending.resolve(msg);
                            return;
                        }
                    }

                    switch (msg.type) {
                        case "role":
                            setCallState("connected");
                            if (msg.username) setLocalUsername(msg.username);
                            if (msg.peerId) localPeerIdRef.current = msg.peerId;
                            send({ type: "getRouterCapabilities" });
                            break;

                        case "routerCapabilities":
                            void setupDevice(msg.rtpCapabilities).catch((err) => {
                                console.error("setupDevice failed:", err);
                                if (!cleanedUpRef.current) {
                                    setCallState("error");
                                    setErrorMessage("Failed to initialize media device");
                                }
                            });
                            break;

                        case "peer-joined":
                            peerMapRef.current.set(msg.peerId, { userId: msg.userId, username: msg.username || msg.userId.slice(0, 8) });
                            break;

                        case "existingProducers":
                            console.log(`[GROUP] existingProducers: ${msg.producers?.length} producers, localPeerId=${localPeerIdRef.current?.slice(0, 8)}`);
                            void Promise.allSettled((msg.producers || []).map((prod: any) => {
                                // Skip own producers (safety guard against race conditions)
                                if (prod.peerId === localPeerIdRef.current) {
                                    console.log(`[GROUP] SKIPPING own producer: ${prod.producerId?.slice(0, 8)}`);
                                    return Promise.resolve();
                                }
                                console.log(`[GROUP] consuming existing: ${prod.producerId?.slice(0, 8)} kind=${prod.kind} from ${prod.username}`);
                                return consumeProducer(prod.producerId, prod.peerId, prod.username || prod.userId.slice(0, 8));
                            }));
                            break;

                        case "newProducer":
                            // Skip own producers (safety guard)
                            if (msg.peerId === localPeerIdRef.current) {
                                console.log(`[GROUP] SKIPPING own newProducer: ${msg.producerId?.slice(0, 8)}`);
                                break;
                            }
                            console.log(`[GROUP] newProducer: ${msg.producerId?.slice(0, 8)} kind=${msg.kind} from ${msg.username}`);
                            void consumeProducer(msg.producerId, msg.peerId, msg.username || msg.userId.slice(0, 8));
                            break;

                        case "producerClosed":
                            // Clean up local consumer for this producer
                            for (const [id, data] of Array.from(consumersRef.current.entries())) {
                                if (data.consumer.producerId === msg.producerId) {
                                    removeRemoteConsumer(id);
                                }
                            }
                            break;

                        case "peer-left":
                            for (const [id, data] of Array.from(consumersRef.current.entries())) {
                                if (data.peerId === msg.peerId) {
                                    removeRemoteConsumer(id);
                                }
                            }
                            peerMapRef.current.delete(msg.peerId);
                            remoteMuteStatesRef.current.delete(msg.peerId);
                            rebuildRemotePeers();
                            break;

                        case "mute-state":
                            remoteMuteStatesRef.current.set(msg.peerId, {
                                isAudioMuted: msg.isAudioMuted ?? false,
                                isVideoOff: msg.isVideoOff ?? false,
                            });
                            rebuildRemotePeers();
                            break;

                        case "chat-message":
                            setChatMessages(prev => [...prev, {
                                id: `${Date.now()}-${Math.random()}`,
                                sender: msg.sender,
                                text: msg.text,
                                timestamp: msg.timestamp,
                                isLocal: false,
                                messageType: msg.messageType || "text",
                                imageData: msg.imageData,
                            }]);
                            break;

                        case "recording-status":
                            setRemoteRecording(msg.isRecording ? { isRecording: true, recorder: msg.recorder } : null);
                            break;

                        case "emoji-reaction":
                            setIncomingReaction({ emoji: msg.emoji, sender: msg.sender });
                            break;

                        case "whiteboard-draw":
                            setIncomingDrawPoint(msg.point);
                            break;

                        case "whiteboard-clear":
                            setIncomingClear(true);
                            setTimeout(() => setIncomingClear(false), 100);
                            break;

                        case "e2e-public-key":
                            setIncomingE2EKey(msg.publicKeyJwk);
                            break;

                        case "action-items-update":
                            setActionItems(Array.isArray(msg.items) ? msg.items : []);
                            break;

                        case "error":
                            // Only log — don't kill callState for non-fatal errors
                            // (consume failures, transport issues are handled individually)
                            console.warn("Signaling warning:", msg.message);
                            break;

                        // transportCreated, transportConnected, produced, consumed
                        // are handled by the waitFor() promises — no action needed here
                    }
                });

                socket.addEventListener("close", (event) => {
                    if (isStale()) return;
                    console.log(`[WS] close: code=${event.code} reason=${event.reason} clean=${event.wasClean}`);
                    if (!cleanedUpRef.current && event.code !== 1000) setCallState("disconnected");
                });

                socket.addEventListener("error", (e) => {
                    if (isStale()) return;
                    console.error("[WS] error:", e);
                    if (!cleanedUpRef.current) {
                        setCallState("error");
                        setErrorMessage("WebSocket connection failed");
                    }
                });

            } catch (err: any) {
                if (!cleanedUpRef.current) {
                    setCallState("error");
                    setErrorMessage(
                        err.name === "NotAllowedError"
                            ? "Camera/Mic access denied"
                            : (err.message || "Failed to join")
                    );
                }
            }
        }

        init();

        const connection = getNetworkConnection();
        connection?.addEventListener?.("change", reapplyAdaptiveLayers);
        const consumers = consumersRef.current;
        const pendingConsumeResponses = pendingConsumeResponsesRef.current;
        const remoteStreams = remoteStreamsRef.current;
        const remoteStreamMeta = remoteStreamMetaRef.current;
        const consumingProducerIds = consumingProducerIdsRef.current;
        const layerTimers = layerTimersRef.current;

        return () => {
            cleanedUpRef.current = true;
            connection?.removeEventListener?.("change", reapplyAdaptiveLayers);
            for (const pending of pendingConsumeResponses.values()) {
                clearTimeout(pending.timeoutId);
                pending.reject(new Error("call cleanup"));
            }
            pendingConsumeResponses.clear();
            for (const consumerId of Array.from(consumers.keys())) removeRemoteConsumer(consumerId);
            consumers.clear();
            remoteStreams.clear();
            remoteStreamMeta.clear();
            remotePeerSignatureRef.current = "";
            consumingProducerIds.clear();
            for (const timerIds of layerTimers.values()) {
                for (const timerId of timerIds) clearTimeout(timerId);
            }
            layerTimers.clear();
            cameraProducerRef.current?.close();
            cameraProducerRef.current = null;
            sendTransportRef.current?.close();
            recvTransportRef.current?.close();
            if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000, "cleanup");
            socketRef.current = null;
            localStreamRef.current?.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, send]);

    // ── Apply Virtual Background Track Changes ──
    useEffect(() => {
        if (!processedTrack || !localStreamRef.current) return;

        processedTrack.contentHint = "motion";
        const stream = localStreamRef.current;
        const currentVideoTrack = stream.getVideoTracks()[0];

        if (currentVideoTrack && currentVideoTrack !== processedTrack) {
            stream.removeTrack(currentVideoTrack);
            stream.addTrack(processedTrack);
            setLocalStream(new MediaStream(stream.getTracks()));
        }

        cameraProducerRef.current?.replaceTrack({ track: processedTrack })
            .catch((error) => console.error("[GROUP] replace camera track failed:", error));
    }, [processedTrack]);

    // ── Controls ──
    // Refs to avoid stale closures in toggle functions
    const isAudioMutedRef = useRef(false);
    const isVideoOffRef = useRef(false);

    const toggleAudio = useCallback(() => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            const muted = !track.enabled;
            isAudioMutedRef.current = muted;
            setIsAudioMuted(muted);
            send({ type: "mute-state", isAudioMuted: muted, isVideoOff: isVideoOffRef.current });
        }
    }, [send]);

    const toggleVideo = useCallback(() => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) {
            track.enabled = !track.enabled;
            const off = !track.enabled;
            isVideoOffRef.current = off;
            setIsVideoOff(off);
            send({ type: "mute-state", isAudioMuted: isAudioMutedRef.current, isVideoOff: off });
        }
    }, [send]);

    const endCall = useCallback(() => {
        screenProducerRef.current?.close();
        sendTransportRef.current?.close();
        recvTransportRef.current?.close();
        socketRef.current?.close();
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        window.location.href = "/";
    }, []);

    const toggleScreenShare = useCallback(async () => {
        const sendTransport = sendTransportRef.current;
        if (!sendTransport) return;

        if (isScreenSharing) {
            // Stop screen share
            if (screenProducerRef.current) {
                const producerId = screenProducerRef.current.id;
                screenProducerRef.current.close();
                screenProducerRef.current = null;
                send({ type: "closeProducer", producerId });
            }
            setIsScreenSharing(false);
        } else {
            // Start screen share
            if (!navigator.mediaDevices?.getDisplayMedia) {
                setErrorMessage("Screen sharing is not supported in this browser or requires a secure (HTTPS/localhost) connection.");
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
                });
                const track = stream.getVideoTracks()[0];
                track.contentHint = "detail";

                const producer = await sendTransport.produce({
                    track,
                    encodings: GROUP_SCREEN_ENCODINGS,
                    codecOptions: { videoGoogleStartBitrate: 2_500 },
                    appData: { screen: true },
                });
                screenProducerRef.current = producer;
                setIsScreenSharing(true);

                track.onended = () => {
                    void toggleScreenShareRef.current();
                };
            } catch (err: any) {
                console.error("Screen share failed:", err);
                if (err.name === "NotAllowedError") {
                    setErrorMessage("Screen share permission denied. Please allow screen access in your browser.");
                } else {
                    setErrorMessage("Failed to start screen share: " + (err.message || "Unknown error"));
                }
            }
        }
    }, [isScreenSharing, send]);

    useEffect(() => {
        toggleScreenShareRef.current = toggleScreenShare;
    }, [toggleScreenShare]);

    const sendChatMessage = useCallback((text: string, messageType?: "text" | "image", imageData?: string) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        send({ type: "chat-message", text, messageType: messageType || "text", imageData });
        setChatMessages(prev => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            sender: localUsername || "You",
            text,
            timestamp: Date.now(),
            isLocal: true,
            messageType: messageType || "text",
            imageData,
        }]);
    }, [send, localUsername]);

    const sendSignal = useCallback((data: any) => {
        send(data);
    }, [send]);

    const sendReaction = useCallback((emoji: string) => {
        send({ type: "emoji-reaction", emoji });
    }, [send]);

    const sendWhiteboardDraw = useCallback((point: any) => {
        send({ type: "whiteboard-draw", point });
    }, [send]);

    const sendWhiteboardClear = useCallback(() => {
        send({ type: "whiteboard-clear" });
    }, [send]);

    const sendE2EPublicKey = useCallback((publicKeyJwk: JsonWebKey) => {
        send({ type: "e2e-public-key", publicKeyJwk });
    }, [send]);

    return {
        callState,
        localStream,
        remotePeers,
        participantCount,
        localUsername,
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        errorMessage,
        chatMessages,
        remoteRecording,
        incomingReaction,
        incomingDrawPoint,
        incomingClear,
        incomingE2EKey,
        actionItems,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        sendChatMessage,
        sendReaction,
        sendWhiteboardDraw,
        sendWhiteboardClear,
        sendE2EPublicKey,
        sendSignal,
        endCall,
        bgMode: backgroundMode,
        bgUrl: backgroundImageUrl,
        setVirtualBackground,
    };
}
