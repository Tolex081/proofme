import { Check, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { IssuerBadge, PlatformBadge, platformMeaning } from "@/components/organisations/badges";
import { RequestReviewButton } from "@/components/organisations/forms";
import { PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { ROLE_LABELS } from "@/lib/validation/organisation";
import { listProjectsForMember, organisationOverview } from "@/server/services/organisations";

export const metadata: Metadata = { title: "Organisation" };

export default function OrganisationDashboard({
  params,
  searchParams,
}: PageProps<"/org/[slug]/dashboard">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: Pick<PageProps<"/org/[slug]/dashboard">, "params" | "searchParams">) {
  const { slug } = await params;
  const query = await searchParams;
  const { organisation, membership, user, db, can } = await requireOrganisation(
    slug,
    `/org/${slug}/dashboard`,
  );
  const overview = await organisationOverview(db, user.id, organisation.id);
  const projectList = (await listProjectsForMember(db, user.id, organisation.id)) ?? [];
  const canManage = can("organisation.update_profile");
  const status = organisation.platformVerificationStatus;

  const steps = [
    {
      done: Boolean(organisation.description && organisation.websiteUrl),
      title: "Describe the organisation",
      body: "A description and a website, so contributors and reviewers know who you are.",
      href: `/org/${organisation.slug}/settings`,
      action: "Edit details",
    },
    {
      done: projectList.length > 0,
      title: "Add a project",
      body: "Contributions are made to projects. Add the ones people work on.",
      href: `/org/${organisation.slug}/projects/new`,
      action: "New project",
    },
    {
      done: (overview?.members ?? 1) > 1,
      title: "Invite your team",
      body: "Reviewers decide on contribution claims. Nobody can review their own.",
      href: `/org/${organisation.slug}/team`,
      action: "Invite people",
    },
  ];

  return (
    <>
      {query.created === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          {organisation.name} is set up, with you as its owner.
        </p>
      ) : null}
      {query.joined === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          You joined {organisation.name} as {ROLE_LABELS[membership.role].toLowerCase()}.
        </p>
      ) : null}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[44rem]">
          <div className="flex flex-wrap gap-2">
            <PlatformBadge status={status} />
            <IssuerBadge status={organisation.nearIssuerStatus} />
          </div>
          <h1 className="mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-[1.05] font-extrabold tracking-[-0.04em]">
            {organisation.name}
          </h1>
          <p className="mt-2 text-muted">
            You are {ROLE_LABELS[membership.role].toLowerCase()} here.
          </p>
        </div>
        <Link
          href={`/org/${organisation.slug}`}
          target="_blank"
          className="action action-secondary"
        >
          Public page <ExternalLink aria-hidden="true" size={15} />
        </Link>
      </div>

      <dl className="mb-4 grid gap-4 sm:grid-cols-3">
        {[
          ["Team members", overview?.members ?? 0],
          ["Projects", overview?.projects ?? 0],
          ["Claims awaiting review", overview?.awaitingReview ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="card p-5">
            <dt className="text-[0.85rem] font-semibold text-muted">{label}</dt>
            <dd className="mt-1 font-display text-[2rem] leading-none font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      {canManage ? (
        <section aria-labelledby="setup" className="card mb-4 overflow-hidden">
          <h2 id="setup" className="px-6 pt-6 text-[1.25rem] sm:px-8">
            Getting set up
          </h2>
          <ol className="mt-3 divide-y divide-line">
            {steps.map((step) => (
              <li key={step.title} className="flex flex-wrap items-center gap-4 px-6 py-5 sm:px-8">
                <span
                  className={`grid size-9 flex-none place-items-center rounded-full ${step.done ? "bg-ok text-ok-ink" : "border-2 border-dashed border-line-strong"}`}
                >
                  {step.done ? <Check aria-hidden="true" size={18} strokeWidth={3} /> : null}
                  <span className="sr-only">{step.done ? "Done:" : "To do:"}</span>
                </span>
                <div className="min-w-[12rem] flex-1">
                  <p className="font-display text-[1.05rem] font-bold">{step.title}</p>
                  <p className="text-[0.92rem] text-muted">{step.body}</p>
                </div>
                <Link
                  href={step.href}
                  className={`action ${step.done ? "action-secondary" : "action-primary"}`}
                >
                  {step.done ? "Review" : step.action}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Panel title="ProofMe review" intro={platformMeaning(status)}>
        <p className="max-w-[62ch] text-muted">
          Being reviewed by ProofMe is separate from registering a NEAR issuer account. Contributors
          and visitors see both, side by side, and neither implies the other.
        </p>
        {canManage && (status === "unverified" || status === "rejected") ? (
          <div className="mt-5">
            <RequestReviewButton organisationId={organisation.id} />
          </div>
        ) : null}
      </Panel>
    </>
  );
}
