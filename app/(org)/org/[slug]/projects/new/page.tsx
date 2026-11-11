import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectForm } from "@/components/organisations/forms";
import { NoAccess } from "@/components/workspace/no-access";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { createProjectAction } from "@/server/actions/organisations";

export const metadata: Metadata = { title: "New project" };

export default function NewProject({ params }: PageProps<"/org/[slug]/projects/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/org/[slug]/projects/new">, "params">) {
  const { slug } = await params;
  const { organisation, can } = await requireOrganisation(slug, `/org/${slug}/projects/new`);
  if (!can("project.manage")) {
    return <NoAccess what="add projects" backHref={`/org/${organisation.slug}/projects`} />;
  }
  return (
    <>
      <PageHeading title="New project" intro={organisation.name} />
      <div className="card p-6 sm:p-8">
        <ProjectForm
          initial={{
            name: "",
            description: null,
            websiteUrl: null,
            repositoryUrl: null,
            status: "active",
            startDate: null,
            endDate: null,
          }}
          action={createProjectAction.bind(null, organisation.id, organisation.slug)}
          submitLabel="Create project"
          cancelHref={`/org/${organisation.slug}/projects`}
        />
      </div>
    </>
  );
}
