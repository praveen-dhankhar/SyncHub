const LOCAL_BACKEND_ORIGIN = "http://localhost:5001";

export const CALL_MEDIA_CONSTRAINTS: MediaStreamConstraints = {
    video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
        aspectRatio: { ideal: 16 / 9 },
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
    },
};

export const CAMERA_VIDEO_ENCODING: RTCRtpEncodingParameters = {
    maxBitrate: 2_500_000,
    maxFramerate: 30,
    scaleResolutionDownBy: 1,
};

export const SCREEN_VIDEO_ENCODING: RTCRtpEncodingParameters = {
    maxBitrate: 4_000_000,
    maxFramerate: 30,
    scaleResolutionDownBy: 1,
};

export const GROUP_CAMERA_ENCODINGS: RTCRtpEncodingParameters[] = [
    { maxBitrate: 180_000, maxFramerate: 20, scaleResolutionDownBy: 4 },
    { maxBitrate: 650_000, maxFramerate: 30, scaleResolutionDownBy: 2 },
    { maxBitrate: 2_200_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
];

export const GROUP_SCREEN_ENCODINGS: RTCRtpEncodingParameters[] = [
    { maxBitrate: 3_500_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
];

export function buildWebSocketUrl(token?: string) {
    const configuredUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL;
    const baseUrl = toWebSocketUrl(configuredUrl) || inferWebSocketUrl();
    const url = new URL(baseUrl);

    if (token) {
        url.searchParams.set("token", token);
    }

    return url.toString();
}

export async function applyVideoSenderQuality(
    sender: RTCRtpSender | undefined,
    encoding: RTCRtpEncodingParameters = CAMERA_VIDEO_ENCODING
) {
    if (!sender || sender.track?.kind !== "video") return;

    const parameters = sender.getParameters();
    parameters.encodings = parameters.encodings?.length
        ? parameters.encodings.map((existing) => ({ ...existing, ...encoding }))
        : [{ ...encoding }];

    (parameters as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = "maintain-resolution";

    try {
        await sender.setParameters(parameters);
    } catch (error) {
        console.warn("[RTC] Unable to apply video sender quality settings:", error);
    }
}

function toWebSocketUrl(value?: string) {
    if (!value) return null;

    try {
        const url = new URL(value, typeof window === "undefined" ? LOCAL_BACKEND_ORIGIN : window.location.origin);
        if (url.protocol === "http:") url.protocol = "ws:";
        if (url.protocol === "https:") url.protocol = "wss:";
        return url.toString();
    } catch {
        return null;
    }
}

function inferWebSocketUrl() {
    if (typeof window === "undefined") {
        return LOCAL_BACKEND_ORIGIN.replace(/^http/, "ws");
    }

    const { protocol, hostname } = window.location;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

    if (isLocalhost) {
        return `${protocol === "https:" ? "wss" : "ws"}://${hostname}:5001`;
    }

    return window.location.origin.replace(/^http/, "ws");
}
