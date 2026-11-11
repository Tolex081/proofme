"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { ThemeSwitch } from "@/components/brand/theme-switch";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-contributors", label: "For contributors" },
  { href: "/for-organisations", label: "For organisations" },
  { href: "/explore", label: "Explore" },
] as const;

function DesktopLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex gap-7">
      {LINKS.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            className="inline-flex min-h-11 items-center text-[0.95rem] font-medium text-muted no-underline transition-colors hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MenuLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate: () => void }) {
  return LINKS.map((link) => (
    <li key={link.href}>
      <Link
        href={link.href}
        aria-current={pathname === link.href ? "page" : undefined}
        onClick={onNavigate}
        className="flex min-h-12 items-center rounded-2xl px-4 font-display text-[1.15rem] font-bold text-ink no-underline hover:bg-surface-2 aria-[current=page]:bg-surface-2"
      >
        {link.label}
      </Link>
    </li>
  ));
}

// Only these read the URL, so only they stream in. The header itself, and an
// open menu, are never replaced while the page loads.
function CurrentDesktopLinks() {
  return <DesktopLinks pathname={usePathname()} />;
}

function CurrentMenuLinks({ onNavigate }: { onNavigate: () => void }) {
  return <MenuLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

export function SiteHeader() {
  const menuId = useId();
  const [open, setOpen] = useState(false);

  // The small-screen menu closes when a link in it is followed, and on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="relative z-20">
      <a
        href="#main"
        className="action action-primary absolute top-2 left-2 -translate-y-24 focus-visible:translate-y-0"
      >
        Skip to content
      </a>

      <div className="column flex min-h-20 items-center gap-8">
        <Link href="/" aria-label="ProofMe home" className="no-underline">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <Suspense fallback={<DesktopLinks pathname={null} />}>
            <CurrentDesktopLinks />
          </Suspense>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch />
          <Link href="/login" className="action action-secondary hidden sm:inline-flex">
            Sign in
          </Link>
          <Link href="/register" className="action action-primary hidden sm:inline-flex">
            Start your record
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-ink hover:bg-surface-2 lg:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <X aria-hidden="true" size={22} strokeWidth={2} />
            ) : (
              <Menu aria-hidden="true" size={22} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      <nav id={menuId} aria-label="Main" hidden={!open} className="lg:hidden">
        <div className="column pb-6">
          <ul className="card grid gap-1 p-3">
            <Suspense fallback={<MenuLinks pathname={null} onNavigate={() => setOpen(false)} />}>
              <CurrentMenuLinks onNavigate={() => setOpen(false)} />
            </Suspense>
            <li className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="action action-secondary"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="action action-primary"
              >
                Start your record
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
