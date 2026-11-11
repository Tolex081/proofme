import { FileText, Link2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StatusChip } from "@/components/contributions/status";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { CONTRIBUTION_STATUSES, type ContributionStatus } from "@/lib/domain/status";
import { CATEGORY_LABELS } from "@/lib/validation/contribution";
import { listOwnContributions } from "@/server/services/contributions";

export const metadata: Metadata = { title: "Contributions" };

const FILTERS: { value: ContributionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "self_reported", label: "Self-reported" },
  { value: "pending", label: "Awaiting review" },
  { value: "verified", label: "Verified" },
];

const UPDATED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function Contributions({ searchParams }: PageProps<"/dashboard/contributions">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContributionsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ContributionsContent({
  searchParams,
}: Pick<PageProps<"/dashboard/contributions">, "searchParams">) {
  const { user, db } = await requireWorkspace("/dashboard/contributions");
  const params = await searchParams;
  const requested = typeof params.status === "string" ? params.status : "all";
  const status = (CONTRIBUTION_STATUSES as readonly string[]).includes(requested)
    ? (requested as ContributionStatus)
    : "all";
  const items = await listOwnContributions(db, user.id, { status });

  return (
    <>
      {params.deleted === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          Draft deleted.
        </p>
      ) : null}
      <PageHeading
        title="Contributions"
        intro="The work you have done, each with its evidence and where it stands."
        action={
          <Link href="/dashboard/contributions/new" className="action action-primary">
            <Plus aria-hidden="true" size={18} /> New contribution
          </Link>
        }
      />

      <nav aria-label="Filter by status" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const current = filter.value === status;
            return (
              <li key={filter.value}>
                <Link
                  href={
                    filter.value === "all"
                      ? "/dashboard/contributions"
                      : `/dashboard/contributions?status=${filter.value}`
                  }
                  aria-current={current ? "page" : undefined}
                  className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-note font-semibold text-muted no-underline hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-canvas"
                >
                  {filter.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {items.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-highlight text-highlight-ink">
            <FileText aria-hidden="true" size={24} />
          </span>
          <h2 className="mt-5 text-subhead">
            {status === "all" ? "No contributions yet" : "Nothing with this status"}
          </h2>
          <p className="mt-2 max-w-[46ch] text-muted">
            {status === "all"
              ? "Start with one specific piece of work you did, and the links that show it."
              : "Try another filter, or add a new contribution."}
          </p>
          {status === "all" ? (
            <Link href="/dashboard/contributions/new" className="action action-primary mt-6">
              <Plus aria-hidden="true" size={18} /> Add your first contribution
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/dashboard/contributions/${item.id}`}
                className="card flex flex-wrap items-center gap-x-5 gap-y-3 p-5 text-ink no-underline transition-colors hover:border-line-strong sm:p-6"
              >
                <div className="min-w-[14rem] flex-1">
                  <p className="font-display text-lead font-bold tracking-[-0.015em]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-note text-muted">
                    {CATEGORY_LABELS[item.category]}
                    {item.role ? ` · ${item.role}` : ""} · updated {UPDATED.format(item.updatedAt)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-meta text-muted">
                  <Link2 aria-hidden="true" size={15} />
                  {item.evidence.length} {item.evidence.length === 1 ? "link" : "links"}
                </span>
                <StatusChip status={item.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
