import { Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PlatformBadge } from "@/components/organisations/badges";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { ORGANISATION_CATEGORY_LABELS, ROLE_LABELS } from "@/lib/validation/organisation";
import { listMyOrganisations } from "@/server/services/organisations";

export const metadata: Metadata = { title: "Organisations" };

export default function MyOrganisations({ searchParams }: PageProps<"/dashboard/organisations">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  searchParams,
}: Pick<PageProps<"/dashboard/organisations">, "searchParams">) {
  const { user, db } = await requireWorkspace("/dashboard/organisations");
  const params = await searchParams;
  const items = await listMyOrganisations(db, user.id);

  return (
    <>
      {params.left === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          You left the organisation.
        </p>
      ) : null}
      {params.declined === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          Invitation declined.
        </p>
      ) : null}
      <PageHeading
        title="Organisations"
        intro="Organisations you belong to. The same account works for your own record and for every team you are in."
        action={
          <Link href="/organisations/new" className="action action-primary">
            <Plus aria-hidden="true" size={18} /> Set up an organisation
          </Link>
        }
      />
      {items.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-highlight text-highlight-ink">
            <Building2 aria-hidden="true" size={24} />
          </span>
          <h2 className="mt-5 text-subhead">You are not in any organisation</h2>
          <p className="mt-2 max-w-[46ch] text-muted">
            Set one up if you run a project, or open the invitation link an organisation sent you.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((organisation) => (
            <li key={organisation.id}>
              <Link
                href={`/org/${organisation.slug}/dashboard`}
                className="card flex flex-wrap items-center gap-4 p-5 text-ink no-underline hover:border-line-strong sm:p-6"
              >
                <span aria-hidden="true" className="org-mark">
                  {organisation.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-[12rem] flex-1">
                  <p className="font-display text-lead font-bold">{organisation.name}</p>
                  <p className="text-note text-muted">
                    {ORGANISATION_CATEGORY_LABELS[organisation.category]} · you are{" "}
                    {ROLE_LABELS[organisation.role].toLowerCase()}
                  </p>
                </div>
                <PlatformBadge status={organisation.platformVerificationStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
