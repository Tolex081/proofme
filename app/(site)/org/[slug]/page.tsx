import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { IssuerBadge, PlatformBadge, platformMeaning } from "@/components/organisations/badges";
import { ReportForm } from "@/components/reports/report-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ORGANISATION_CATEGORY_LABELS, PROJECT_STATUS_LABELS } from "@/lib/validation/organisation";
import { getPublicOrganisation } from "@/server/services/organisations";

export const metadata: Metadata = { title: "Organisation" };

const ISSUED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const ATTESTATION_STATUS = {
  active: { label: "Active", tone: "chip-ok" },
  revoked: { label: "Revoked", tone: "chip-bad" },
  superseded: { label: "Replaced by a newer record", tone: "chip-neutral" },
} as const;

const SINCE = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default function PublicOrganisationPage({ params }: PageProps<"/org/[slug]">) {
  return (
    <div className="column pt-4 pb-20 lg:pt-8">
      <div className="mx-auto max-w-[56rem]">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-[1.75rem] bg-surface-2" />}>
          <Content params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Content({ params }: Pick<PageProps<"/org/[slug]">, "params">) {
  const { slug } = await params;
  const organisation = await getPublicOrganisation(await getDb(), slug);
  if (!organisation) notFound();
  const viewer = await getCurrentUser();

  return (
    <div className="grid gap-4">
      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <span aria-hidden="true" className="org-mark size-20 rounded-[1.4rem] text-figure">
            {organisation.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="text-page leading-tight font-extrabold tracking-[-0.035em]">
              {organisation.name}
            </h1>
            <p className="text-muted">
              {ORGANISATION_CATEGORY_LABELS[organisation.category]} · on Atesta since{" "}
              {SINCE.format(organisation.createdAt)}
            </p>
          </div>
        </div>
        {organisation.description ? (
          <p className="mt-6 max-w-[62ch] text-lead">{organisation.description}</p>
        ) : null}
        {organisation.websiteUrl ? (
          <a
            href={organisation.websiteUrl}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="text-link mt-4 inline-flex items-center gap-1.5"
          >
            Website <ExternalLink aria-hidden="true" size={14} />
          </a>
        ) : null}
      </section>

      <section className="card p-6 sm:p-8">
        <h2 className="text-subhead">Standing</h2>
        <p className="mt-2 max-w-[62ch] text-muted">
          Two separate facts. Neither implies the other.
        </p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-meta font-semibold text-muted">Atesta review</dt>
            <dd className="mt-2">
              <PlatformBadge status={organisation.platformVerificationStatus} />
              <p className="mt-2 text-note text-muted">
                {platformMeaning(organisation.platformVerificationStatus)}
              </p>
            </dd>
          </div>
          <div>
            <dt className="text-meta font-semibold text-muted">NEAR testnet issuer</dt>
            <dd className="mt-2">
              <IssuerBadge status={organisation.nearIssuerStatus} />
              <p className="mt-2 text-note text-muted">
                {organisation.nearIssuerAccountId ? (
                  <>
                    Registered account{" "}
                    <span className="digest text-ink">{organisation.nearIssuerAccountId}</span>
                  </>
                ) : (
                  "It cannot anchor attestations on NEAR until an issuer account is registered."
                )}
              </p>
            </dd>
          </div>
        </dl>
      </section>

      <section className="card p-6 sm:p-8">
        <h2 className="text-subhead">Projects</h2>
        {organisation.projects.length === 0 ? (
          <p className="mt-2 text-muted">No public projects yet.</p>
        ) : (
          <ul className="mt-5 grid gap-3">
            {organisation.projects.map((project) => (
              <li key={project.slug}>
                <Link
                  href={`/project/${project.slug}`}
                  className="well flex flex-wrap items-center gap-3 p-4 text-ink no-underline hover:bg-line"
                >
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-semibold">{project.name}</p>
                    {project.description ? (
                      <p className="line-clamp-1 text-note text-muted">{project.description}</p>
                    ) : null}
                  </div>
                  <span className="chip chip-neutral">{PROJECT_STATUS_LABELS[project.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6 sm:p-8">
        <h2 className="text-subhead">Attestations issued</h2>
        {organisation.attestations.length === 0 ? (
          <p className="mt-2 max-w-[62ch] text-muted">
            None to show. Attestations this organisation issues are listed here, including any it
            later revokes, when the contributor keeps that work public.
          </p>
        ) : (
          <>
            <p className="mt-2 max-w-[62ch] text-muted">
              Work this organisation confirmed, including any it later revoked. Work the contributor
              keeps private is not listed.
            </p>
            <ul className="mt-5 grid gap-3">
              {organisation.attestations.map((item) => (
                <li key={item.id} className="well flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-semibold">
                      <Link href={`/verify/${item.id}`} className="text-ink">
                        {item.title}
                      </Link>
                    </p>
                    <p className="text-note text-muted">
                      <Link href={`/u/${item.contributorUsername}`} className="text-link">
                        {item.contributorName}
                      </Link>{" "}
                      · issued {ISSUED.format(item.issuedAt)}
                    </p>
                  </div>
                  <span className={`chip ${ATTESTATION_STATUS[item.status].tone}`}>
                    {ATTESTATION_STATUS[item.status].label}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <ReportForm
        targetType="organisation"
        targetId={organisation.slug}
        returnTo={`/org/${organisation.slug}`}
        noun="organisation"
        signedIn={Boolean(viewer)}
      />
    </div>
  );
}
