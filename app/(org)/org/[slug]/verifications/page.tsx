import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NoAccess } from "@/components/workspace/no-access";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { CATEGORY_LABELS } from "@/lib/validation/contribution";
import { listQueue } from "@/server/services/verification";

export const metadata: Metadata = { title: "Review queue" };

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Not approved" },
  { value: "withdrawn", label: "Withdrawn" },
] as const;

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function Queue({ params, searchParams }: PageProps<"/org/[slug]/verifications">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: Pick<PageProps<"/org/[slug]/verifications">, "params" | "searchParams">) {
  const { slug } = await params;
  const query = await searchParams;
  const { organisation, user, db, can } = await requireOrganisation(
    slug,
    `/org/${slug}/verifications`,
  );
  if (!can("verification.view")) {
    return (
      <NoAccess what="see the review queue" backHref={`/org/${organisation.slug}/dashboard`} />
    );
  }
  const filter = FILTERS.find((item) => item.value === query.status)?.value ?? "open";
  const items = (await listQueue(db, user.id, organisation.id, filter)) ?? [];

  return (
    <>
      <PageHeading
        title="Review queue"
        intro="Contribution claims sent to this organisation. Nobody can decide on their own claim."
      />
      <nav aria-label="Filter by status" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <li key={item.value}>
              <Link
                href={
                  item.value === "open"
                    ? `/org/${organisation.slug}/verifications`
                    : `/org/${organisation.slug}/verifications?status=${item.value}`
                }
                aria-current={item.value === filter ? "page" : undefined}
                className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-[0.92rem] font-semibold text-muted no-underline hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-canvas"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {items.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
            <Inbox aria-hidden="true" size={24} />
          </span>
          <h2 className="mt-5 text-[1.3rem]">
            {filter === "open" ? "Nothing waiting" : "Nothing here"}
          </h2>
          <p className="mt-2 max-w-[44ch] text-muted">
            {filter === "open"
              ? "When a contributor sends you a claim, it appears here and your reviewers are notified."
              : "No requests with this status."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/org/${organisation.slug}/verifications/${item.id}`}
                className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-5 text-ink no-underline hover:border-line-strong sm:p-6"
              >
                <div className="min-w-[14rem] flex-1">
                  <p className="font-display text-[1.15rem] font-bold">{item.title}</p>
                  <p className="text-[0.9rem] text-muted">
                    {item.contributorName} · {CATEGORY_LABELS[item.category]}
                    {item.projectName ? ` · ${item.projectName}` : ""} · sent{" "}
                    {DAY.format(item.submittedAt)}
                  </p>
                </div>
                {item.contributorUserId === user.id ? (
                  <span className="chip chip-neutral">Your own claim</span>
                ) : null}
                <span
                  className={`chip ${item.status === "pending" ? "chip-wait" : item.status === "approved" ? "chip-ok" : item.status === "rejected" ? "chip-bad" : "chip-neutral"}`}
                >
                  {
                    {
                      pending: "Waiting for a decision",
                      needs_information: "Waiting for the contributor",
                      approved: "Approved",
                      rejected: "Not approved",
                      withdrawn: "Withdrawn",
                    }[item.status]
                  }
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
