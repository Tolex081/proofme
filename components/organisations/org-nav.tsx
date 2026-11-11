"use client";

import {
  ArrowLeft,
  FolderKanban,
  Inbox,
  ScrollText,
  LayoutDashboard,
  Settings,
  UserRoundCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { path: "dashboard", label: "Overview", icon: LayoutDashboard },
  { path: "verifications", label: "Review queue", icon: Inbox, reviewersOnly: true },
  { path: "attestations", label: "Attestations", icon: ScrollText },
  { path: "projects", label: "Projects", icon: FolderKanban },
  { path: "team", label: "Team", icon: Users },
  { path: "contributors", label: "Contributors", icon: UserRoundCheck },
  { path: "settings", label: "Settings", icon: Settings, managersOnly: true },
] as const;

function OrgNavView({
  slug,
  name,
  canManage,
  canReview,
  pathname,
}: {
  slug: string;
  name: string;
  canManage: boolean;
  canReview: boolean;
  pathname: string | null;
}) {
  return (
    <nav aria-label={`${name} workspace`} className="lg:sticky lg:top-6 lg:self-start">
      <p className="mb-3 hidden truncate px-4 font-display text-lead font-bold lg:block">{name}</p>
      <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:gap-1">
        {SECTIONS.filter(
          (section) =>
            (canManage || !("managersOnly" in section)) &&
            (canReview || !("reviewersOnly" in section)),
        ).map((section) => {
          const href = `/org/${slug}/${section.path}`;
          const current = pathname !== null && pathname.startsWith(href);
          return (
            <li key={section.path}>
              <Link
                href={href}
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

export function OrgNav(props: {
  slug: string;
  name: string;
  canManage: boolean;
  canReview: boolean;
}) {
  return <OrgNavView {...props} pathname={usePathname()} />;
}

export function OrgNavFallback(props: {
  slug: string;
  name: string;
  canManage: boolean;
  canReview: boolean;
}) {
  return <OrgNavView {...props} pathname={null} />;
}
