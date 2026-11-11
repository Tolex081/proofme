import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DecisionForm } from "@/components/verification/forms";
import { PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { CATEGORY_LABELS, EVIDENCE_TYPE_LABELS } from "@/lib/validation/contribution";
import { getRequestForReviewer } from "@/server/services/verification";

export const metadata: Metadata = { title: "Review a claim" };

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const KIND: Record<string, string> = {
  approve: "approved",
  reject: "did not approve",
  request_information: "asked for more",
  contributor_response: "answered",
};

const DECIDED: Record<string, string> = {
  approved: "Approved. The attestation is recorded and waiting to be anchored on NEAR.",
  rejected: "Not approved. The contributor has been told why.",
  needs_information: "Question sent to the contributor.",
};

export default function ReviewRequest({
  params,
  searchParams,
}: PageProps<"/org/[slug]/verifications/[requestId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: Pick<PageProps<"/org/[slug]/verifications/[requestId]">, "params" | "searchParams">) {
  const { slug, requestId } = await params;
  const { decided } = await searchParams;
  const { organisation, user, db } = await requireOrganisation(
    slug,
    `/org/${slug}/verifications/${requestId}`,
  );
  const view = await getRequestForReviewer(db, user.id, organisation.id, requestId);
  // Wrong organisation, no reviewing role, or no such request: all look the same.
  if (!view) notFound();
  const { contribution } = view;
  const date = (value: string | null) =>
    value ? DAY.format(new Date(`${value}T00:00:00Z`)) : null;

  return (
    <>
      <Link
        href={`/org/${organisation.slug}/verifications`}
        className="text-link mb-5 inline-flex items-center gap-1.5"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Review queue
      </Link>
      {typeof decided === "string" && DECIDED[decided] ? (
        <p role="status" className="form-message form-message-success mb-6">
          {DECIDED[decided]}
        </p>
      ) : null}
      <div className="mb-8 max-w-[46rem]">
        <p className="text-muted">
          Claim by <span className="font-semibold text-ink">{view.contributor.name}</span>
          {view.contributor.username && view.contributor.visibility === "public" ? (
            <>
              {" "}
              ·{" "}
              <Link href={`/u/${view.contributor.username}`} target="_blank" className="text-link">
                public profile
              </Link>
            </>
          ) : null}{" "}
          · sent {DAY.format(view.request.submittedAt)}
        </p>
        <h1 className="mt-2 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-[1.05] font-extrabold tracking-[-0.04em]">
          {contribution.title}
        </h1>
        <p className="mt-2 text-[1.05rem] text-muted">{contribution.summary}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-4">
          <Panel title="The claim">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[0.85rem] font-semibold text-muted">Kind of work</dt>
                <dd className="mt-0.5 font-semibold">{CATEGORY_LABELS[contribution.category]}</dd>
              </div>
              <div>
                <dt className="text-[0.85rem] font-semibold text-muted">Their role</dt>
                <dd className="mt-0.5 font-semibold">{contribution.role}</dd>
              </div>
              <div>
                <dt className="text-[0.85rem] font-semibold text-muted">Project</dt>
                <dd className="mt-0.5 font-semibold">{view.project?.name ?? "None given"}</dd>
              </div>
              <div>
                <dt className="text-[0.85rem] font-semibold text-muted">When</dt>
                <dd className="mt-0.5 font-semibold">
                  {[date(contribution.startDate), date(contribution.endDate)]
                    .filter(Boolean)
                    .join(" to ") || "Not given"}
                </dd>
              </div>
            </dl>
            <p className="mt-5 max-w-[65ch] whitespace-pre-line border-t border-line pt-5">
              {contribution.description}
            </p>
          </Panel>

          <Panel
            title="Evidence"
            intro="Open each link and judge it yourself. A link alone does not prove who did the work."
          >
            <ul className="grid gap-2">
              {view.evidence.map((item) => (
                <li key={item.id} className="well flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-semibold">{item.label}</p>
                    <p className="digest text-muted">{item.url}</p>
                    <p className="text-[0.85rem] text-muted">{EVIDENCE_TYPE_LABELS[item.type]}</p>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="text-link inline-flex items-center gap-1.5"
                  >
                    Open <ExternalLink aria-hidden="true" size={14} />
                    <span className="sr-only"> {item.label} in a new tab</span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>

          {view.history.length > 0 ? (
            <Panel title="History">
              <ol className="grid gap-4">
                {view.history.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-line pl-4">
                    <p className="text-[0.85rem] font-semibold text-muted">
                      {entry.authorName} {KIND[entry.kind]} · {DAY.format(entry.createdAt)}
                    </p>
                    {entry.message ? (
                      <p className="mt-1 whitespace-pre-line">{entry.message}</p>
                    ) : null}
                    {entry.internalNote ? (
                      <p className="mt-2 inline-flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[0.9rem]">
                        <Lock aria-hidden="true" size={14} className="mt-1 shrink-0" />
                        <span>
                          <span className="font-semibold">Internal note:</span> {entry.internalNote}
                        </span>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Decision">
            {view.canDecide ? (
              <DecisionForm
                requestId={view.request.id}
                organisationSlug={organisation.slug}
                version={view.request.version}
              />
            ) : view.attestation ? (
              <div className="grid gap-2">
                <p>Approved. The attestation is recorded.</p>
                <p className="text-[0.9rem] text-muted">Digest</p>
                <p className="digest">{view.attestation.payloadDigest}</p>
                <p className="text-[0.9rem] text-muted">
                  {view.attestation.nearAnchorStatus === "confirmed"
                    ? "Anchored on NEAR testnet."
                    : "Not anchored on NEAR yet."}
                </p>
              </div>
            ) : view.request.status === "needs_information" && !view.cannotDecideReason ? (
              <p>Waiting for the contributor to answer.</p>
            ) : view.cannotDecideReason ? (
              <p>{view.cannotDecideReason}</p>
            ) : (
              <p>This request is closed.</p>
            )}
          </Panel>
          <Panel title="What approving means">
            <p className="text-[0.92rem] text-muted">
              {organisation.name} states that it stands behind this specific claim as written. The
              claim and its evidence links are frozen and fingerprinted; nobody can edit them
              afterwards. If it later turns out to be wrong, it can be revoked, and the revocation
              stays visible.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
