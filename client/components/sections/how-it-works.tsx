"use client"

import Image from "next/image"

const steps = [
  {
    title: "Open a secure room",
    desc: "Start a 1:1 or group call, share the invite code, and let SyncHub establish media, chat, and encryption state.",
    img: "/images/recording-and-rtmp.jpg",
  },
  {
    title: "Collaborate around the live signal",
    desc: "Use captions, whiteboard, reactions, and chat without hiding the video grid or interrupting the speaker.",
    img: "/images/timeline-editing.jpg",
  },
  {
    title: "Leave with usable context",
    desc: "Generate summaries, export action items, and review analytics after the room closes.",
    img: "/images/studio-setup-ui.jpg",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase text-primary">Room flow</p>
          <h2 className="text-3xl font-bold md:text-4xl">From invite to outcomes in three moves.</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          The interface keeps the meeting surface stable while collaboration and AI context collect around it.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {steps.map((s, index) => (
          <div key={s.title} className="overflow-hidden rounded-xl border border-border bg-card/85 shadow-soft">
            <div className="relative overflow-hidden border-b border-border bg-background">
              <Image
                src={s.img}
                alt={s.title}
                width={400}
                height={220}
                className="h-44 w-full object-cover"
              />
              <div className="absolute left-4 top-4 grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-signal">
                {index + 1}
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
