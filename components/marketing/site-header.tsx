"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-contributors", label: "For contributors" },
  { href: "/for-organisations", label: "For organisations" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
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
    <header className="on-ink relative z-10">
      <a
        href="#main"
        className="action action-primary absolute top-2 left-2 -translate-y-20 focus-visible:translate-y-0"
      >
        Skip to content
      </a>

      <div className="column credits items-center py-5">
        <Link
          href="/"
          className="name justify-self-start text-[1.35rem] tracking-[-0.01em] no-underline md:justify-self-end"
          aria-label="ProofMe home"
        >
          Proof<span className="text-teal-bright">Me</span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex flex-wrap gap-x-8 gap-y-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="font-display inline-flex min-h-11 items-center text-[1rem] text-on-ink-muted no-underline transition-colors hover:text-on-ink aria-[current=page]:text-on-ink aria-[current=page]:underline aria-[current=page]:decoration-teal-bright aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="font-display inline-flex min-h-11 items-center gap-2 justify-self-end text-[1rem] text-on-ink md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <X aria-hidden="true" size={20} strokeWidth={2} />
          ) : (
            <Menu aria-hidden="true" size={20} strokeWidth={2} />
          )}
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <nav id={menuId} aria-label="Main" hidden={!open} className="md:hidden">
        <ul className="column border-t border-ink-line pt-2 pb-5">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="name flex min-h-12 items-center text-[1.3rem] text-on-ink no-underline aria-[current=page]:text-teal-bright"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
