import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProjectForm } from "@/components/organisations/forms";
import { PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { PROJECT_STATUS_LABELS } from "@/lib/validation/organisation";
import { updateProjectAction } from "@/server/actions/organisations";
import { getProjectForMember } from "@/server/services/organisations";

export const metadata: Metadata = { title: "Project" };

export default function ProjectPage({
  params,
  searchParams,
}: PageProps<"/org/[slug]/projects/[projectId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: Pick<PageProps<"/org/[slug]/projects/[projectId]">, "params" | "searchParams">) {
  const { slug, projectId } = await params;
  const { saved } = await searchParams;
  const { organisation, user, db, can } = await requireOrganisation(
    slug,
    `/org/${slug}/projects/${projectId}`,
  );
  // Looked up within this organisation only: another organisation's project ID finds nothing.
  const project = await getProjectForMember(db, user.id, organisation.id, projectId);
  if (!project) notFound();
  const isPublic = project.status === "active" || project.status === "completed";

  return (
    <>
      <Link
        href={`/org/${organisation.slug}/projects`}
        className="text-link mb-5 inline-flex items-center gap-1.5"
      >
        <ArrowLeft aria-hidden="true" size={16} /> All projects
      </Link>
      {saved === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          Saved.
        </p>
      ) : null}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className={`chip ${project.status === "active" ? "chip-ok" : "chip-neutral"}`}>
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
          <h1 className="mt-3 text-page leading-[1.05] font-extrabold tracking-[-0.04em]">
            {project.name}
          </h1>
        </div>
        {isPublic ? (
          <Link
            href={`/project/${project.slug}`}
            target="_blank"
            className="action action-secondary"
          >
            Public page <ExternalLink aria-hidden="true" size={15} />
          </Link>
        ) : null}
      </div>

      {can("project.manage") ? (
        <Panel title="Project details">
          <ProjectForm
            initial={{
              name: project.name,
              description: project.description,
              websiteUrl: project.websiteUrl,
              repositoryUrl: project.repositoryUrl,
              status: project.status,
              startDate: project.startDate,
              endDate: project.endDate,
            }}
            action={updateProjectAction.bind(null, project.id, organisation.slug)}
            submitLabel="Save project"
            cancelHref={`/org/${organisation.slug}/projects`}
          />
        </Panel>
      ) : (
        <Panel title="About this project">
          <p className="max-w-[62ch]">{project.description ?? "No description yet."}</p>
        </Panel>
      )}
    </>
  );
}
