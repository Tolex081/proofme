import { BadgeCheck, CircleAlert, Clock, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { referenceUrl } from "@/lib/credentials/publish";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { getChainReader, getNearConfig } from "@/lib/near/server";
import { CATEGORY_LABELS, EVIDENCE_TYPE_LABELS } from "@/lib/validation/contribution";
import { getPublicVerification, type PublicVerification } from "@/server/services/near";

export const metadata: Metadata = {
  title: "Verify an attestation",
  robots: { index: false },
};

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const MOMENT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

type Tone = "ok" | "wait" | "bad";

/** The one-line answer, decided from the record check and the live contract read. */
function verdict(view: PublicVerification): { tone: Tone; title: string; detail: string } {
  const issuer = view.issuer.name;
  if (view.recordFailure) {
    return {
      tone: "bad",
      title: "This record fails its integrity check",
      detail: "The stored record does not hash to its recorded digest. Do not rely on it.",
    };
  }
  const { chain } = view;
  if (chain.state === "found") {
    if (!chain.digestMatches) {
      return {
        tone: "bad",
        title: "This record does not match the one on NEAR",
        detail: "The digest held by the contract is different. Do not rely on what is shown here.",
      };
    }
    if (chain.status === "revoked") {
      return {
        tone: "bad",
        title: `Revoked by ${issuer}`,
        detail: `${issuer} withdrew this attestation on ${DAY.format(chain.statusChangedAt)}. The contract on NEAR marks the token as revoked.`,
      };
    }
    if (chain.status === "superseded") {
      return {
        tone: "wait",
        title: "Replaced by a newer attestation",
        detail: `${issuer} issued a corrected record on ${DAY.format(chain.statusChangedAt)}. This one no longer stands.`,
      };
    }
    if (chain.issuerStatus === "suspended") {
      return {
        tone: "wait",
        title: "On NEAR, but the issuer has since been suspended",
        detail: `The record matches and has not been revoked. ${issuer}'s issuer account was suspended after it was issued; weigh it accordingly.`,
      };
    }
    return {
      tone: "ok",
      title: `Approved by ${issuer} and confirmed on NEAR`,
      detail:
        "The record below hashes to the digest held by the contract, and the contract shows the token as active.",
    };
  }
  if (view.status === "revoked") {
    return {
      tone: "bad",
      title: `Revoked by ${issuer}`,
      detail: `${issuer} withdrew this attestation${view.revokedAt ? ` on ${DAY.format(view.revokedAt)}` : ""}.`,
    };
  }
  if (chain.state === "unavailable") {
    return {
      tone: "wait",
      title: "NEAR could not be reached just now",
      detail: `The record is intact and ${issuer} approved it, but its status on NEAR could not be read. Reload to try again.`,
    };
  }
  return {
    tone: "wait",
    title: `Approved by ${issuer}, not on NEAR yet`,
    detail:
      "The record is intact and the organisation approved it. It has not been issued as an NFT, so there is nothing on-chain to check it against.",
  };
}

const TONE = {
  ok: { box: "bg-ok text-ok-ink", icon: BadgeCheck },
  wait: { box: "bg-wait text-wait-ink", icon: Clock },
  bad: { box: "bg-bad text-bad-ink", icon: CircleAlert },
} as const;

export default function VerifyPage({ params }: PageProps<"/verify/[id]">) {
  return (
    <div className="column pt-4 pb-20 lg:pt-8">
      <div className="mx-auto max-w-[52rem]">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-[1.75rem] bg-surface-2" />}>
          <Content params={params} />
        </Suspense>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.85rem] font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

async function Content({ params }: Pick<PageProps<"/verify/[id]">, "params">) {
  const { id } = await params;
  const view = await getPublicVerification(await getDb(), getChainReader(), id);
  // A private record and an ID that does not exist look the same.
  if (!view) notFound();

  const near = getNearConfig();
  const answer = verdict(view);
  const tone = TONE[answer.tone];
  const claim = view.payload?.claim ?? null;
  // Never fall back to a username inside the record: a private profile stays private.
  const subjectName = view.subject.displayName ?? "A contributor";
  const explorer = near?.explorerBaseUrl ?? null;
  const chain = view.chain.state === "found" ? view.chain : null;
  const gateway = getEnv().PINATA_GATEWAY;

  return (
    <article className="grid gap-4">
      <header>
        <p className="text-[0.9rem] font-semibold text-muted">ProofMe attestation</p>
        <h1 className="mt-1 text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.05] font-extrabold tracking-[-0.04em]">
          {claim?.title ?? "Attestation"}
        </h1>
        <p className="mt-2 text-[1.05rem] text-muted">
          {view.subject.username ? (
            <Link href={`/u/${view.subject.username}`} className="text-link">
              {subjectName}
            </Link>
          ) : (
            subjectName
          )}
          {claim?.role ? ` · ${claim.role}` : ""} ·{" "}
          <Link href={`/org/${view.issuer.slug}`} className="text-link">
            {view.issuer.name}
          </Link>
        </p>
      </header>

      <section
        aria-labelledby="verdict"
        className={`flex items-start gap-4 rounded-[1.75rem] p-5 sm:p-6 ${tone.box}`}
      >
        <tone.icon aria-hidden="true" size={28} className="mt-0.5 shrink-0" />
        <div>
          <h2 id="verdict" className="text-[1.25rem] leading-tight">
            {answer.title}
          </h2>
          <p className="mt-1.5 max-w-[60ch]">{answer.detail}</p>
        </div>
      </section>

      {claim ? (
        <section aria-labelledby="claim" className="card p-5 sm:p-7">
          <h2 id="claim" className="text-[1.2rem]">
            What {view.issuer.name} approved
          </h2>
          <p className="mt-3 max-w-[65ch]">{claim.summary}</p>
          <p className="mt-3 max-w-[65ch] whitespace-pre-line text-muted">{claim.description}</p>
          <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <Fact label="Kind of work">{CATEGORY_LABELS[claim.category]}</Fact>
            <Fact label="Role">{claim.role}</Fact>
            <Fact label="When">
              {claim.startDate && claim.endDate
                ? `${claim.startDate} to ${claim.endDate}`
                : (claim.startDate ?? claim.endDate ?? "Not given")}
            </Fact>
            <Fact label="Approved">{DAY.format(view.issuedAt)}</Fact>
          </dl>
          {claim.skills.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-2">
              {claim.skills.map((skill) => (
                <li key={skill} className="rounded-full bg-surface-2 px-3 py-1 text-[0.9rem]">
                  {skill}
                </li>
              ))}
            </ul>
          ) : null}
          <h3 className="mt-6 text-[1rem]">Evidence the reviewer was shown</h3>
          <ul className="mt-2 grid gap-2">
            {view.payload!.evidence.map((item) => (
              <li key={item.url} className="well flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-[12rem] flex-1">
                  <p className="font-semibold">{item.label}</p>
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
        </section>
      ) : null}

      <section aria-labelledby="checks" className="card p-5 sm:p-7">
        <h2 id="checks" className="text-[1.2rem]">
          How this was checked
        </h2>
        <p className="mt-2 max-w-[65ch] text-muted">
          Both checks ran when this page loaded. Nothing here is a stored &ldquo;verified&rdquo;
          flag.
        </p>
        <ol className="mt-5 grid gap-5">
          <li className="border-l-2 border-line pl-4">
            <p className="font-semibold">
              1. The record hashes to its digest:{" "}
              <span className={view.recordFailure ? "text-bad-ink" : "text-ok-ink"}>
                {view.recordFailure ? "no" : "yes"}
              </span>
            </p>
            <p className="mt-1 text-[0.92rem] text-muted">
              SHA-256 over the canonical record, recomputed just now.
            </p>
            <p className="digest mt-2">{view.digest}</p>
          </li>
          <li className="border-l-2 border-line pl-4">
            <p className="font-semibold">
              2. The contract on NEAR holds the same digest:{" "}
              {chain ? (
                <span className={chain.digestMatches ? "text-ok-ink" : "text-bad-ink"}>
                  {chain.digestMatches ? "yes" : "no"}
                </span>
              ) : (
                <span className="text-wait-ink">
                  {view.chain.state === "unavailable" ? "could not be read" : "not on NEAR"}
                </span>
              )}
            </p>
            {chain ? (
              <dl className="mt-3 grid gap-3 text-[0.92rem] sm:grid-cols-2">
                <Fact label="Token status on NEAR">
                  <span className="font-semibold">{chain.status}</span>
                </Fact>
                <Fact label="Transferable">No. It stays with the account it was issued to.</Fact>
                <Fact label="Held by">
                  <span className="digest">{chain.ownerId}</span>
                </Fact>
                <Fact label="Issued by">
                  <span className="digest">{chain.issuerId}</span>
                </Fact>
                <Fact label="Issued on NEAR">{MOMENT.format(chain.issuedAt)}</Fact>
                <Fact label="Contract">
                  <span className="digest">{view.near.contractId ?? near?.contractId}</span>
                </Fact>
              </dl>
            ) : null}
            {explorer && (view.near.transactionHash || view.near.revocationTransactionHash) ? (
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                {view.near.transactionHash ? (
                  <a
                    href={`${explorer}/txns/${view.near.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link inline-flex items-center gap-1.5"
                  >
                    Issuing transaction <ExternalLink aria-hidden="true" size={14} />
                  </a>
                ) : null}
                {view.near.revocationTransactionHash ? (
                  <a
                    href={`${explorer}/txns/${view.near.revocationTransactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link inline-flex items-center gap-1.5"
                  >
                    Revoking transaction <ExternalLink aria-hidden="true" size={14} />
                  </a>
                ) : null}
              </p>
            ) : null}
          </li>
        </ol>
        <dl className="mt-5 border-t border-line pt-5">
          <Fact label="Attestation ID (the token ID on NEAR)">
            <span className="digest">{view.id}</span>
          </Fact>
        </dl>
      </section>

      {view.credential ? (
        <section aria-labelledby="portable" className="card p-5 sm:p-7">
          <h2 id="portable" className="text-[1.2rem]">
            Check it without ProofMe
          </h2>
          <p className="mt-2 max-w-[65ch] text-muted">
            The NFT points at the public credential document (NEP-177 <code>reference</code>) and
            carries its Base64 SHA-256 (<code>reference_hash</code>). Fetch the document, hash its
            exact bytes, and compare with both the reference hash and the digest stored on NEAR. No
            ProofMe account or database is involved.
          </p>
          <dl className="mt-4 grid gap-3 text-[0.92rem]">
            <Fact label="Document">
              <a
                href={referenceUrl(view.credential.reference, gateway)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link digest inline-flex items-center gap-1.5 break-all"
              >
                {view.credential.reference} <ExternalLink aria-hidden="true" size={14} />
              </a>
            </Fact>
            <Fact label="reference_hash (Base64 SHA-256)">
              <span className="digest">{view.credential.referenceHash}</span>
            </Fact>
            {view.near.ownerAccountId ? (
              <Fact label="Ask the contract">
                <span className="digest break-all">
                  near contract call-function as-read-only {view.near.contractId} verify json-args
                  &apos;{`{"token_id":"${view.id}","digest":"${view.digest}"}`}&apos; network-config
                  testnet now
                </span>
              </Fact>
            ) : null}
          </dl>
          {!view.credential.reference.startsWith("ipfs://") ? (
            <p className="mt-3 text-[0.9rem] text-wait-ink">
              This document is served by ProofMe rather than pinned to IPFS, so it is checkable but
              only as durable as this site.
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="history" className="card p-5 sm:p-7">
        <h2 id="history" className="text-[1.2rem]">
          History
        </h2>
        {view.supersedes ? (
          <p className="mt-2">
            This record corrects{" "}
            <Link href={`/verify/${view.supersedes}`} className="text-link">
              an earlier record
            </Link>
            .
          </p>
        ) : null}
        {view.supersededBy ? (
          <p className="mt-2">
            It was replaced by{" "}
            <Link href={`/verify/${view.supersededBy}`} className="text-link">
              a corrected record
            </Link>
            .
          </p>
        ) : null}
        <ol className="mt-4 grid gap-3">
          {view.history.map((event, index) => (
            <li key={index} className="border-l-2 border-line pl-4 text-[0.95rem]">
              <p className="font-semibold">
                {MOMENT.format(event.at)} · {event.status}
              </p>
              {event.reason ? <p className="text-muted">{event.reason}</p> : null}
              {event.transactionHash && explorer ? (
                <a
                  href={`${explorer}/txns/${event.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link inline-flex items-center gap-1.5 text-[0.9rem]"
                >
                  Transaction <ExternalLink aria-hidden="true" size={14} />
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="limits" className="well p-5 sm:p-6">
        <h2 id="limits" className="text-[1.05rem]">
          What this does and does not prove
        </h2>
        <p className="mt-2 max-w-[68ch] text-muted">
          It proves that {view.issuer.name} approved this exact claim on {DAY.format(view.issuedAt)}{" "}
          and that the record has not been altered since. It does not prove that every detail is
          true, or that you should trust {view.issuer.name}
          {view.issuer.reviewedByProofMe
            ? "; ProofMe has reviewed the organisation, which is not the same as vouching for each claim."
            : "; ProofMe has not reviewed this organisation."}
        </p>
      </section>
    </article>
  );
}
