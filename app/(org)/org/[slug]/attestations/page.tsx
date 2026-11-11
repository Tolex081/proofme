import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { listIssuedAttestations } from "@/server/services/verification";

export const metadata: Metadata = { title: "Attestations" };

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function Attestations({ params }: PageProps<"/org/[slug]/attestations">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/org/[slug]/attestations">, "params">) {
  const { slug } = await params;
  const { organisation, user, db } = await requireOrganisation(slug, `/org/${slug}/attestations`);
  const items = (await listIssuedAttestations(db, user.id, organisation.id)) ?? [];

  return (
    <>
      <PageHeading
        title="Attestations"
        intro="Every claim this organisation has approved. Approval and NEAR anchoring are shown separately."
      />
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
          {items.map((item) => (
            <li
              key={item.id}
              className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-5 sm:p-6"
            >
              <div className="min-w-[14rem] flex-1">
                <p className="font-display text-[1.15rem] font-bold">{item.title}</p>
                <p className="text-[0.9rem] text-muted">
                  {item.contributorName} · approved {DAY.format(item.issuedAt)}
                </p>
                <p className="digest mt-1 text-muted">{item.payloadDigest}</p>
              </div>
              <span className={`chip ${item.status === "active" ? "chip-ok" : "chip-bad"}`}>
                {item.status === "active"
                  ? "Organisation approved"
                  : item.status === "revoked"
                    ? "Revoked"
                    : "Superseded"}
              </span>
              <span
                className={`chip ${item.nearAnchorStatus === "confirmed" ? "chip-ok" : item.nearAnchorStatus === "failed" ? "chip-bad" : "chip-wait"}`}
              >
                {
                  {
                    awaiting: "Awaiting NEAR anchor",
                    submitted: "Anchor submitted",
                    confirmed: "Anchored on testnet",
                    failed: "Anchor failed",
                  }[item.nearAnchorStatus]
                }
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
