import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminOverview } from "@/server/services/admin";

export const metadata: Metadata = { title: "Overview" };

export default function AdminHome() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { db, user } = await requireAdmin("/admin");
  const overview = await adminOverview(db, user.id);
  if (!overview) return null;
  const tiles = [
    {
      label: "Organisations waiting for review",
      value: overview.pendingOrganisations,
      href: "/admin/organisations",
    },
    { label: "Open reports", value: overview.openReports, href: "/admin/reports" },
    { label: "Accounts", value: overview.users, href: "/admin/users" },
    {
      label: "Organisations",
      value: overview.organisations,
      href: "/admin/organisations?status=all",
    },
    {
      label: "Attestations issued",
      value: overview.attestations,
      href: "/admin/audit?action=verification",
    },
  ];
  return (
    <>
      <PageHeading
        title="Administration"
        intro="Review organisations, handle reports and read the audit trail. Administrators cannot issue, edit or revoke an organisation's attestations."
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link
              href={tile.href}
              className="card flex h-full flex-col gap-1 p-6 text-ink no-underline hover:border-line-strong"
            >
              <span className="font-display text-[2.2rem] leading-none font-extrabold tabular-nums">
                {tile.value}
              </span>
              <span className="text-muted">{tile.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
