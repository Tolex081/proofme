import { UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { listContributors } from "@/server/services/verification";

export const metadata: Metadata = { title: "Contributors" };

export default function Contributors({ params }: PageProps<"/org/[slug]/contributors">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/org/[slug]/contributors">, "params">) {
  const { slug } = await params;
  const { organisation, user, db } = await requireOrganisation(slug, `/org/${slug}/contributors`);
  const people = (await listContributors(db, user.id, organisation.id)) ?? [];
  return (
    <>
      <PageHeading
        title="Contributors"
        intro="People who have sent this organisation a contribution to review."
      />
      {people.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
            <UserRoundCheck aria-hidden="true" size={24} />
          </span>
          <h2 className="mt-5 text-[1.3rem]">No contributors yet</h2>
          <p className="mt-2 max-w-[48ch] text-muted">
            Contributors appear here once they send {organisation.name} a contribution to review.
          </p>
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {people.map((person) => (
            <li
              key={`${person.name}-${person.username}`}
              className="flex flex-wrap items-center gap-4 p-5 sm:p-6"
            >
              <div className="min-w-[12rem] flex-1">
                <p className="font-semibold">{person.name}</p>
                {person.username && person.isPublic ? (
                  <Link href={`/u/${person.username}`} className="text-link text-[0.9rem]">
                    @{person.username}
                  </Link>
                ) : (
                  <p className="text-[0.9rem] text-muted">Private profile</p>
                )}
              </div>
              <span className="chip chip-ok">{person.approved} approved</span>
              {person.open > 0 ? <span className="chip chip-wait">{person.open} open</span> : null}
              <span className="text-[0.9rem] text-muted">{person.total} sent</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
