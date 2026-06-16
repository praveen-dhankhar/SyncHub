"use client";

import { useEffect, useRef } from "react";
import { MicOff } from "lucide-react";

interface VideoPlayerProps {
    stream: MediaStream | null;
    label: string;
    isLocal?: boolean;
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenShare?: boolean;
    backgroundClass?: string;
}

export function VideoPlayer({
    stream,
    label,
    isLocal = false,
    isMuted = false,
    isVideoOff = false,
    isScreenShare = false,
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="call-tile">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className={`${isScreenShare ? "object-contain bg-black" : "object-cover"} ${isVideoOff ? "hidden" : ""}`}
            />

            {/* Camera off → avatar initial */}
            {isVideoOff && (
                <div className="call-tile-avatar">
                    <div className="call-tile-avatar-initial">
                        {label.charAt(0)}
                    </div>
                </div>
            )}

            {/* Bottom label overlay */}
            <div className="call-tile-label">
                <span className="call-tile-label-name">
                    {label}{isLocal && " (You)"}
                </span>
            </div>

            {/* Muted indicator — bottom-left circular capsule */}
            {isMuted && (
                <div className="call-tile-muted">
                    <MicOff size={12} />
                </div>
            )}
        </div>
    );
}
