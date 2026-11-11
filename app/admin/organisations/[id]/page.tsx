import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OrganisationDecisionForm } from "@/components/admin/forms";
import { MOMENT } from "@/components/admin/parts";
import { IssuerBadge, PlatformBadge } from "@/components/organisations/badges";
import { PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { allowedOrganisationDecisions, getOrganisationForAdmin } from "@/server/services/admin";

export const metadata: Metadata = { title: "Organisation review" };

const DECIDED: Record<string, string> = {
  approve: "Approved. The owners have been told.",
  reject: "Declined. The owners have been told why.",
  request_information: "Sent back for more information. The owners have been told what is missing.",
  suspend: "Suspended. The owners have been told why.",
  reinstate: "Reinstated. The owners have been told.",
};

export default function AdminOrganisation({
  params,
  searchParams,
}: PageProps<"/admin/organisations/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: Pick<PageProps<"/admin/organisations/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { decided } = await searchParams;
  const { db, user } = await requireAdmin(`/admin/organisations/${id}`);
  const view = await getOrganisationForAdmin(db, user.id, id);
  if (!view) notFound();
  const { organisation } = view;
  const allowed = allowedOrganisationDecisions(organisation.platformVerificationStatus);

  return (
    <>
      <Link href="/admin/organisations" className="text-link mb-5 inline-flex items-center gap-1.5">
        <ArrowLeft aria-hidden="true" size={16} /> Organisations
      </Link>
      {typeof decided === "string" && DECIDED[decided] ? (
        <p role="status" className="form-message form-message-success mb-6">
          {DECIDED[decided]}
        </p>
      ) : null}
      <div className="mb-8">
        <h1 className="text-page leading-[1.05] font-extrabold tracking-[-0.04em]">
          {organisation.name}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <PlatformBadge status={organisation.platformVerificationStatus} />
          <IssuerBadge status={organisation.nearIssuerStatus} />
        </div>
      </div>

      <div className="grid gap-6">
        <Panel title="What they told us">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-meta font-semibold text-muted">Public page</dt>
              <dd>
                <Link href={`/org/${organisation.slug}`} className="text-link">
                  /org/{organisation.slug}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-meta font-semibold text-muted">Website</dt>
              <dd>
                {organisation.websiteUrl ? (
                  <a
                    href={organisation.websiteUrl}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="text-link inline-flex items-center gap-1 break-all"
                  >
                    {organisation.websiteUrl}
                    <ExternalLink aria-hidden="true" size={14} />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  "None given"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-meta font-semibold text-muted">Owners</dt>
              <dd>
                <ul>
                  {view.owners.map((owner) => (
                    <li key={owner.email}>
                      {owner.name} <span className="text-muted">({owner.email})</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt className="text-meta font-semibold text-muted">Activity</dt>
              <dd>
                {view.members} active {view.members === 1 ? "member" : "members"},{" "}
                {view.attestationsIssued} attestations issued
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-meta font-semibold text-muted">Description</dt>
              <dd className="whitespace-pre-line">{organisation.description || "None given"}</dd>
            </div>
            {organisation.platformVerificationReason ? (
              <div className="sm:col-span-2">
                <dt className="text-meta font-semibold text-muted">Last reason given</dt>
                <dd>{organisation.platformVerificationReason}</dd>
              </div>
            ) : null}
          </dl>
        </Panel>

        <Panel
          title="Decision"
          intro="This changes only ProofMe's review of the organisation. Its attestations and NEAR issuer registration are not touched."
        >
          {allowed.length === 0 ? (
            <p className="text-muted">No decision is possible in this state.</p>
          ) : (
            <OrganisationDecisionForm
              key={organisation.platformVerificationStatus}
              organisationId={organisation.id}
              allowed={allowed}
            />
          )}
        </Panel>

        <Panel title="History">
          {view.history.length === 0 ? (
            <p className="text-muted">Nothing recorded yet.</p>
          ) : (
            <ol className="grid gap-3">
              {view.history.map((event, index) => (
                <li key={index} className="border-b border-line pb-3 last:border-0">
                  <p className="font-semibold">{event.action}</p>
                  <p className="text-meta text-muted">
                    {event.actorName ?? "Deleted account"} · {MOMENT.format(event.createdAt)}
                  </p>
                  {typeof (event.metadata as { reason?: unknown })?.reason === "string" ? (
                    <p className="mt-1">{(event.metadata as { reason: string }).reason}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}
