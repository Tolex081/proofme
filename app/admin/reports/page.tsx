import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ResolveReportForm } from "@/components/admin/forms";
import { EmptyState, FilterLinks, MOMENT } from "@/components/admin/parts";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { listReports, REPORT_REASON_LABELS } from "@/server/services/admin";

export const metadata: Metadata = { title: "Reports" };

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "reviewed", label: "Handled" },
  { value: "dismissed", label: "Dismissed" },
] as const;

function targetHref(type: string, id: string) {
  if (type === "profile") return `/u/${id}`;
  if (type === "organisation") return `/org/${id}`;
  return `/verify/${id}`;
}

export default function AdminReports({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  const query = await searchParams;
  const { db, user } = await requireAdmin("/admin/reports");
  const filter = FILTERS.find((item) => item.value === query.status)?.value ?? "open";
  const rows = (await listReports(db, user.id, filter)) ?? [];

  return (
    <>
      <PageHeading
        title="Reports"
        intro="Sent by signed-in people from public profiles and organisation pages. The reported person is never told who sent a report."
      />
      <FilterLinks
        label="Filter by status"
        base="/admin/reports"
        param="status"
        current={filter}
        options={FILTERS}
      />
      {rows.length === 0 ? (
        <EmptyState
          title={filter === "open" ? "No open reports" : "Nothing here"}
          body={filter === "open" ? "New reports appear here." : "No reports with this status."}
        />
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.id} className="card p-5 sm:p-6">
              <h2 className="font-display text-lead font-bold">
                {REPORT_REASON_LABELS[row.reason as keyof typeof REPORT_REASON_LABELS] ??
                  row.reason}
              </h2>
              <p className="text-note text-muted">
                {row.targetType}{" "}
                <Link href={targetHref(row.targetType, row.targetId)} className="text-link">
                  {row.targetId}
                </Link>{" "}
                · from {row.reporterName ?? "a deleted account"} · {MOMENT.format(row.createdAt)}
              </p>
              {row.details ? <p className="mt-2 whitespace-pre-line">{row.details}</p> : null}
              {row.status === "open" ? (
                <div className="mt-4">
                  <ResolveReportForm reportId={row.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
