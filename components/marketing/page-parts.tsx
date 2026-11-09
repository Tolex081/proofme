import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** The ink opener every public page starts with. */
export function TitleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="on-ink">
      <div className="column pt-[clamp(2rem,6vh,4rem)] pb-[clamp(3rem,8vh,5rem)]">
        <div className="credits settle">
          <h1 className="from-axis max-w-[18ch] text-[clamp(2.2rem,4.8vw,3.6rem)] leading-[1.05] tracking-[-0.02em]">
            {title}
          </h1>
          <p className="from-axis mt-5 max-w-[58ch] text-[1.08rem] text-on-ink-muted">{children}</p>
        </div>
      </div>
    </section>
  );
}

/** A paper section with a heading on the axis and free content beneath it. */
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
    <section className={deep ? "on-paper-deep" : "on-paper"}>
      <div className="column py-[clamp(3.5rem,8vw,6rem)]">
        <div className="credits">
          <h2 className="from-axis max-w-[24ch] text-[clamp(1.7rem,3.1vw,2.4rem)] leading-[1.1] tracking-[-0.016em]">
            {heading}
          </h2>
          {intro ? (
            <p className="from-axis mt-4 max-w-[62ch] text-on-paper-muted">{intro}</p>
          ) : null}
        </div>
        <div className="mt-[clamp(1.75rem,3.5vw,2.75rem)]">{children}</div>
      </div>
    </section>
  );
}

export interface CreditLine {
  role: string;
  name: string;
  detail?: React.ReactNode;
}

/** Role-and-fact pairs separated by hairlines. Stacks on small screens. */
export function CreditList({ lines, ordered = false }: { lines: CreditLine[]; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List>
      {lines.map((line, index) => (
        <li
          key={line.role + line.name}
          className={`credits stack-sm py-[clamp(1.1rem,2.2vw,1.7rem)] ${index > 0 ? "border-t border-paper-line" : ""}`}
        >
          <p className="role sm:pt-[0.5rem]">{line.role}</p>
          <div>
            <p className="name max-w-[30ch] text-[clamp(1.2rem,1.9vw,1.55rem)]">{line.name}</p>
            {line.detail ? (
              <p className="mt-2 max-w-[62ch] text-on-paper-muted">{line.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </List>
  );
}

/** Running text on the axis, for the reading pages. */
export function Notes({ children }: { children: React.ReactNode }) {
  return (
    <div className="credits">
      <div className="from-axis prose-notes max-w-[66ch]">{children}</div>
    </div>
  );
}

export function OnwardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="credits mt-[clamp(1.5rem,3vw,2.25rem)]">
      <p className="from-axis">
        <Link href={href} className="text-link inline-flex items-center gap-1.5">
          {children}
          <ArrowRight aria-hidden="true" size={17} strokeWidth={2.25} />
        </Link>
      </p>
    </div>
  );
}
