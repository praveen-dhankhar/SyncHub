"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Captions,
  CircleDot,
  FileVideo,
  LockKeyhole,
  Menu,
  Moon,
  PanelsTopLeft,
  PenTool,
  Radar,
  ScanText,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Video,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import RotatingEarth from "@/components/ui/wireframe-dotted-globe";
import { DottedSurface } from "@/components/ui/dotted-surface";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#flow", label: "How it works" },
  { href: "#use-cases", label: "Use cases" },
];

const featureCards = [
  {
    title: "Encrypted Rooms",
    description: "Ephemeral keys, controlled entry, and room state that stays private by default.",
    icon: LockKeyhole,
    accent: "text-brand-cyan",
  },
  {
    title: "Whiteboard Canvas",
    description: "Sketch over the conversation without pushing the video grid out of the way.",
    icon: PenTool,
    accent: "text-brand-purple",
  },
  {
    title: "AI Action Items",
    description: "Owners, deadlines, and follow-ups surface live while the room is still talking.",
    icon: BrainCircuit,
    accent: "text-brand-cyan",
  },
  {
    title: "Local Recording",
    description: "Record locally, keep control of the file, and ship the playback out when you are ready.",
    icon: FileVideo,
    accent: "text-destructive",
  },
];

const workflowSteps = [
  {
    title: "Open the room",
    description: "Start a free room, drop the link into chat, and let SyncHub bring up video, chat, and shared context.",
    icon: Video,
  },
  {
    title: "Work inside the signal",
    description: "Captions, whiteboard, and AI notes stay adjacent to the call instead of replacing it.",
    icon: Captions,
  },
  {
    title: "Leave with outcomes",
    description: "Review the transcript, export the action list, and carry the room forward without cleanup work.",
    icon: ScanText,
  },
];

const useCases = [
  {
    title: "Candidate interviews",
    description: "Private rooms with a transcript trail, local recording, and clear follow-up actions.",
  },
  {
    title: "Team standups",
    description: "Fast group rooms with captions, board notes, and owners attached before everyone drops.",
  },
  {
    title: "Design crits",
    description: "Keep the whiteboard live while decisions, blockers, and next moves collect on the side.",
  },
  {
    title: "Client reviews",
    description: "Share a room, protect the discussion, and leave with a written record that can be forwarded.",
  },
];

const transcriptLines = [
  "Ava: Lock the onboarding launch for Thursday and keep the transcript public to the room.",
  "Rohan: I will own the landing QA pass and post the final notes before 18:00.",
  "SyncHub AI: Action item created for Rohan with due date Thursday at 18:00.",
];

type RoomType = "GROUP" | "ONE_TO_ONE";

export function LandingPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingType, setCreatingType] = useState<RoomType | null>(null);
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const syncScrollState = useEffectEvent(() => {
    setNavScrolled(window.scrollY > 80);
  });

  useEffect(() => {
    setMounted(true);
    void apiRequest("/auth/ws-token", undefined, "GET")
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    syncScrollState();
    window.addEventListener("scroll", syncScrollState, { passive: true });
    return () => window.removeEventListener("scroll", syncScrollState);
  }, [syncScrollState]);

  const sectionReveal = reduceMotion
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  const timelineReveal = reduceMotion
    ? { hidden: {}, show: { transition: { staggerChildren: 0 } } }
    : { hidden: {}, show: { transition: { staggerChildren: 0.2 } } };

  async function handleCreateRoom(type: RoomType) {
    setCreatingType(type);

    try {
      const payload =
        type === "GROUP"
          ? { name: "SyncHub Team Room", type, maxParticipants: 10 }
          : { name: "SyncHub Quick Room", type };
      const room = await apiRequest("/rooms", payload);
      router.push(type === "GROUP" ? `/group/${room.id}` : `/call/${room.id}`);
    } catch {
      router.push("/auth/login");
    } finally {
      setCreatingType(null);
    }
  }

  async function handleJoinRoom() {
    const rawValue = joinValue.trim();
    if (!rawValue) {
      setJoinError("Paste a room link or code.");
      return;
    }

    setJoining(true);
    setJoinError("");

    const parsedPath = parseDirectPath(rawValue);
    if (parsedPath) {
      router.push(parsedPath);
      return;
    }

    try {
      const room = await apiRequest(`/rooms/${rawValue}`, undefined, "GET");
      router.push(room.type === "GROUP" ? `/group/${room.id}` : `/call/${room.id}`);
      return;
    } catch {}

    try {
      const room = await apiRequest(`/rooms/join/${rawValue}`, {});
      router.push(room.type === "GROUP" ? `/group/${room.id}` : `/call/${room.id}`);
    } catch {
      setJoinError("That room link did not resolve.");
      setJoining(false);
      return;
    }

    setJoining(false);
  }

  const authLabel = isLoggedIn ? "Open dashboard" : "Login";

  return (
    <main className="relative min-h-screen overflow-x-clip text-text-primary">
      <LandingBackdrop />

      <header className="sticky top-4 z-50 px-4 sm:px-6">
        <div
          className={cn(
            "surface-panel mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full px-4 py-3 transition-colors duration-300 sm:px-5",
            navScrolled ? "border-border-default" : "border-border-subtle"
          )}
        >
          <a href="#" className="flex items-center gap-3">
            <span className="brand-mark">
              <Radar className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-text-primary sm:text-base">
              SyncHub
            </span>
          </a>

          <nav className="hidden items-center gap-5 text-sm text-text-secondary md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-text-primary">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LandingThemeToggle mounted={mounted} />
            <button
              type="button"
              onClick={() => router.push(isLoggedIn ? "/dashboard" : "/auth/login")}
              className="hero-button px-4 py-2 text-sm"
            >
              {authLabel}
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <LandingThemeToggle mounted={mounted} />
            {mounted ? (
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <button type="button" className="menu-button px-3 py-2 text-sm">
                    <Menu className="size-4" />
                    Menu
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="menu-sheet rounded-t-3xl border-border-default px-0 pb-6 pt-0">
                  <SheetHeader className="px-5 pt-5">
                    <SheetTitle className="text-base text-text-primary">SyncHub</SheetTitle>
                    <SheetDescription className="text-text-secondary">
                      Secure rooms, live captions, and AI outcomes without a second workspace.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="space-y-3 px-5">
                    {navLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className="menu-link flex items-center justify-between rounded-2xl px-4 py-4 text-sm text-text-primary"
                      >
                        <span>{link.label}</span>
                        <ArrowRight className="size-4 text-text-secondary" />
                      </a>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 px-5">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push(isLoggedIn ? "/dashboard" : "/auth/login");
                      }}
                      className="hero-button w-full justify-center px-4 py-3 text-sm"
                    >
                      {authLabel}
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <button type="button" className="menu-button px-3 py-2 text-sm">
                <Menu className="size-4" />
                Menu
              </button>
            )}
          </div>
        </div>
      </header>

      <motion.section
        initial="hidden"
        animate="show"
        variants={timelineReveal}
        className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24"
      >
        {/* Globe — visible, floating beside hero */}
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-end overflow-visible opacity-50 lg:opacity-[0.65]">
          <div className="relative -right-[5%] w-[60%] max-w-[600px] drop-shadow-[0_0_60px_rgba(52,168,90,0.25)]">
            <RotatingEarth width={600} height={600} />
          </div>
        </div>

        <motion.div variants={sectionReveal} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 mx-auto max-w-3xl space-y-8 text-center">
          <div className="eyebrow-badge mx-auto w-fit">
            <span className="live-pulse-dot" />
            <span className="mono-label font-mono uppercase text-text-secondary">
              Encrypted · E2E · Live AI
            </span>
          </div>

          <div className="space-y-5">
            <h1 className="font-display hero-title mx-auto max-w-3xl text-balance font-extrabold">
              Video calls that leave you with{" "}
              <span className="gradient-word whitespace-nowrap">something.</span>
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-8 text-text-secondary sm:text-lg">
              SyncHub keeps the meeting itself steady while captions, action items, whiteboard context,
              and recordings assemble around it in real time.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleCreateRoom("ONE_TO_ONE")}
              disabled={creatingType !== null}
              className="hero-button button-shimmer px-6 py-3.5 text-sm"
            >
              {creatingType === "ONE_TO_ONE" ? "Opening room..." : "Start Free Room"}
              <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleCreateRoom("GROUP")}
              disabled={creatingType !== null}
              className="hero-button-secondary px-6 py-3.5 text-sm"
            >
              {creatingType === "GROUP" ? "Opening group room..." : "Start Team Room"}
            </button>
          </div>

          <div className="landing-input-shell mx-auto max-w-xl rounded-3xl p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-brand-cyan">
                  <Video className="size-5" />
                </div>
                <div className="flex-1 text-left">
                  <label htmlFor="room-link" className="mono-label mb-2 block uppercase text-text-secondary">
                    Join with link
                  </label>
                  <input
                    id="room-link"
                    value={joinValue}
                    onChange={(event) => {
                      setJoinValue(event.target.value);
                      setJoinError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleJoinRoom();
                      }
                    }}
                    placeholder="https://synchub.io/r/..."
                    className="landing-input w-full border-0 bg-transparent p-0 font-mono text-sm text-text-primary shadow-none outline-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleJoinRoom()}
                disabled={joining}
                className="hero-button min-w-32 justify-center px-5 py-3 text-sm"
              >
                {joining ? "Joining..." : "Join room"}
              </button>
            </div>
            {joinError ? <p className="mt-3 pl-14 text-sm text-brand-red">{joinError}</p> : null}
          </div>

          <div className="mx-auto grid max-w-lg gap-3 sm:grid-cols-3">
            <TrustChip icon={ShieldCheck} label="Private rooms" />
            <TrustChip icon={Captions} label="Live transcript" />
            <TrustChip icon={Sparkles} label="Actionable AI" />
          </div>
        </motion.div>
      </motion.section>

      <motion.section
        id="features"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
        variants={timelineReveal}
        className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8"
      >
        <motion.div variants={sectionReveal} className="mb-12 max-w-3xl">
          <p className="section-kicker">Feature stack</p>
          <h2 className="font-display display-heading mt-3 text-3xl font-extrabold text-text-primary sm:text-4xl">
            A room that writes things down while people are still talking.
          </h2>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            The layout stays deliberate: one wide transcript rail, focused feature cards, and a surface
            hierarchy that reads the same way in light and dark.
          </p>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-6">
          <motion.article variants={sectionReveal} className="landing-card panel-card surface-panel flex min-h-56 flex-col p-6 lg:col-span-2">
            <FeatureCardHeader icon={featureCards[0].icon} title={featureCards[0].title} accent={featureCards[0].accent} />
            <p className="mt-5 max-w-sm text-sm leading-7 text-text-secondary">{featureCards[0].description}</p>
            <div className="overline-label mt-auto flex items-center gap-2 pt-6 text-xs uppercase text-text-secondary">
              <span className="rounded-full border border-border-subtle px-2 py-1">ECDH</span>
              <span className="rounded-full border border-border-subtle px-2 py-1">AES-GCM</span>
            </div>
          </motion.article>

          <motion.article variants={sectionReveal} className="landing-card panel-card surface-panel flex min-h-56 flex-col p-6 lg:col-span-4">
            <FeatureCardHeader icon={Captions} title="Live Captions + Transcript" accent="text-brand-cyan" />
            <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary">
              SyncHub keeps a readable trail beside the call so summaries and follow-ups are grounded in the room.
            </p>
            <div className="feature-split mt-6 grid gap-4">
              <TranscriptTypewriter />
              <div className="rounded-3xl border border-border-subtle bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="overline-label text-xs uppercase text-text-secondary">Live state</span>
                  <span className="flex items-center gap-2 text-xs text-brand-cyan">
                    <CircleDot className="size-3 fill-current" />
                    Synced
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <MetricBar label="Caption confidence" value="97%" widthClassName="metric-width-97" />
                  <MetricBar label="Transcript persistence" value="Active" widthClassName="metric-width-85" />
                  <MetricBar label="Citation windows" value="Ready" widthClassName="metric-width-74" />
                </div>
              </div>
            </div>
          </motion.article>

          {featureCards.slice(1).map((card) => (
            <motion.article
              key={card.title}
              variants={sectionReveal}
              className="landing-card panel-card surface-panel flex min-h-56 flex-col p-6 lg:col-span-2"
            >
              <FeatureCardHeader icon={card.icon} title={card.title} accent={card.accent} />
              <p className="mt-5 max-w-sm text-sm leading-7 text-text-secondary">{card.description}</p>
              <div className="overline-label mt-auto pt-6 text-xs uppercase text-text-secondary">
                {card.title === "Whiteboard Canvas" && "Shared sketch surface"}
                {card.title === "AI Action Items" && "Structured outputs"}
                {card.title === "Local Recording" && "Browser-owned files"}
              </div>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <motion.section
        id="flow"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
        variants={timelineReveal}
        className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8"
      >
        <motion.div variants={sectionReveal} className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="section-kicker">How it works</p>
            <h2 className="font-display display-heading mt-3 text-3xl font-extrabold text-text-primary sm:text-4xl">
              Open the room, work in the signal, leave with a record.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-text-secondary">
            The room flow is linear on purpose. Nothing here asks people to swap tabs or chase notes after the call ends.
          </p>
        </motion.div>

        <motion.ol variants={timelineReveal} className="timeline-shell relative flex gap-4 overflow-x-auto pb-4">
          <div aria-hidden className="timeline-rail hidden lg:block" />
          {workflowSteps.map((step, index) => (
            <motion.li
              key={step.title}
              variants={sectionReveal}
              className="landing-card panel-card surface-panel timeline-step relative flex min-h-64 min-w-72 flex-1 flex-col p-6"
            >
              <div className="flex items-center justify-between">
                <span className="timeline-count">{String(index + 1).padStart(2, "0")}</span>
                <step.icon className="size-5 text-brand-cyan" />
              </div>
              <h3 className="mt-8 text-xl font-semibold text-text-primary">{step.title}</h3>
              <p className="mt-4 max-w-sm text-sm leading-7 text-text-secondary">{step.description}</p>
            </motion.li>
          ))}
        </motion.ol>
      </motion.section>

      <motion.section
        id="use-cases"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.25 }}
        variants={timelineReveal}
        className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8"
      >
        <motion.div variants={sectionReveal} className="mb-8 max-w-3xl">
          <p className="section-kicker">Use cases</p>
          <h2 className="font-display display-heading mt-3 text-3xl font-extrabold text-text-primary sm:text-4xl">
            Built for conversations that need a clean exit path.
          </h2>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((item, index) => (
            <motion.article
              key={item.title}
              variants={sectionReveal}
              className="landing-card panel-card surface-panel flex flex-col p-6"
            >
              <span className="overline-label text-xs uppercase text-text-secondary">0{index + 1}</span>
              <h3 className="mt-6 text-lg font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{item.description}</p>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <section className="mt-24 border-t border-border-subtle">
        <div className="spotlight-cta relative">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <p className="section-kicker justify-center">Start now</p>
            <h2 className="font-display display-heading mt-4 text-balance text-3xl font-extrabold text-text-primary sm:text-5xl">
              Open a secure room and leave with something usable.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-text-secondary">
              Meeting context should be an output, not a memory problem.
            </p>
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => void handleCreateRoom("ONE_TO_ONE")}
                disabled={creatingType !== null}
                className="hero-button button-shimmer px-6 py-3.5 text-sm"
              >
                {creatingType === "ONE_TO_ONE" ? "Opening room..." : "Start Free Room"}
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 border-t border-border-subtle py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <span className="brand-mark">
                  <Radar className="size-4" />
                </span>
                <span className="text-sm font-semibold text-text-primary">SyncHub</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href} className="transition-colors hover:text-text-primary">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="text-sm text-text-secondary">© 2026 SyncHub. Open a room and get to work.</div>
          </div>
        </footer>
      </section>
    </main>
  );
}

function LandingBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 bg-void" />
      <DottedSurface className="!fixed opacity-60" style={{ zIndex: 1 }} />
      <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ zIndex: 2 }}>
        <div className="landing-noise absolute inset-0" />
        <div className="landing-orb landing-orb-cyan" />
        <div className="landing-orb landing-orb-purple" />
      </div>
    </div>
  );
}

function LandingThemeToggle({ mounted }: { mounted: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return <span className="menu-button size-10" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className="menu-button size-10"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function TrustChip({
  icon: Icon,
  label,
}: {
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <div className="surface-panel inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-text-secondary">
      <Icon className="size-4 text-brand-cyan" />
      <span>{label}</span>
    </div>
  );
}

/* CallPreview removed — replaced by RotatingEarth globe in hero background */

function FeatureCardHeader({
  icon: Icon,
  title,
  accent,
}: {
  icon: typeof LockKeyhole;
  title: string;
  accent: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="section-kicker">{title}</span>
      </div>
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl bg-surface", accent)}>
        <Icon className="size-5" />
      </span>
    </div>
  );
}

function TranscriptTypewriter() {
  const reduceMotion = useReducedMotion();
  const [history, setHistory] = useState<string[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  const currentLine = transcriptLines[lineIndex] ?? transcriptLines[0];

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (charIndex < currentLine.length) {
        setCharIndex((value) => value + 1);
        return;
      }

      setHistory((value) => [...value, currentLine].slice(-2));
      setLineIndex((value) => (value + 1) % transcriptLines.length);
      setCharIndex(0);
    }, charIndex < currentLine.length ? 52 : 1800);

    return () => window.clearTimeout(timeoutId);
  }, [charIndex, currentLine, reduceMotion]);

  const renderedLines = reduceMotion
    ? transcriptLines
    : [...history, currentLine.slice(0, charIndex), "\u00A0"].slice(-3);

  return (
    <div className="rounded-3xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="overline-label text-xs uppercase text-text-secondary">Transcript stream</span>
        <span className="flex items-center gap-2 text-xs text-brand-cyan">
          <CircleDot className="size-3 fill-current" />
          Live
        </span>
      </div>
      <div className="mt-4 space-y-3 font-mono text-sm leading-7 text-text-secondary">
        {renderedLines.map((line, index) => {
          const isActive = !reduceMotion && index === renderedLines.length - 2;
          return (
            <p key={`${index}-${line}`} className="min-h-7">
              <span className={cn(isActive ? "transcript-cursor" : undefined)}>
                {line || "\u00A0"}
              </span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  widthClassName,
}: {
  label: string;
  value: string;
  widthClassName: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-surface">
        <div className={cn("metric-bar h-full rounded-full bg-brand-cyan", widthClassName)} />
      </div>
    </div>
  );
}

function parseDirectPath(rawValue: string) {
  try {
    const parsed = new URL(rawValue);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const roomToken = segments.at(-1);

    if (!roomToken) {
      return null;
    }

    if (segments.includes("group")) {
      return `/group/${roomToken}`;
    }

    if (segments.includes("call")) {
      return `/call/${roomToken}`;
    }

    if (segments.includes("join")) {
      return `/join/${roomToken}`;
    }
  } catch {
    return null;
  }

  return null;
}
