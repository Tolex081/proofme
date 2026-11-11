import type { Metadata } from "next";
import { Suspense } from "react";

import { OrganisationForm } from "@/components/organisations/forms";
import { PageSkeleton, WorkspaceTopBar } from "@/components/workspace/parts";
import { AccountMenu } from "@/components/workspace/shell";
import { requireWorkspace } from "@/lib/auth/guards";
import { createOrganisationAction } from "@/server/actions/organisations";

export const metadata: Metadata = { title: "Set up an organisation" };

export default function NewOrganisation() {
  return (
    <>
      <WorkspaceTopBar
        account={
          <Suspense fallback={null}>
            <Account />
          </Suspense>
        }
      />
      <main id="main" className="column flex-1 py-8 lg:py-14">
        <div className="mx-auto max-w-[52rem]">
          <Suspense fallback={<PageSkeleton />}>
            <Content />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function Account() {
  const { profile } = await requireWorkspace("/organisations/new");
  return <AccountMenu name={profile.displayName} username={profile.username} />;
}

async function Content() {
  await requireWorkspace("/organisations/new");
  return (
    <>
      <h1 className="text-[clamp(2rem,4vw,2.9rem)] leading-[1.02] font-extrabold tracking-[-0.04em]">
        Set up an <span className="marker">organisation</span>.
      </h1>
      <p className="mt-3 max-w-[42rem] text-muted">
        You will be its owner, using the account you already have. It starts as not reviewed by
        ProofMe; you can ask for a review once it is described.
      </p>
      <div className="card mt-8 p-6 sm:p-9">
        <OrganisationForm
          initial={{ name: "", slug: "", category: "dao", description: null, websiteUrl: null }}
          action={createOrganisationAction}
          submitLabel="Create organisation"
          cancelHref="/dashboard/organisations"
          isNew
        />
      </div>
    </>
  );
}
