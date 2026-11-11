import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ContributionForm } from "@/components/contributions/contribution-form";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { isContributionEditable } from "@/lib/domain/status";
import { updateContributionAction } from "@/server/actions/contributions";
import { getOwnContribution } from "@/server/services/contributions";

export const metadata: Metadata = { title: "Edit contribution" };

export default function EditContribution({
  params,
}: PageProps<"/dashboard/contributions/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditContent params={params} />
    </Suspense>
  );
}

async function EditContent({
  params,
}: Pick<PageProps<"/dashboard/contributions/[id]/edit">, "params">) {
  const { id } = await params;
  const { user, db } = await requireWorkspace(`/dashboard/contributions/${id}/edit`);
  const contribution = await getOwnContribution(db, user.id, id);
  if (!contribution) notFound();
  if (!isContributionEditable(contribution.status)) redirect(`/dashboard/contributions/${id}`);

  return (
    <>
      <PageHeading title="Edit contribution" intro={contribution.title} />
      <div className="card p-6 sm:p-8">
        <ContributionForm
          initial={{
            title: contribution.title,
            summary: contribution.summary,
            description: contribution.description,
            category: contribution.category,
            role: contribution.role,
            skills: contribution.skills,
            startDate: contribution.startDate,
            endDate: contribution.endDate,
            visibility: contribution.visibility,
            evidence: contribution.evidence.map((item) => ({
              type: item.type,
              url: item.url,
              label: item.label,
            })),
          }}
          action={updateContributionAction.bind(null, contribution.id)}
          submitLabel="Save changes"
          cancelHref={`/dashboard/contributions/${contribution.id}`}
        />
      </div>
    </>
  );
}
