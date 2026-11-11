"use client";

import {
  Bell,
  Building2,
  ChevronDown,
  FileText,
  IdCard,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { authClient } from "@/lib/auth/client";

export const WORKSPACE_LINKS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/contributions", label: "Contributions", icon: FileText },
  { href: "/dashboard/organisations", label: "Organisations", icon: Building2 },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: UserRound },
  { href: "/dashboard/identity", label: "Identity", icon: IdCard },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

function isCurrent(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

/** Section navigation: a column on large screens, a scrolling row on small ones. */
export function SideNav({ unread }: { unread: number }) {
  return <SideNavView pathname={usePathname()} unread={unread} />;
}

/** The navigation without reading the URL, for the static shell. */
export function SideNavView({ pathname, unread }: { pathname: string | null; unread: number }) {
  return (
    <nav aria-label="Workspace" className="lg:sticky lg:top-6 lg:self-start">
      <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:gap-1">
        {WORKSPACE_LINKS.map((link) => {
          const current = pathname !== null && isCurrent(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className="flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-surface px-4 font-semibold whitespace-nowrap text-muted lg:border-0 lg:bg-transparent no-underline transition-colors hover:bg-surface-2 hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-canvas lg:rounded-2xl"
              >
                <link.icon aria-hidden="true" size={18} strokeWidth={2} />
                {link.label}
                {link.href === "/dashboard/notifications" && unread > 0 ? (
                  <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-label font-bold text-brand-ink">
                    {unread}
                    <span className="sr-only"> unread</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The signed-in person's menu in the top bar. */
export function AccountMenu({ name, username }: { name: string; username: string }) {
  const router = useRouter();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && container.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pr-3 pl-1 transition-colors hover:bg-surface-2"
      >
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-full bg-[#FFD166] font-display text-note font-extrabold text-[#1B1A2E]"
        >
          {initials || "?"}
        </span>
        <span className="hidden max-w-[12rem] truncate font-semibold sm:block">{name}</span>
        <ChevronDown aria-hidden="true" size={16} strokeWidth={2.25} className="text-muted" />
        <span className="sr-only">Account menu</span>
      </button>
      <div id={menuId} hidden={!open} className="card absolute right-0 z-30 mt-2 w-64 p-2">
        <p className="px-3 pt-2 pb-3 text-meta text-muted">
          Signed in as <span className="font-semibold text-ink">{username}</span>
        </p>
        <Link
          href="/dashboard/settings"
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold text-ink no-underline hover:bg-surface-2"
        >
          <Settings aria-hidden="true" size={17} /> Settings
        </Link>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-semibold text-ink hover:bg-surface-2"
        >
          <LogOut aria-hidden="true" size={17} /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
