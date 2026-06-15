"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * OAuth callback page — receives a one-time auth code from the query string
 * and exchanges it for httpOnly cookie tokens via the backend.
 *
 * URL format: /auth/callback?code=xxx
 */
export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<CallbackLoading />}>
            <CallbackContent />
        </Suspense>
    );
}

function CallbackLoading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Signing you in...</p>
            </div>
        </div>
    );
}

function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get("code");
        const oauthError = searchParams.get("error");

        // Handle OAuth errors (redirected from backend)
        if (oauthError) {
            setError(getErrorMessage(oauthError));
            setTimeout(() => router.replace("/auth/login"), 3000);
            return;
        }

        if (!code) {
            router.replace("/auth/login");
            return;
        }

        // Exchange the one-time code for tokens (set as httpOnly cookies)
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        fetch(`${API_BASE}/auth/exchange-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ code }),
        })
            .then((res) => {
                if (res.ok) {
                    // Clear code from URL for security
                    window.history.replaceState(null, "", "/auth/callback");
                    router.replace("/");
                } else {
                    return res.json().then((data) => {
                        setError(data.message || "Authentication failed");
                        setTimeout(() => router.replace("/auth/login"), 3000);
                    });
                }
            })
            .catch(() => {
                setError("Network error — please try again");
                setTimeout(() => router.replace("/auth/login"), 3000);
            });
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                {error ? (
                    <>
                        <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                            <span className="text-destructive text-lg">✕</span>
                        </div>
                        <p className="text-destructive text-sm font-medium">{error}</p>
                        <p className="text-muted-foreground text-xs">Redirecting to login...</p>
                    </>
                ) : (
                    <>
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-muted-foreground text-sm">Signing you in...</p>
                    </>
                )}
            </div>
        </div>
    );
}

function getErrorMessage(errorCode: string): string {
    switch (errorCode) {
        case "oauth_denied":
            return "OAuth access was denied. Please try again.";
        case "oauth_init_failed":
            return "Could not connect to the OAuth provider. Please try again.";
        case "oauth_callback_failed":
            return "OAuth callback failed. Please try again.";
        case "oauth_failed":
            return "Authentication failed. Please try again.";
        default:
            return "An unexpected error occurred. Please try again.";
    }
}
