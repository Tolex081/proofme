import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/admin/parts";
import { IssuerBadge, PlatformBadge } from "@/components/organisations/badges";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { listIssuers } from "@/server/services/admin";

export const metadata: Metadata = { title: "NEAR issuers" };

export default function AdminIssuers() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { db, user } = await requireAdmin("/admin/issuers");
  const rows = (await listIssuers(db, user.id)) ?? [];
  return (
    <>
      <PageHeading
        title="NEAR issuers"
        intro="Organisations with a NEAR issuer account on record. This view is read-only: issuer registration happens on the NEAR testnet contract, signed by the organisation's own wallet."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No issuers yet"
          body="No organisation has registered a NEAR issuer account."
        />
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/organisations/${row.id}`}
                className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-5 text-ink no-underline hover:border-line-strong sm:p-6"
              >
                <div className="min-w-[14rem] flex-1">
                  <p className="font-display text-[1.1rem] font-bold">{row.name}</p>
                  <p className="font-mono text-[0.85rem] break-all text-muted">
                    {row.nearIssuerAccountId ?? "No account recorded"} · {row.issued} issued
                  </p>
                </div>
                <PlatformBadge status={row.platformVerificationStatus} />
                <IssuerBadge status={row.nearIssuerStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
