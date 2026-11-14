import { ExternalLink, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  CorrectionControl,
  IssuerPanel,
  MintButton,
  RevokeControl,
} from "@/components/near/controls";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { getChainReader, getNearConfig } from "@/lib/near/server";
import { mintBlocker, refreshIssuerStatus } from "@/server/services/near";
import { issuerEligibility } from "@/server/services/near-identity";
import { listIssuedAttestations } from "@/server/services/verification";

export const metadata: Metadata = { title: "Attestations" };

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const ANCHOR_LABELS = {
  awaiting: "Not on NEAR yet",
  submitted: "Sent to NEAR",
  confirmed: "NFT issued on testnet",
  failed: "NEAR step failed",
} as const;

export default function Attestations({ params }: PageProps<"/org/[slug]/attestations">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/org/[slug]/attestations">, "params">) {
  const { slug } = await params;
  const {
    organisation: loaded,
    user,
    db,
    can,
  } = await requireOrganisation(slug, `/org/${slug}/attestations`);
  const near = getNearConfig();
  // A proven issuer account that Atesta has not yet seen registered: ask the
  // contract now, so nobody has to press "Check registration" first.
  let organisation = loaded;
  if (
    near &&
    loaded.nearIssuerAccountId &&
    loaded.nearIssuerVerifiedAt &&
    loaded.nearIssuerStatus !== "registered"
  ) {
    const checked = await refreshIssuerStatus(db, getChainReader(), user.id, loaded.id);
    if (checked.ok) organisation = { ...loaded, nearIssuerStatus: checked.value.status };
  }
  const items = (await listIssuedAttestations(db, user.id, organisation.id)) ?? [];
  const issuer = issuerEligibility(organisation);
  const canMint = can("attestation.anchor") && issuer.eligible;
  const canRevoke = can("attestation.revoke");

  return (
    <>
      <PageHeading
        title="Attestations"
        intro="Every claim this organisation has approved. Approval and the NFT on NEAR are shown separately."
      />
      <IssuerPanel
        organisationId={organisation.id}
        slug={organisation.slug}
        accountId={organisation.nearIssuerAccountId}
        status={organisation.nearIssuerStatus}
        canConfigure={can("issuer.configure")}
        contractId={near?.contractId ?? null}
      />
      {!issuer.eligible ? (
        <p className="mb-6 rounded-2xl bg-wait p-4 text-wait-ink">
          <span className="font-semibold">Not able to issue credentials yet.</span> {issuer.reason}{" "}
          Atesta&rsquo;s issuer policy: the organisation is verified by Atesta, an owner has proved
          control of the issuer account with a wallet signature, and the contract lists that account
          as this organisation&rsquo;s active issuer.
        </p>
      ) : null}
      {items.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
            <ScrollText aria-hidden="true" size={24} />
          </span>
          <h2 className="mt-5 text-[1.3rem]">None issued yet</h2>
          <p className="mt-2 max-w-[44ch] text-muted">
            Approving a claim in the review queue records an attestation here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => {
            const active = item.status === "active";
            const onNear = item.nearAnchorStatus === "confirmed";
            // Nobody issues an attestation about their own work.
            const blocker = mintBlocker({
              organisation,
              attestation: item,
              contributionVisibility: item.visibility,
              subject: {
                nearAccountId: item.subjectNearAccountId,
                nearAccountVerifiedAt: item.subjectNearAccountVerifiedAt,
              },
            });
            const mintable =
              active && !onNear && canMint && !blocker && item.subjectUserId !== user.id;
            return (
              <li key={item.id} className="card grid gap-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <div className="min-w-[14rem] flex-1">
                    <p className="font-display text-[1.15rem] font-bold">{item.title}</p>
                    <p className="text-[0.9rem] text-muted">
                      {item.contributorName} · approved {DAY.format(item.issuedAt)}
                    </p>
                    <p className="digest mt-1 text-muted">{item.payloadDigest}</p>
                  </div>
                  <span className={`chip ${active ? "chip-ok" : "chip-bad"}`}>
                    {active
                      ? "Organisation approved"
                      : item.status === "revoked"
                        ? "Revoked"
                        : "Superseded"}
                  </span>
                  <span
                    className={`chip ${onNear ? "chip-ok" : item.nearAnchorStatus === "failed" ? "chip-bad" : "chip-wait"}`}
                  >
                    {ANCHOR_LABELS[item.nearAnchorStatus]}
                  </span>
                </div>

                <div className="flex flex-wrap items-start gap-x-5 gap-y-3 border-t border-line pt-4">
                  {mintable ? (
                    <MintButton attestationId={item.id} slug={organisation.slug} />
                  ) : active && !onNear && issuer.eligible && blocker ? (
                    <p className="min-h-11 content-center text-[0.9rem] text-wait-ink">{blocker}</p>
                  ) : null}
                  {active && canRevoke && item.subjectUserId !== user.id ? (
                    <CorrectionControl
                      attestationId={item.id}
                      slug={organisation.slug}
                      onNear={onNear}
                      initial={{
                        title: item.title,
                        summary: item.summary,
                        description: item.description,
                        role: item.role,
                        startDate: item.startDate ?? "",
                        endDate: item.endDate ?? "",
                      }}
                    />
                  ) : null}
                  {item.supersedesAttestationId ? (
                    <Link
                      href={`/verify/${item.supersedesAttestationId}`}
                      className="text-link min-h-11 content-center text-[0.9rem]"
                    >
                      Corrects an earlier record
                    </Link>
                  ) : null}
                  {active && canRevoke ? (
                    <RevokeControl
                      attestationId={item.id}
                      slug={organisation.slug}
                      issuerAccountId={onNear ? item.nearIssuerAccountId : null}
                    />
                  ) : null}
                  {item.isPublic ? (
                    <Link href={`/verify/${item.id}`} className="text-link min-h-11 content-center">
                      Public verification page
                    </Link>
                  ) : (
                    <p className="min-h-11 content-center text-[0.9rem] text-muted">
                      The contributor keeps this private, so it has no public page.
                    </p>
                  )}
                  {near && item.nearTransactionHash ? (
                    <a
                      href={`${near.explorerBaseUrl}/txns/${item.nearTransactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link inline-flex min-h-11 items-center gap-1.5"
                    >
                      Transaction <ExternalLink aria-hidden="true" size={14} />
                      <span className="sr-only"> on the NEAR explorer, in a new tab</span>
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
