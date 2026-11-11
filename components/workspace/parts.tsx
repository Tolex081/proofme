import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeSwitch } from "@/components/brand/theme-switch";

/** The workspace top bar. `account` is streamed in once the session is read. */
export function WorkspaceTopBar({ account }: { account: React.ReactNode }) {
  return (
    <header className="border-b border-line bg-surface">
      <a
        href="#main"
        className="action action-primary absolute top-2 left-2 z-40 -translate-y-24 focus-visible:translate-y-0"
      >
        Skip to content
      </a>
      <div className="column flex min-h-16 items-center gap-4">
        <Link href="/dashboard" aria-label="ProofMe workspace" className="no-underline">
          <Logo size={28} />
        </Link>
        <span className="chip chip-neutral hidden sm:inline-flex">Testnet build</span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeSwitch />
          {account}
        </div>
      </div>
    </header>
  );
}

export function PageHeading({
  title,
  intro,
  action,
}: {
  title: string;
  intro?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[44rem]">
        <h1 className="text-page leading-[1.05] font-extrabold tracking-[-0.04em]">{title}</h1>
        {intro ? <p className="mt-2 text-muted">{intro}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  intro,
  id,
  children,
  tone = "default",
}: {
  title: string;
  intro?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={`card scroll-mt-6 p-6 sm:p-8 ${tone === "danger" ? "border-bad-ink/40" : ""}`}
    >
      <h2 id={id ? `${id}-title` : undefined} className="text-subhead leading-tight">
        {title}
      </h2>
      {intro ? <p className="mt-1.5 max-w-[60ch] text-muted">{intro}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Shown while a page's signed-in content streams in. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="h-10 w-72 max-w-full rounded-xl bg-surface-2" />
      <div className="mt-3 h-5 w-96 max-w-full rounded-lg bg-surface-2" />
      <div className="mt-8 h-64 rounded-[1.75rem] bg-surface-2" />
    </div>
  );
}
