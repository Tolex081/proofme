import { Check, Clock } from "lucide-react";

/**
 * The hero's sample profile. Everything in it is fictional and labelled so:
 * the person, the organisations and the contributions are not real records.
 */
const ENTRIES = [
  {
    when: "October 2026",
    title: "Proposal review interface",
    org: "Northstar Protocol",
    kind: "Development",
    initial: "N",
    colour: "#4C6EF5",
    verified: true,
  },
  {
    when: "August 2026",
    title: "Mentored three hackathon teams",
    org: "Harbour Hack",
    kind: "Mentorship",
    initial: "H",
    colour: "#E8590C",
    verified: true,
  },
  {
    when: "June 2026",
    title: "Contributor onboarding guide",
    org: "Meridian DAO",
    kind: "Documentation",
    initial: "M",
    colour: "#0F8B72",
    verified: false,
  },
] as const;

export function SampleTimeline() {
  return (
    <figure className="card relative p-6 sm:p-8" aria-label="A sample ProofMe profile">
      <figcaption className="absolute -top-3.5 right-6 rounded-full bg-ink px-3.5 py-1.5 text-label font-semibold text-canvas">
        Sample profile
      </figcaption>

      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 place-items-center rounded-[1.1rem] bg-[#FFD166] font-display text-xl font-extrabold text-[#1B1A2E]"
        >
          DO
        </span>
        <div>
          <p className="font-display text-subhead font-bold tracking-[-0.02em]">Daniel Okafor</p>
          <p className="text-note text-muted">Frontend engineer · 2 verified contributions</p>
        </div>
      </div>

      <ol className="relative mt-6 grid gap-4 pl-8 before:absolute before:top-2 before:bottom-2 before:left-[0.6875rem] before:w-0.5 before:bg-line">
        {ENTRIES.map((entry) => (
          <li key={entry.title} className="relative">
            <span
              aria-hidden="true"
              className="absolute top-1 -left-[1.6rem] size-3.5 rounded-full border-[3px] bg-surface"
              style={{ borderColor: entry.colour }}
            />
            <p className="text-label font-semibold text-faint">{entry.when}</p>
            <div className="well mt-1.5 flex flex-wrap items-center gap-3.5 p-3.5">
              <span aria-hidden="true" className="org-mark" style={{ background: entry.colour }}>
                {entry.initial}
              </span>
              <div className="min-w-[8.5rem] flex-1">
                <p className="font-semibold leading-snug">{entry.title}</p>
                <p className="text-meta text-muted">
                  {entry.org} · {entry.kind}
                </p>
              </div>
              {entry.verified ? (
                <span className="chip chip-ok">
                  <Check aria-hidden="true" size={13} strokeWidth={3} /> Verified
                </span>
              ) : (
                <span className="chip chip-wait">
                  <Clock aria-hidden="true" size={13} strokeWidth={2.5} /> In review
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
