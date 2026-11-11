import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeleteDraftButton, PublishButton } from "@/components/contributions/record-actions";
import { STATUS_INFO, StatusChip } from "@/components/contributions/status";
import { PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { isContributionEditable } from "@/lib/domain/status";
import {
  CATEGORY_LABELS,
  EVIDENCE_TYPE_LABELS,
  readinessProblems,
} from "@/lib/validation/contribution";
import { getOwnContribution } from "@/server/services/contributions";

export const metadata: Metadata = { title: "Contribution" };

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
  const { saved } = await searchParams;
  const { user, db } = await requireWorkspace(`/dashboard/contributions/${id}`);
  const contribution = await getOwnContribution(db, user.id, id);
  // Someone else's contribution and a missing one look the same.
  if (!contribution) notFound();

  const editable = isContributionEditable(contribution.status);
  const started = formatDate(contribution.startDate);
  const finished = formatDate(contribution.endDate);
  const problems = readinessProblems({
    summary: contribution.summary,
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

      {saved === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          Saved.
        </p>
      ) : null}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[44rem]">
          <StatusChip status={contribution.status} />
          <h1 className="mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] leading-[1.05] font-extrabold tracking-[-0.04em]">
            {contribution.title}
          </h1>
          {contribution.summary ? (
            <p className="mt-2 text-[1.05rem] text-muted">{contribution.summary}</p>
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
                <dt className="text-[0.85rem] font-semibold text-muted">Kind of work</dt>
                <dd className="mt-0.5 font-semibold">{CATEGORY_LABELS[contribution.category]}</dd>
              </div>
              <div>
                <dt className="text-[0.85rem] font-semibold text-muted">Your role</dt>
                <dd className="mt-0.5 font-semibold">{contribution.role || "Not given"}</dd>
              </div>
              <div>
                <dt className="text-[0.85rem] font-semibold text-muted">When</dt>
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
                <dt className="text-[0.85rem] font-semibold text-muted">Visibility</dt>
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
                  <li key={skill} className="rounded-full bg-surface-2 px-3 py-1 text-[0.9rem]">
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
                      <p className="text-[0.85rem] text-muted">
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
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Where it stands">
            <p>{STATUS_INFO[contribution.status].meaning}</p>
            {contribution.status === "draft" ? (
              <div className="mt-5 grid gap-4 border-t border-line pt-5">
                <p className="text-[0.92rem] text-muted">
                  Mark it as self-reported to show it on your profile as your own account of the
                  work. Sending it to an organisation for confirmation arrives with the review stage
                  of this build.
                </p>
                {problems.length > 0 ? (
                  <ul className="grid gap-1 text-[0.92rem]">
                    {problems.map((problem) => (
                      <li key={problem} className="text-wait-ink">
                        {problem}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <PublishButton contributionId={contribution.id} />
                )}
                <div>
                  <DeleteDraftButton contributionId={contribution.id} />
                </div>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
