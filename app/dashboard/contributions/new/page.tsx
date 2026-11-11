import type { Metadata } from "next";
import { Suspense } from "react";

import { ContributionForm, EMPTY_CONTRIBUTION } from "@/components/contributions/contribution-form";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { createContributionAction } from "@/server/actions/contributions";

export const metadata: Metadata = { title: "New contribution" };

export default function NewContribution() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewContributionContent />
    </Suspense>
  );
}

async function NewContributionContent() {
  await requireWorkspace("/dashboard/contributions/new");
  return (
    <>
      <PageHeading
        title="New contribution"
        intro="Describe one specific piece of work. It is saved as a private draft; nothing is shared until you decide."
      />
      <div className="card p-6 sm:p-8">
        <ContributionForm
          initial={EMPTY_CONTRIBUTION}
          action={createContributionAction}
          submitLabel="Save draft"
          cancelHref="/dashboard/contributions"
        />
      </div>
    </>
  );
}
