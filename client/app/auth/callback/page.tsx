"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * OAuth callback page — receives a one-time auth code from the query string
 * and exchanges it for httpOnly cookie tokens via the backend.
 *
 * URL format: /auth/callback?code=xxx
 *
 * Flow:
 * 1. Extract `code` from URL params
 * 2. POST /auth/exchange-code with the code → backend sets httpOnly cookies
 * 3. GET /auth/me with credentials:include → verify session works
 * 4. Redirect to /dashboard on success
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
    const [status, setStatus] = useState("Signing you in...");

    useEffect(() => {
        const code = searchParams.get("code");
        const oauthError = searchParams.get("error");

        // Handle OAuth errors (redirected from backend)
        if (oauthError) {
            console.error("[Callback] OAuth error from backend:", oauthError);
            setError(getErrorMessage(oauthError));
            setTimeout(() => router.replace("/auth/login"), 3000);
            return;
        }

        if (!code) {
            console.error("[Callback] No code in URL, redirecting to login");
            router.replace("/auth/login");
            return;
        }

        // Exchange the one-time code for tokens (set as httpOnly cookies)
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        console.log(`[Callback] Exchanging code (${code.slice(0, 8)}...) at ${API_BASE}/auth/exchange-code`);

        setStatus("Exchanging auth code...");

        fetch(`${API_BASE}/auth/exchange-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ code }),
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                console.log("[Callback] exchange-code response:", res.status, data);

                if (!res.ok) {
                    throw new Error(data.message || `Exchange failed (${res.status})`);
                }

                // Cookies should now be set. Verify session by calling /auth/me
                setStatus("Verifying session...");
                console.log("[Callback] Exchange succeeded. Calling /auth/me to verify session...");

                const meRes = await fetch(`${API_BASE}/auth/me`, {
                    method: "GET",
                    credentials: "include",
                });

                const meData = await meRes.json().catch(() => ({}));
                console.log("[Callback] /auth/me response:", meRes.status, meData);

                if (!meRes.ok) {
                    console.error("[Callback] /auth/me returned non-OK:", meRes.status, meData);
                    // Session cookie might not have been set properly
                    // Still redirect to dashboard — page-level auth check will catch it
                    console.warn("[Callback] Proceeding to dashboard despite /auth/me failure");
                }

                // Clear code from URL for security
                window.history.replaceState(null, "", "/auth/callback");

                setStatus("Success! Redirecting...");
                console.log("[Callback] Redirecting to /dashboard");
                router.replace("/dashboard");
            })
            .catch((err) => {
                console.error("[Callback] Exchange/verification failed:", err);
                setError(err instanceof Error ? err.message : "Authentication failed");
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
                        <p className="text-muted-foreground text-sm">{status}</p>
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
