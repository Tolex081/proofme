import { CircleCheck } from "lucide-react";

const POINTS = [
  "No wallet or NEAR account needed to start",
  "Everything you add stays private until you share it",
  "Only the organisation you worked with can confirm your work",
];

/** The two-panel frame shared by sign-in and registration. */
export function AuthShell({
  title,
  intro,
  children,
  footnote,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
  footnote: React.ReactNode;
}) {
  return (
    <section className="column grid items-start gap-10 pt-6 pb-20 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:pt-12">
      <div className="card p-7 sm:p-10">
        <h1 className="text-[clamp(2rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.04em]">
          {title}
        </h1>
        {intro ? <p className="mt-3 text-muted">{intro}</p> : null}
        <div className="mt-8">{children}</div>
        <p className="mt-8 border-t border-line pt-6 text-[0.9rem] text-muted">{footnote}</p>
      </div>

      <div className="hidden lg:block lg:pt-6">
        <p className="font-display text-[clamp(1.8rem,3vw,2.4rem)] leading-[1.08] font-bold tracking-[-0.03em]">
          Your work, <span className="marker">confirmed</span> by the people who saw it.
        </p>
        <ul className="mt-8 grid gap-4">
          {POINTS.map((point) => (
            <li key={point} className="flex gap-3 text-[1.02rem]">
              <CircleCheck
                aria-hidden="true"
                size={21}
                strokeWidth={2.25}
                className="mt-0.5 flex-none text-ok-ink"
              />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
