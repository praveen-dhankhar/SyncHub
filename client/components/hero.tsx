"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { apiRequest } from "@/lib/api"
import { BrandButton } from "./brand-button"
import { Button } from "@/components/ui/button"
import {
  Activity,
  ArrowRight,
  Captions,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from "lucide-react"

export function Hero() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [groupLoading, setGroupLoading] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState("")

  const handleCreateMeeting = async () => {
    setLoading(true)
    try {
      const room = await apiRequest("/rooms", { name: "Quick Session", type: "ONE_TO_ONE" })
      router.push(`/call/${room.id}`)
    } catch {
      router.push("/auth/login")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGroupCall = async () => {
    setGroupLoading(true)
    try {
      const room = await apiRequest("/rooms", { name: "Group Session", type: "GROUP", maxParticipants: 10 })
      router.push(`/group/${room.id}`)
    } catch {
      router.push("/auth/login")
    } finally {
      setGroupLoading(false)
    }
  }

  const handleJoinWithCode = async () => {
    let code = joinCode.trim()
    if (!code) {
      setJoinError("Please enter a room code")
      return
    }
    setJoinError("")

    // Extract room ID from full URL if pasted
    let roomId = code
    try {
      const parsed = new URL(code)
      const segs = parsed.pathname.split("/").filter(Boolean)
      if (segs.length >= 2) {
        roomId = segs[segs.length - 1]
        if (segs.includes("group")) { window.location.href = `/group/${roomId}`; return }
        if (segs.includes("call")) { window.location.href = `/call/${roomId}`; return }
        if (segs.includes("join")) { window.location.href = `/join/${roomId}`; return }
      }
    } catch { roomId = code }

    // Ask backend for room type
    try {
      const room = await apiRequest(`/rooms/${roomId}`, undefined, "GET")
      if (room.type === "GROUP") {
        window.location.href = `/group/${roomId}`
      } else {
        window.location.href = `/call/${roomId}`
      }
    } catch {
      // Maybe it's an invite code instead of a room ID
      try {
        const room = await apiRequest(`/rooms/join/${roomId}`, {})
        if (room.type === "GROUP") {
          window.location.href = `/group/${room.id}`
        } else {
          window.location.href = `/call/${room.id}`
        }
      } catch {
        setJoinError("Invalid room code or link")
      }
    }
  }

  return (
    <section className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="pointer-events-none absolute inset-x-6 top-10 h-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_0.92fr]">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-soft backdrop-blur">
            <span className="flex size-2 rounded-full bg-success" />
            Secure rooms, live notes, zero context switching
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight md:text-6xl">
              Run the meeting and the workspace in one live signal.
            </h1>
            <p className="max-w-2xl text-pretty text-base leading-8 text-muted-foreground md:text-lg">
              SyncHub combines low-latency video, shared whiteboards, captions, reactions, recordings, and AI action items
              so teams can decide, document, and move without leaving the room.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <BrandButton onClick={handleCreateMeeting} disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Video size={18} />}
              Start 1:1 room
            </BrandButton>
            <Button
              variant="outline"
              onClick={handleCreateGroupCall}
              disabled={groupLoading}
              className="w-full border-border/80 bg-card/70 text-foreground hover:bg-secondary sm:w-auto"
            >
              {groupLoading ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}
              Start group room
            </Button>
          </div>

          <div className="max-w-xl space-y-2 rounded-xl border border-border bg-card/75 p-2 shadow-soft backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinWithCode()}
                  placeholder="Paste an invite link or room code"
                  className="h-11 w-full rounded-lg border border-input bg-background/80 pl-10 pr-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <Button variant="secondary" onClick={handleJoinWithCode} className="h-11 px-4">
                Join
                <ArrowRight size={15} />
              </Button>
            </div>
            {joinError && <p className="px-1 text-xs font-medium text-danger">{joinError}</p>}
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              { label: "Encrypted media path", icon: ShieldCheck },
              { label: "Live captions + transcript", icon: Captions },
              { label: "Action items as you talk", icon: Sparkles },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur">
                <item.icon size={15} className="text-primary" />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="signal-grid overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="border-b border-border bg-card/80 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Design Review Room</p>
                  <p className="text-xs text-muted-foreground">6 participants · captions live</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                  <span className="size-1.5 rounded-full bg-success" />
                  LIVE
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-3 sm:grid-cols-2">
              <div className="relative min-h-48 overflow-hidden rounded-xl border border-border bg-muted">
                <Image
                  src="/images/hero-dashboard.jpg"
                  alt="SyncHub meeting analytics and room preview"
                  width={800}
                  height={520}
                  className="h-full w-full object-cover"
                  priority
                />
                <div className="absolute inset-x-3 bottom-3 rounded-lg bg-background/80 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur">
                  Host screen · roadmap metrics
                </div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-xl border border-border bg-background/80 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <MessageSquare size={16} className="text-primary" />
                    Meeting stream
                  </div>
                  <div className="space-y-3 text-xs text-muted-foreground">
                    <p><span className="font-semibold text-foreground">Ava:</span> Let’s lock the launch checklist today.</p>
                    <p><span className="font-semibold text-foreground">SyncHub AI:</span> Captured 3 owners and 2 due dates.</p>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/80 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Activity size={16} className="text-success" />
                    Room health
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 w-5/6 rounded-full bg-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Low latency · E2E key established</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
