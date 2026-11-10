import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** The opener every public page starts with. */
export function TitleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="column pt-8 pb-14 lg:pt-14 lg:pb-20">
      <div className="rise max-w-[46rem]">
        <h1 className="text-[clamp(2.4rem,5.4vw,4.1rem)] leading-[1] font-extrabold tracking-[-0.045em]">
          {title}
        </h1>
        <p className="mt-6 text-[1.15rem] text-muted">{children}</p>
      </div>
    </section>
  );
}

/** A section with a heading on the left and its content on the right. */
export function NoteSection({
  heading,
  intro,
  deep = false,
  children,
}: {
  heading: string;
  intro?: React.ReactNode;
  deep?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={deep ? "bg-surface-2" : undefined}>
      <div className="column grid gap-8 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 lg:py-24">
        <div>
          <h2 className="text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.06]">{heading}</h2>
          {intro ? <p className="mt-4 max-w-[30rem] text-muted">{intro}</p> : null}
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

export interface CreditLine {
  role: string;
  name: string;
  detail?: React.ReactNode;
}

/** Labelled rows inside one card. */
export function CreditList({ lines, ordered = false }: { lines: CreditLine[]; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className="card divide-y divide-line overflow-hidden">
      {lines.map((line, index) => (
        <li key={line.role + line.name} className="flex gap-4 p-6 sm:gap-5 sm:p-7">
          <span
            aria-hidden="true"
            className="grid size-9 flex-none place-items-center rounded-xl bg-highlight font-display text-[0.95rem] font-extrabold text-highlight-ink"
          >
            {ordered ? index + 1 : line.role.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="text-[0.85rem] font-semibold text-muted">{line.role}</p>
            <p className="mt-0.5 font-display text-[1.2rem] leading-snug font-bold tracking-[-0.015em]">
              {line.name}
            </p>
            {line.detail ? <p className="mt-2 text-muted">{line.detail}</p> : null}
          </div>
        </li>
      ))}
    </List>
  );
}

/** Running text, for the reading pages. */
export function Notes({ children }: { children: React.ReactNode }) {
  return <div className="prose-notes">{children}</div>;
}

export function OnwardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <p className="mt-8">
      <Link href={href} className="text-link inline-flex items-center gap-1.5">
        {children}
        <ArrowRight aria-hidden="true" size={17} strokeWidth={2.25} />
      </Link>
    </p>
  );
}
