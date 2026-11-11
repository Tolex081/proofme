import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SuspendUserForm } from "@/components/admin/forms";
import { DAY, EmptyState, SearchBox } from "@/components/admin/parts";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { searchUsers } from "@/server/services/admin";

export const metadata: Metadata = { title: "Accounts" };

export default function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const query = await searchParams;
  const { db, user } = await requireAdmin("/admin/users");
  const q = typeof query.q === "string" ? query.q : "";
  const rows = (await searchUsers(db, user.id, q)) ?? [];

  return (
    <>
      <PageHeading
        title="Accounts"
        intro="Suspending an account signs it out everywhere and hides its public profile. Its verified work stays on record."
      />
      <SearchBox action="/admin/users" label="Search by name, email or username" defaultValue={q} />
      {rows.length === 0 ? (
        <EmptyState title="No accounts found" body="Try a different name, email or username." />
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.id} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-[14rem] flex-1">
                  <p className="font-display text-[1.1rem] font-bold">{row.name}</p>
                  <p className="text-[0.9rem] break-all text-muted">
                    {row.email}
                    {row.username ? (
                      <>
                        {" · "}
                        {row.visibility === "public" ? (
                          <Link href={`/u/${row.username}`} className="text-link">
                            @{row.username}
                          </Link>
                        ) : (
                          `@${row.username} (private)`
                        )}
                      </>
                    ) : null}
                    {" · joined "}
                    {DAY.format(row.createdAt)}
                  </p>
                </div>
                {row.isPlatformAdmin ? (
                  <span className="chip chip-neutral">Administrator</span>
                ) : null}
                <span className={`chip ${row.status === "active" ? "chip-ok" : "chip-bad"}`}>
                  {row.status === "active"
                    ? "Active"
                    : row.status === "suspended"
                      ? "Suspended"
                      : "Deletion requested"}
                </span>
              </div>
              {!row.isPlatformAdmin && row.id !== user.id && row.status !== "deletion_requested" ? (
                <details className="mt-4">
                  <summary className="cursor-pointer font-semibold text-link">
                    {row.status === "active" ? "Suspend this account" : "Reinstate this account"}
                  </summary>
                  <div className="mt-3">
                    <SuspendUserForm
                      userId={row.id}
                      name={row.name}
                      suspend={row.status === "active"}
                    />
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
