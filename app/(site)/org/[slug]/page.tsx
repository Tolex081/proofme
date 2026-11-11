import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { IssuerBadge, PlatformBadge, platformMeaning } from "@/components/organisations/badges";
import { getDb } from "@/lib/db/client";
import { ORGANISATION_CATEGORY_LABELS, PROJECT_STATUS_LABELS } from "@/lib/validation/organisation";
import { getPublicOrganisation } from "@/server/services/organisations";

export const metadata: Metadata = { title: "Organisation" };

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

  return (
    <div className="grid gap-4">
      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <span
            aria-hidden="true"
            className="org-mark size-20 rounded-[1.4rem] text-[1.9rem]"
            style={{ background: "#4C6EF5" }}
          >
            {organisation.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="text-[clamp(1.8rem,3.4vw,2.4rem)] leading-tight font-extrabold tracking-[-0.035em]">
              {organisation.name}
            </h1>
            <p className="text-muted">
              {ORGANISATION_CATEGORY_LABELS[organisation.category]} · on ProofMe since{" "}
              {SINCE.format(organisation.createdAt)}
            </p>
          </div>
        </div>
        {organisation.description ? (
          <p className="mt-6 max-w-[62ch] text-[1.05rem]">{organisation.description}</p>
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
        <h2 className="text-[1.3rem]">Standing</h2>
        <p className="mt-2 max-w-[62ch] text-muted">
          Two separate facts. Neither implies the other.
        </p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-[0.85rem] font-semibold text-muted">ProofMe review</dt>
            <dd className="mt-2">
              <PlatformBadge status={organisation.platformVerificationStatus} />
              <p className="mt-2 text-[0.92rem] text-muted">
                {platformMeaning(organisation.platformVerificationStatus)}
              </p>
            </dd>
          </div>
          <div>
            <dt className="text-[0.85rem] font-semibold text-muted">NEAR testnet issuer</dt>
            <dd className="mt-2">
              <IssuerBadge status={organisation.nearIssuerStatus} />
              <p className="mt-2 text-[0.92rem] text-muted">
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
        <h2 className="text-[1.3rem]">Projects</h2>
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
                      <p className="line-clamp-1 text-[0.9rem] text-muted">{project.description}</p>
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
        <h2 className="text-[1.3rem]">Attestations issued</h2>
        <p className="mt-2 max-w-[62ch] text-muted">
          None yet. Attestations this organisation issues will be listed here, including any it
          later revokes.
        </p>
      </section>
    </div>
  );
}
