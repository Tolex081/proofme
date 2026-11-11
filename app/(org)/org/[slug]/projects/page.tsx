import { FolderKanban, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { PROJECT_STATUS_LABELS } from "@/lib/validation/organisation";
import { listProjectsForMember } from "@/server/services/organisations";

export const metadata: Metadata = { title: "Projects" };

export default function Projects({ params }: PageProps<"/org/[slug]/projects">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/org/[slug]/projects">, "params">) {
  const { slug } = await params;
  const { organisation, user, db, can } = await requireOrganisation(slug, `/org/${slug}/projects`);
  const items = (await listProjectsForMember(db, user.id, organisation.id)) ?? [];
  const canManage = can("project.manage");

  return (
    <>
      <PageHeading
        title="Projects"
        intro="What people contribute to. Active and completed projects appear on your public page."
        action={
          canManage ? (
            <Link href={`/org/${organisation.slug}/projects/new`} className="action action-primary">
              <Plus aria-hidden="true" size={18} /> New project
            </Link>
          ) : null
        }
      />
      {items.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-highlight text-highlight-ink">
            <FolderKanban aria-hidden="true" size={24} />
          </span>
          <h2 className="mt-5 text-subhead">No projects yet</h2>
          <p className="mt-2 max-w-[44ch] text-muted">
            {canManage
              ? "Add the projects people contribute to, so contributors can say which one their work was for."
              : "An owner or admin can add projects."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((project) => (
            <li key={project.id}>
              <Link
                href={`/org/${organisation.slug}/projects/${project.id}`}
                className="card flex flex-wrap items-center gap-4 p-5 text-ink no-underline hover:border-line-strong sm:p-6"
              >
                <div className="min-w-[14rem] flex-1">
                  <p className="font-display text-lead font-bold">{project.name}</p>
                  {project.description ? (
                    <p className="mt-0.5 line-clamp-1 text-note text-muted">
                      {project.description}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`chip ${project.status === "active" ? "chip-ok" : "chip-neutral"}`}
                >
                  {PROJECT_STATUS_LABELS[project.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
