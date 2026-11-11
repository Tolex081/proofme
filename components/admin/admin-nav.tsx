"use client";

import {
  ArrowLeft,
  Building2,
  Flag,
  History,
  KeyRound,
  LayoutDashboard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/organisations", label: "Organisations", icon: Building2 },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/users", label: "Accounts", icon: Users },
  { href: "/admin/issuers", label: "NEAR issuers", icon: KeyRound },
  { href: "/admin/audit", label: "Audit log", icon: History },
] as const;

function AdminNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Administration" className="lg:sticky lg:top-6 lg:self-start">
      <p className="mb-3 hidden px-4 font-display text-lead font-bold lg:block">ProofMe admin</p>
      <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:gap-1">
        {SECTIONS.map((section) => {
          const current =
            pathname !== null &&
            ("exact" in section ? pathname === section.href : pathname.startsWith(section.href));
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={current ? "page" : undefined}
                className="flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-surface px-4 font-semibold whitespace-nowrap text-muted no-underline transition-colors hover:bg-surface-2 hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-canvas lg:rounded-2xl lg:border-0 lg:bg-transparent"
              >
                <section.icon aria-hidden="true" size={18} strokeWidth={2} />
                {section.label}
              </Link>
            </li>
          );
        })}
        <li className="lg:mt-4 lg:border-t lg:border-line lg:pt-4">
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center gap-2.5 rounded-full border border-line bg-surface px-4 font-semibold whitespace-nowrap text-muted no-underline hover:text-ink lg:rounded-2xl lg:border-0 lg:bg-transparent"
          >
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />
            Your workspace
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export function AdminNav() {
  return <AdminNavView pathname={usePathname()} />;
}

export function AdminNavFallback() {
  return <AdminNavView pathname={null} />;
}
