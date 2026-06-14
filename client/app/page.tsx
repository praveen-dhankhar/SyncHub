"use client"

import { useState, useEffect } from "react"
import { Hero } from "@/components/hero"
import { FeatureCards } from "@/components/feature-cards"
import { ThemeToggle } from "@/components/theme-toggle"
import { HowItWorks } from "@/components/sections/how-it-works"
import { UseCases } from "@/components/sections/use-cases"
import { apiRequest } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { LogOut, Radar } from "lucide-react"

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    // httpOnly cookie can't be read by JS — ask the backend instead
    apiRequest("/auth/ws-token", undefined, "GET")
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false))
  }, [])
  return (
    <main className="sync-mesh-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-signal">
              <Radar size={17} />
            </div>
            <span className="text-base font-bold">SyncHub</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#how-it-works" className="text-foreground/80 hover:text-foreground transition-colors">
              Room flow
            </a>
            <a href="#use-cases" className="text-foreground/80 hover:text-foreground transition-colors">
              Collaboration
            </a>
            <a href="/dashboard" className="text-foreground/80 hover:text-foreground transition-colors font-medium">
              Dashboard
            </a>
            <ThemeToggle />
            {isLoggedIn ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    const { apiRequest } = await import('@/lib/api');
                    await apiRequest("/auth/logout", {});
                  } catch { }
                  document.cookie = "accessToken=; Max-Age=0; path=/";
                  setIsLoggedIn(false);
                  window.location.href = "/auth/login";
                }}
                className="text-danger hover:bg-danger/10 hover:text-danger"
              >
                <LogOut size={14} />
                Logout
              </Button>
            ) : (
              <a
                href="/auth/login"
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-signal transition-colors hover:bg-primary/90"
              >
                Login
              </a>
            )}
          </nav>
        </div>
      </header>

      <Hero />
      <FeatureCards />
      <HowItWorks />
      <UseCases />

      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-foreground/70 grid gap-4 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <div aria-hidden className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Radar size={15} />
              </div>
              <span className="font-semibold text-foreground">SyncHub</span>
            </div>
            <p className="mt-3 max-w-sm">Secure video rooms with whiteboards, captions, action items, and analytics in one live workspace.</p>
          </div>
          <div>
            <div className="font-medium mb-2">Product</div>
            <ul className="space-y-1">
              <li>
                <a className="hover:text-foreground" href="#how-it-works">
                  Room flow
                </a>
              </li>
              <li>
                <a className="hover:text-foreground" href="#learn-more">
                  Meeting tools
                </a>
              </li>
              <li>
                <a className="hover:text-foreground" href="/dashboard">
                  Analytics
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-medium mb-2">Company</div>
            <ul className="space-y-1">
              <li>
                <a className="hover:text-foreground" href="#faq">
                  Security
                </a>
              </li>
              <li>
                <a className="hover:text-foreground" href="#learn-more">
                  Features
                </a>
              </li>
              <li>
                <a className="hover:text-foreground" href="#how-it-works">
                  How it works
                </a>
              </li>
            </ul>
          </div>
          <div className="md:col-span-3 mt-4">© {new Date().getFullYear()} SyncHub. All rights reserved.</div>
        </div>
      </footer>
    </main>
  )
}
