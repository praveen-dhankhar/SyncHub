import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Brain, Captions, FileVideo, LockKeyhole, MessageSquareText, PenTool } from "lucide-react"
import Image from "next/image"

const features = [
  {
    title: "Encrypted meeting rooms",
    desc: "ECDH key exchange and AES-GCM media protection keep private conversations private while the room stays simple to join.",
    img: "/images/feature-multitrack.jpg", // Reusing an existing placeholder
    icon: LockKeyhole,
  },
  {
    title: "Live captions and transcripts",
    desc: "Browser-native speech capture gives every participant a readable trail of the conversation as decisions happen.",
    img: "/images/feature-ai-cohost.jpg",
    icon: Captions,
  },
  {
    title: "Shared whiteboard canvas",
    desc: "Sketch flows, mark screenshots, and clear the board together through the same signaling channel as the call.",
    img: "/images/feature-triple-recording.jpg",
    icon: PenTool,
  },
  {
    title: "Action items from discussion",
    desc: "SyncHub listens for owners, due dates, and follow-ups, then keeps the action list beside chat during the meeting.",
    img: "/images/hero-dashboard.jpg",
    icon: Brain,
  },
  {
    title: "Local recording handoff",
    desc: "Record the active streams in the browser and receive downloadable WebM files without changing the room flow.",
    img: "/images/feature-ai-cohost.jpg", // Placeholder
    icon: FileVideo,
  },
  {
    title: "Reactions without interruption",
    desc: "Fast emoji reactions, chat messages, and AI reply suggestions keep feedback visible without derailing the speaker.",
    img: "/images/feature-multitrack.jpg", // Placeholder
    icon: MessageSquareText,
  },
]

export function FeatureCards({ className }: { className?: string }) {
  return (
    <section id="learn-more" className={cn("mx-auto max-w-6xl px-6 py-10 md:py-16", className)}>
      <div className="mb-8 max-w-2xl">
        <p className="mb-2 text-xs font-bold uppercase text-primary">Meeting stack</p>
        <h2 className="text-3xl font-bold md:text-4xl">Everything in the room has a job.</h2>
        <p className="mt-3 text-muted-foreground">
          SyncHub’s interface is built around active collaboration: video stays central, context gathers at the edge, and AI output remains inspectable.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className="group overflow-hidden border-border/80 bg-card/85 py-0 transition-transform duration-200 hover:-translate-y-1">
            <div className="relative border-b border-border">
              <Image
                src={f.img}
                alt={f.title}
                width={400}
                height={220}
                className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <div className="absolute left-4 top-4 grid size-10 place-items-center rounded-lg border border-border bg-background/85 text-primary backdrop-blur">
                <f.icon size={18} />
              </div>
            </div>
            <CardHeader className="pb-1 pt-5">
              <CardTitle className="text-lg">{f.title}</CardTitle>
            </CardHeader>
            <CardContent className="pb-5 text-sm leading-6 text-muted-foreground">{f.desc}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
