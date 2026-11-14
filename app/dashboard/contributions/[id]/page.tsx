import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeleteDraftButton, PublishButton } from "@/components/contributions/record-actions";
import { STATUS_INFO, StatusChip } from "@/components/contributions/status";
import { InvestigateButton } from "@/components/evidence/parts";
import { EvidenceReportView } from "@/components/evidence/report";
import { PublishConsent } from "@/components/near/account-proof";
import { latestReportForContributor } from "@/server/services/evidence-agent";
import { PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { isContributionEditable } from "@/lib/domain/status";
import {
  CATEGORY_LABELS,
  EVIDENCE_TYPE_LABELS,
  readinessProblems,
} from "@/lib/validation/contribution";
import { getOwnContribution } from "@/server/services/contributions";
import { contributorReviewHistory, listSubmissionTargets } from "@/server/services/verification";
import {
  RespondForm,
  ReviseButton,
  SubmitForReviewForm,
  WithdrawButton,
} from "@/components/verification/forms";

export const metadata: Metadata = { title: "Contribution" };

const UPDATES: Record<string, string> = {
  sent: "Sent for review. The organisation's reviewers have been told.",
  answered: "Answer sent. The claim is back with the reviewers.",
  withdrawn: "Withdrawn from review. It is now self-reported.",
};

const REVIEW_LABELS: Record<string, string> = {
  approve: "approved",
  reject: "did not approve",
  request_information: "asked for more",
  contributor_response: "answered",
};

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string | null) {
  return value ? DAY.format(new Date(`${value}T00:00:00Z`)) : null;
}

export default function ContributionDetail({
  params,
  searchParams,
}: PageProps<"/dashboard/contributions/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DetailContent({
  params,
  searchParams,
}: Pick<PageProps<"/dashboard/contributions/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { saved, update } = await searchParams;
  const { user, db, profile } = await requireWorkspace(`/dashboard/contributions/${id}`);
  const contribution = await getOwnContribution(db, user.id, id);
  // Someone else's contribution and a missing one look the same.
  if (!contribution) notFound();

  const editable = isContributionEditable(contribution.status);
  const history = await contributorReviewHistory(db, user.id, contribution.id);
  const report = await latestReportForContributor(db, user.id, contribution.id);
  const requests = history?.requests ?? [];
  const current = requests.at(-1) ?? null;
  const lastMessage = (kind: string) =>
    current?.reviews.filter((review) => review.kind === kind).at(-1)?.message ?? null;
  const canSend = contribution.status === "draft" || contribution.status === "self_reported";
  const targets = canSend
    ? (await listSubmissionTargets(db)).map((target) => ({
        id: target.id,
        name: target.name,
        reviewed: target.platformVerificationStatus === "verified",
        projects: target.projects.map((project) => ({ id: project.id, name: project.name })),
      }))
    : [];
  const started = formatDate(contribution.startDate);
  const finished = formatDate(contribution.endDate);
  const problems = readinessProblems({
    summary: contribution.summary,
    description: contribution.description,
    role: contribution.role,
    evidenceCount: contribution.evidence.length,
  });

  return (
    <>
      <Link
        href="/dashboard/contributions"
        className="text-link mb-5 inline-flex items-center gap-1.5"
      >
        <ArrowLeft aria-hidden="true" size={16} /> All contributions
      </Link>

      {typeof update === "string" && UPDATES[update] ? (
        <p role="status" className="form-message form-message-success mb-6">
          {UPDATES[update]}
        </p>
      ) : null}
      {saved === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          Saved.
        </p>
      ) : null}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[44rem]">
          <StatusChip status={contribution.status} />
          <h1 className="mt-3 text-page leading-[1.05] font-extrabold tracking-[-0.04em]">
            {contribution.title}
          </h1>
          {contribution.summary ? (
            <p className="mt-2 text-lead text-muted">{contribution.summary}</p>
          ) : null}
        </div>
        {editable ? (
          <Link
            href={`/dashboard/contributions/${contribution.id}/edit`}
            className="action action-secondary"
          >
            <Pencil aria-hidden="true" size={16} /> Edit
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-4">
          <Panel title="The work">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-meta font-semibold text-muted">Kind of work</dt>
                <dd className="mt-0.5 font-semibold">{CATEGORY_LABELS[contribution.category]}</dd>
              </div>
              <div>
                <dt className="text-meta font-semibold text-muted">Your role</dt>
                <dd className="mt-0.5 font-semibold">{contribution.role || "Not given"}</dd>
              </div>
              <div>
                <dt className="text-meta font-semibold text-muted">When</dt>
                <dd className="mt-0.5 font-semibold">
                  {started && finished
                    ? `${started} to ${finished}`
                    : started
                      ? `From ${started}`
                      : finished
                        ? `Until ${finished}`
                        : "Not given"}
                </dd>
              </div>
              <div>
                <dt className="text-meta font-semibold text-muted">Visibility</dt>
                <dd className="mt-0.5 font-semibold">
                  {contribution.visibility === "public"
                    ? "Can appear on your public profile"
                    : "Private"}
                </dd>
              </div>
            </dl>
            {contribution.skills.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-2">
                {contribution.skills.map((skill) => (
                  <li key={skill} className="rounded-full bg-surface-2 px-3 py-1 text-note">
                    {skill}
                  </li>
                ))}
              </ul>
            ) : null}
            {contribution.description ? (
              <p className="mt-5 max-w-[65ch] whitespace-pre-line border-t border-line pt-5">
                {contribution.description}
              </p>
            ) : null}
          </Panel>

          <Panel
            title="Evidence"
            intro="References for a reviewer to open and judge. A link alone does not prove the work was yours."
          >
            {contribution.evidence.length === 0 ? (
              <p className="text-muted">No links yet.</p>
            ) : (
              <ul className="grid gap-2">
                {contribution.evidence.map((item) => (
                  <li key={item.id} className="well flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-[12rem] flex-1">
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-meta text-muted">
                        {EVIDENCE_TYPE_LABELS[item.type]} ·{" "}
                        {new URL(item.url).hostname.replace(/^www\./, "")}
                      </p>
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
            )}
          </Panel>
          <Panel
            title="Evidence investigation"
            intro="Atesta's Evidence Agent checks your GitHub links against GitHub itself and against your linked GitHub account, then explains what they do and do not show. The organisation's reviewer sees the latest report. It never approves anything; the reviewer decides."
          >
            <div className="grid gap-5">
              <InvestigateButton contributionId={contribution.id} />
              {report ? <EvidenceReportView view={report} /> : null}
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Where it stands">
            <p>{STATUS_INFO[contribution.status].meaning}</p>

            {canSend ? (
              <div className="mt-5 grid gap-4 border-t border-line pt-5">
                {problems.length > 0 ? (
                  <>
                    <p className="text-note text-muted">Before it can be confirmed or shown:</p>
                    <ul className="grid gap-1 text-note">
                      {problems.map((problem) => (
                        <li key={problem} className="text-wait-ink">
                          {problem}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <SubmitForReviewForm contributionId={contribution.id} targets={targets} />
                )}
                {contribution.status === "draft" && problems.length === 0 ? (
                  <div className="border-t border-line pt-4">
                    <p className="mb-3 text-note text-muted">
                      Or show it on your profile as your own account, without confirmation.
                    </p>
                    <PublishButton contributionId={contribution.id} />
                  </div>
                ) : null}
                {contribution.status === "draft" ? (
                  <div>
                    <DeleteDraftButton contributionId={contribution.id} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {contribution.status === "pending" && current ? (
              <div className="mt-5 grid gap-4 border-t border-line pt-5">
                <p className="text-note">
                  With <span className="font-semibold">{current.organisation.name}</span>&rsquo;s
                  reviewers since {DAY.format(current.submittedAt)}.
                </p>
                <WithdrawButton contributionId={contribution.id} />
              </div>
            ) : null}

            {contribution.status === "needs_information" && current ? (
              <div className="mt-5 grid gap-4 border-t border-line pt-5">
                <div className="rounded-2xl bg-wait p-4 text-wait-ink">
                  <p className="text-meta font-semibold">{current.organisation.name} asks</p>
                  <p className="mt-1 whitespace-pre-line">{lastMessage("request_information")}</p>
                </div>
                <RespondForm contributionId={contribution.id} />
                <WithdrawButton contributionId={contribution.id} />
              </div>
            ) : null}

            {contribution.status === "rejected" && current ? (
              <div className="mt-5 grid gap-4 border-t border-line pt-5">
                <div className="rounded-2xl bg-bad p-4 text-bad-ink">
                  <p className="text-meta font-semibold">{current.organisation.name} said</p>
                  <p className="mt-1 whitespace-pre-line">{lastMessage("reject")}</p>
                </div>
                <ReviseButton contributionId={contribution.id} />
              </div>
            ) : null}

            {history?.attestation ? (
              <div className="mt-5 grid gap-3 border-t border-line pt-5">
                <p className="text-note">
                  Approved by <span className="font-semibold">{current?.organisation.name}</span> on{" "}
                  {DAY.format(history.attestation.issuedAt)}.
                </p>
                <dl className="grid gap-2 text-note">
                  <div>
                    <dt className="text-muted">Attestation</dt>
                    <dd className="digest">{history.attestation.id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Digest</dt>
                    <dd className="digest">{history.attestation.payloadDigest}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">NEAR testnet</dt>
                    <dd>
                      {history.attestation.nearAnchorStatus === "confirmed"
                        ? "Issued to your NEAR account as an NFT that cannot be transferred."
                        : profile.nearAccountId && profile.nearAccountVerifiedAt
                          ? `Not issued yet. The organisation issues it to ${profile.nearAccountId}, which you proved with your wallet.`
                          : "Not issued yet. Prove your NEAR account under Identity so the organisation has somewhere to send it."}
                    </dd>
                  </div>
                </dl>
                {history.attestation.status === "active" &&
                history.attestation.nearAnchorStatus !== "confirmed" &&
                contribution.visibility === "public" &&
                history.attestation.schemaVersion === "proofme.attestation.v2" ? (
                  <PublishConsent
                    attestationId={history.attestation.id}
                    contributionId={contribution.id}
                    published={
                      history.attestation.subjectConsentedAt
                        ? history.attestation.credentialReference
                        : null
                    }
                  />
                ) : null}
                {contribution.visibility === "public" ? (
                  <Link href={`/verify/${history.attestation.id}`} className="text-link">
                    Public verification page
                  </Link>
                ) : (
                  <p className="text-note text-muted">
                    This contribution is private, so it has no public verification page.
                  </p>
                )}
              </div>
            ) : null}
          </Panel>

          {requests.some((request) => request.reviews.length > 0) ? (
            <Panel title="Review history">
              <ol className="grid gap-4">
                {requests.flatMap((request) =>
                  request.reviews.map((review) => (
                    <li key={review.id} className="border-l-2 border-line pl-4">
                      <p className="text-meta font-semibold text-muted">
                        {review.byContributor ? "You" : request.organisation.name} ·{" "}
                        {REVIEW_LABELS[review.kind]} · {DAY.format(review.createdAt)}
                      </p>
                      {review.message ? (
                        <p className="mt-1 whitespace-pre-line">{review.message}</p>
                      ) : null}
                    </li>
                  )),
                )}
              </ol>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
