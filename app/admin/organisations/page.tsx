import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DAY, EmptyState, FilterLinks, SearchBox } from "@/components/admin/parts";
import { IssuerBadge, PlatformBadge } from "@/components/organisations/badges";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { listOrganisationsForAdmin, type OrganisationFilter } from "@/server/services/admin";

export const metadata: Metadata = { title: "Organisations" };

const FILTERS = [
  { value: "pending", label: "Waiting for review" },
  { value: "verified", label: "Reviewed" },
  { value: "unverified", label: "Not reviewed" },
  { value: "rejected", label: "Declined" },
  { value: "suspended", label: "Suspended" },
  { value: "all", label: "All" },
] as const;

export default function AdminOrganisations({ searchParams }: PageProps<"/admin/organisations">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/admin/organisations">, "searchParams">) {
  const query = await searchParams;
  const { db, user } = await requireAdmin("/admin/organisations");
  const filter: OrganisationFilter =
    FILTERS.find((item) => item.value === query.status)?.value ?? "pending";
  const q = typeof query.q === "string" ? query.q : "";
  const rows = (await listOrganisationsForAdmin(db, user.id, filter, q)) ?? [];

  return (
    <>
      <PageHeading
        title="Organisations"
        intro="Platform review checks who runs an organisation. It is separate from NEAR issuer registration."
      />
      <FilterLinks
        label="Filter by review status"
        base="/admin/organisations"
        param="status"
        current={filter}
        options={FILTERS}
      />
      <SearchBox
        action="/admin/organisations"
        label="Search by name or address"
        defaultValue={q}
        hidden={filter === "pending" ? {} : { status: filter }}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No organisations here"
          body={
            filter === "pending"
              ? "Nobody is waiting for a review."
              : "Try another filter or search."
          }
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
                  <p className="font-display text-[1.15rem] font-bold">{row.name}</p>
                  <p className="text-[0.9rem] text-muted">
                    /org/{row.slug} · updated {DAY.format(row.updatedAt)}
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
