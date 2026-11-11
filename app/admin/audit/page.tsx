import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState, MOMENT } from "@/components/admin/parts";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { listAuditEvents } from "@/server/services/admin";

export const metadata: Metadata = { title: "Audit log" };

export default function AdminAudit({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  const query = await searchParams;
  const { db, user } = await requireAdmin("/admin/audit");
  const action = typeof query.action === "string" ? query.action : "";
  const entity = typeof query.entity === "string" ? query.entity : "";
  const rows = (await listAuditEvents(db, user.id, { action, entityId: entity })) ?? [];

  return (
    <>
      <PageHeading
        title="Audit log"
        intro="Sensitive actions, newest first. Entries cannot be edited or deleted from the app."
      />
      <form
        action="/admin/audit"
        method="get"
        role="search"
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <div className="field min-w-[12rem] flex-1">
          <label htmlFor="audit-action" className="field-label">
            Action starts with
          </label>
          <input
            id="audit-action"
            name="action"
            maxLength={60}
            defaultValue={action}
            className="field-input"
            placeholder="admin."
          />
        </div>
        <div className="field min-w-[12rem] flex-1">
          <label htmlFor="audit-entity" className="field-label">
            Record ID
          </label>
          <input
            id="audit-entity"
            name="entity"
            maxLength={120}
            defaultValue={entity}
            className="field-input"
          />
        </div>
        <button type="submit" className="action action-secondary">
          Filter
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No entries" body="Nothing matches this filter." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-note">
            <caption className="sr-only">Audit events</caption>
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">
                  When (UTC)
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Who
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Action
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Record
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line align-top last:border-0">
                  <td className="px-5 py-3 whitespace-nowrap">{MOMENT.format(row.createdAt)}</td>
                  <td className="px-5 py-3">
                    {row.actorName ?? "System"}
                    {row.organisationName ? (
                      <span className="block text-muted">{row.organisationName}</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 font-mono text-meta">{row.action}</td>
                  <td className="px-5 py-3 font-mono text-label break-all text-muted">
                    {row.entityType} {row.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
