import type { Metadata } from "next";
import { Suspense } from "react";

import { OrganisationForm } from "@/components/organisations/forms";
import { NoAccess } from "@/components/workspace/no-access";
import { PageHeading, PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { updateOrganisationAction } from "@/server/actions/organisations";

export const metadata: Metadata = { title: "Organisation settings" };

export default function OrganisationSettings({
  params,
  searchParams,
}: PageProps<"/org/[slug]/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: Pick<PageProps<"/org/[slug]/settings">, "params" | "searchParams">) {
  const { slug } = await params;
  const { saved } = await searchParams;
  const { organisation, can } = await requireOrganisation(slug, `/org/${slug}/settings`);
  if (!can("organisation.update_profile")) {
    return (
      <NoAccess
        what="change the organisation's settings"
        backHref={`/org/${organisation.slug}/dashboard`}
      />
    );
  }
  return (
    <>
      {saved === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          Saved.
        </p>
      ) : null}
      <PageHeading title="Settings" intro="How the organisation appears on ProofMe." />
      <Panel title="Organisation details">
        <OrganisationForm
          initial={{
            name: organisation.name,
            slug: organisation.slug,
            category: organisation.category,
            description: organisation.description,
            websiteUrl: organisation.websiteUrl,
          }}
          action={updateOrganisationAction.bind(null, organisation.id)}
          submitLabel="Save details"
          cancelHref={`/org/${organisation.slug}/dashboard`}
          isNew={false}
        />
      </Panel>
    </>
  );
}
