"use client"

const cases = [
  {
    title: "Candidate interviews",
    desc: "Private 1:1 rooms with captions, recording handoff, and clear follow-up notes.",
    src: "/images/timeline-editing.jpg",
  },
  {
    title: "Team standups",
    desc: "Group calls with chat, reactions, action items, and room analytics.",
    src: "/images/studio-setup-ui.jpg",
  },
  {
    title: "Secure reviews",
    desc: "Encrypted conversations and shared whiteboards for sensitive decisions.",
    src: "/images/hero-dashboard.jpg"
  },
  {
    title: "Onboarding sessions",
    desc: "Accessible live captions and summaries for distributed new-hire cohorts.",
    src: "/images/feature-ai-cohost.jpg",
  },
]

export function UseCases() {
  return (
    <section id="use-cases" className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="mb-8 max-w-2xl">
        <p className="mb-2 text-xs font-bold uppercase text-primary">Collaboration modes</p>
        <h2 className="text-3xl font-bold md:text-4xl">Designed for meetings that need a record.</h2>
      </div>
      <div className="grid gap-5 md:grid-cols-4">
        {cases.map((c) => (
          <div key={c.title} className="overflow-hidden rounded-xl border border-border bg-card/85 shadow-soft">
            <div className="aspect-[4/3] border-b border-border bg-background">
              <img
                src={c.src}
                alt={`${c.title} illustration`}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-4">
              <h3 className="font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
