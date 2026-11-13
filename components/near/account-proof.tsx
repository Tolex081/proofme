"use client";

import { BadgeCheck, PenLine, Upload, Wallet } from "lucide-react";
import { useState } from "react";

import { FormMessage } from "@/components/forms/fields";
import { useHydrated } from "@/components/forms/use-hydrated";
import {
  consentToPublishAction,
  contributorChallengeAction,
  proveContributorAction,
  removeContributorAccountAction,
} from "@/server/actions/near";
import { proveAccountWithWallet, walletErrorMessage } from "./wallet";
import { Spinner } from "@/components/ui/busy";

type Notice = { tone: "error" | "success"; text: string } | null;

/** Connect a wallet and sign a one-time challenge to prove the account is yours. */
export function NearAccountProof({
  accountId,
  verified,
}: {
  accountId: string | null;
  verified: boolean;
}) {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function prove() {
    setBusy(true);
    setNotice(null);
    try {
      const signed = await proveAccountWithWallet(contributorChallengeAction);
      if (!signed.ok) {
        setNotice({ tone: "error", text: signed.message });
        return;
      }
      const result = await proveContributorAction(signed.proof);
      setNotice(
        result.ok
          ? { tone: "success", text: `Signed. ${result.value.accountId} is proven to be yours.` }
          : { tone: "error", text: result.message },
      );
    } catch (error) {
      setNotice({ tone: "error", text: walletErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    const result = await removeContributorAccountAction();
    setNotice(
      result.ok
        ? { tone: "success", text: "Removed. Credentials already issued stay where they are." }
        : { tone: "error", text: result.message },
    );
    setBusy(false);
  }

  return (
    <div className="grid gap-4">
      {accountId && verified ? (
        <p className="flex flex-wrap items-center gap-2">
          <BadgeCheck aria-hidden="true" size={18} className="text-ok-ink" />
          <span className="digest">{accountId}</span>
          <span className="chip chip-ok">Proven by wallet signature</span>
        </p>
      ) : accountId ? (
        <p className="text-wait-ink">
          {accountId} was added before wallet proof existed. Sign to prove it, or credentials cannot
          be issued to it.
        </p>
      ) : (
        <p className="text-muted">No NEAR account yet.</p>
      )}
      {notice ? <FormMessage tone={notice.tone}>{notice.text}</FormMessage> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={prove}
          disabled={!hydrated || busy}
          className="action action-primary"
        >
          {busy ? <Spinner /> : <Wallet aria-hidden="true" size={17} />}
          {busy
            ? "Waiting for the wallet…"
            : accountId
              ? "Prove a different account"
              : "Connect wallet and sign"}
        </button>
        {accountId ? (
          <button
            type="button"
            onClick={remove}
            disabled={!hydrated || busy}
            className="action action-secondary"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The contributor agrees to publish an approved record as a public NFT
 * credential. This pins the public document and lets the organisation mint it.
 */
export function PublishConsent({
  attestationId,
  contributionId,
  published,
}: {
  attestationId: string;
  contributionId: string;
  published: string | null;
}) {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function agree() {
    setBusy(true);
    setNotice(null);
    const result = await consentToPublishAction(attestationId, contributionId);
    setNotice(
      result.ok
        ? {
            tone: "success",
            text: result.value.durable
              ? `Published to IPFS at ${result.value.reference}. The organisation can now issue it on NEAR.`
              : "Published on ProofMe. The organisation can now issue it on NEAR.",
          }
        : { tone: "error", text: result.message },
    );
    setBusy(false);
  }

  if (published) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-[0.92rem]">
        <Upload aria-hidden="true" size={16} className="text-ok-ink" />
        Published as a public credential: <span className="digest break-all">{published}</span>
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="max-w-[62ch] text-[0.92rem] text-muted">
        Publishing makes the approved claim and its public evidence a permanent public document,
        referenced from an NFT in your NEAR account. Your username, email, private evidence and the
        reviewer&rsquo;s notes are never included. Once published it cannot be unpublished; the
        organisation can still revoke it.
      </p>
      {notice ? <FormMessage tone={notice.tone}>{notice.text}</FormMessage> : null}
      <div>
        <button
          type="button"
          onClick={agree}
          disabled={!hydrated || busy}
          className="action action-primary"
        >
          {busy ? <Spinner /> : <PenLine aria-hidden="true" size={17} />}
          {busy ? "Publishing…" : "I agree: publish as a credential"}
        </button>
      </div>
    </div>
  );
}
