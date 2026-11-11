import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PlatformBadge } from "@/components/organisations/badges";
import { getDb } from "@/lib/db/client";
import { PROJECT_STATUS_LABELS } from "@/lib/validation/organisation";
import { getPublicProject } from "@/server/services/organisations";

export const metadata: Metadata = { title: "Project" };

const DAY = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default function PublicProjectPage({ params }: PageProps<"/project/[slug]">) {
  return (
    <div className="column pt-4 pb-20 lg:pt-8">
      <div className="mx-auto max-w-[56rem]">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-[1.75rem] bg-surface-2" />}>
          <Content params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Content({ params }: Pick<PageProps<"/project/[slug]">, "params">) {
  const { slug } = await params;
  const project = await getPublicProject(await getDb(), slug);
  if (!project) notFound();
  const when = (value: string | null) =>
    value ? DAY.format(new Date(`${value}T00:00:00Z`)) : null;

  return (
    <div className="grid gap-4">
      <Link
        href={`/org/${project.organisation.slug}`}
        className="text-link inline-flex items-center gap-1.5"
      >
        <ArrowLeft aria-hidden="true" size={16} /> {project.organisation.name}
      </Link>
      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          <span className="chip chip-neutral">{PROJECT_STATUS_LABELS[project.status]}</span>
          <PlatformBadge status={project.organisation.platformVerificationStatus} />
        </div>
        <h1 className="mt-3 text-page leading-tight font-extrabold tracking-[-0.035em]">
          {project.name}
        </h1>
        <p className="text-muted">
          A project of {project.organisation.name}
          {when(project.startDate) ? ` · since ${when(project.startDate)}` : ""}
          {when(project.endDate) ? ` · until ${when(project.endDate)}` : ""}
        </p>
        {project.description ? (
          <p className="mt-5 max-w-[62ch] text-lead">{project.description}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          {project.websiteUrl ? (
            <a
              href={project.websiteUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="text-link inline-flex items-center gap-1.5"
            >
              Website <ExternalLink aria-hidden="true" size={14} />
            </a>
          ) : null}
          {project.repositoryUrl ? (
            <a
              href={project.repositoryUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="text-link inline-flex items-center gap-1.5"
            >
              Repository <ExternalLink aria-hidden="true" size={14} />
            </a>
          ) : null}
        </div>
      </section>
      <section className="card p-6 sm:p-8">
        <h2 className="text-subhead">Verified contributions</h2>
        <p className="mt-2 max-w-[62ch] text-muted">
          None yet. Contributions to this project appear here once {project.organisation.name} has
          confirmed them.
        </p>
      </section>
    </div>
  );
}
