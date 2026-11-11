"use client";

import { Ban, Link2, RefreshCw, Stamp } from "lucide-react";
import { useId, useState } from "react";

import { FormMessage } from "@/components/forms/fields";
import { useHydrated } from "@/components/forms/use-hydrated";
import {
  confirmMintAction,
  linkIssuerAction,
  prepareMintAction,
  prepareRevokeAction,
  refreshIssuerAction,
  revokeAction,
} from "@/server/actions/near";
import { callContract, connectWallet, requireAccount, walletErrorMessage } from "./wallet";

/** Covers storage for one token; the contract refunds what it does not use. */
const MINT_DEPOSIT = "20000000000000000000000"; // 0.02 NEAR
const ONE_YOCTO = "1";

type Notice = { tone: "error" | "success"; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  return notice ? <FormMessage tone={notice.tone}>{notice.text}</FormMessage> : null;
}

const STATUS_COPY = {
  none: {
    chip: "chip-neutral",
    label: "No NEAR account",
    meaning: "Connect the NEAR account that will issue attestations for this organisation.",
  },
  linked: {
    chip: "chip-wait",
    label: "Waiting for registration",
    meaning:
      "The account is chosen, but the contract does not list it as an issuer yet. ProofMe registers issuers; send them the two values below.",
  },
  registered: {
    chip: "chip-ok",
    label: "Registered issuer",
    meaning: "The contract lists this account as this organisation's issuer. It can mint.",
  },
  suspended: {
    chip: "chip-bad",
    label: "Suspended",
    meaning: "The contract lists this account as suspended. It cannot mint until reinstated.",
  },
} as const;

export function IssuerPanel({
  organisationId,
  slug,
  accountId,
  status,
  canConfigure,
  contractId,
}: {
  organisationId: string;
  slug: string;
  accountId: string | null;
  status: keyof typeof STATUS_COPY;
  canConfigure: boolean;
  contractId: string | null;
}) {
  const hydrated = useHydrated();
  const [busy, setBusy] = useState<"connect" | "check" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const copy = STATUS_COPY[status];

  async function connect() {
    setBusy("connect");
    setNotice(null);
    try {
      const chosen = await connectWallet();
      const result = await linkIssuerAction(organisationId, slug, chosen);
      setNotice(
        result.ok
          ? { tone: "success", text: `${chosen} is now this organisation's NEAR account.` }
          : { tone: "error", text: result.message },
      );
    } catch (error) {
      setNotice({ tone: "error", text: walletErrorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    setBusy("check");
    setNotice(null);
    const result = await refreshIssuerAction(organisationId, slug);
    setNotice(
      result.ok
        ? {
            tone: result.value.status === "registered" ? "success" : "error",
            text:
              result.value.status === "registered"
                ? "The contract confirms this account as a registered issuer."
                : "The contract does not list this account as an active issuer yet.",
          }
        : { tone: "error", text: result.message },
    );
    setBusy(null);
  }

  return (
    <section aria-labelledby="issuer-heading" className="card mb-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="issuer-heading" className="text-[1.2rem]">
          NEAR issuer account
        </h2>
        <span className={`chip ${copy.chip}`}>{copy.label}</span>
      </div>
      <p className="mt-2 max-w-[68ch] text-muted">{copy.meaning}</p>

      {contractId === null ? (
        <p className="mt-4 rounded-2xl bg-wait p-4 text-wait-ink">
          NEAR is not set up on this site yet, so nothing can be minted. Approved records stay
          &ldquo;awaiting NEAR&rdquo; until it is.
        </p>
      ) : null}

      {accountId ? (
        <dl className="mt-4 grid gap-3 text-[0.92rem] sm:grid-cols-2">
          <div>
            <dt className="text-muted">NEAR account</dt>
            <dd className="digest">{accountId}</dd>
          </div>
          <div>
            <dt className="text-muted">Organisation ID</dt>
            <dd className="digest">{organisationId}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-4 grid gap-3">
        <NoticeLine notice={notice} />
        <div className="flex flex-wrap gap-3">
          {canConfigure ? (
            <button
              type="button"
              onClick={connect}
              disabled={!hydrated || busy !== null}
              className={`action ${accountId ? "action-secondary" : "action-primary"}`}
            >
              <Link2 aria-hidden="true" size={17} />
              {busy === "connect"
                ? "Waiting for the wallet…"
                : accountId
                  ? "Use a different account"
                  : "Connect NEAR wallet"}
            </button>
          ) : null}
          {accountId && contractId !== null ? (
            <button
              type="button"
              onClick={check}
              disabled={!hydrated || busy !== null}
              className="action action-secondary"
            >
              <RefreshCw aria-hidden="true" size={16} />
              {busy === "check" ? "Asking the contract…" : "Check registration"}
            </button>
          ) : null}
        </div>
        {!canConfigure && !accountId ? (
          <p className="text-[0.92rem] text-muted">Only an owner can choose the account.</p>
        ) : null}
      </div>
    </section>
  );
}

export function MintButton({ attestationId, slug }: { attestationId: string; slug: string }) {
  const hydrated = useHydrated();
  const [step, setStep] = useState<"idle" | "wallet" | "confirming">("idle");
  const [notice, setNotice] = useState<Notice>(null);

  async function mint() {
    setNotice(null);
    setStep("wallet");
    try {
      const prepared = await prepareMintAction(attestationId, slug);
      if (!prepared.ok) {
        setNotice({ tone: "error", text: prepared.message });
        return;
      }
      const request = prepared.value;
      await requireAccount(request.issuerAccountId);
      const transactionHash = await callContract({
        signerId: request.issuerAccountId,
        contractId: request.contractId,
        methodName: "issue",
        args: {
          token_id: request.tokenId,
          receiver_id: request.receiverId,
          digest: request.digest,
        },
        deposit: MINT_DEPOSIT,
      });
      setStep("confirming");
      const confirmed = await confirmMintAction(attestationId, slug, transactionHash);
      setNotice(
        confirmed.ok
          ? { tone: "success", text: `Minted to ${confirmed.value.ownerId}.` }
          : { tone: "error", text: confirmed.message },
      );
    } catch (error) {
      setNotice({ tone: "error", text: walletErrorMessage(error) });
    } finally {
      setStep("idle");
    }
  }

  return (
    <div className="grid gap-2">
      <div>
        <button
          type="button"
          onClick={mint}
          disabled={!hydrated || step !== "idle"}
          className="action action-primary"
        >
          <Stamp aria-hidden="true" size={17} />
          {step === "wallet"
            ? "Waiting for the wallet…"
            : step === "confirming"
              ? "Checking NEAR…"
              : "Issue on NEAR"}
        </button>
      </div>
      <NoticeLine notice={notice} />
    </div>
  );
}

export function RevokeControl({
  attestationId,
  slug,
  issuerAccountId,
}: {
  attestationId: string;
  slug: string;
  /** The account that minted it, when it is on NEAR. */
  issuerAccountId: string | null;
}) {
  const hydrated = useHydrated();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"idle" | "wallet" | "saving">("idle");
  const [notice, setNotice] = useState<Notice>(null);

  async function revoke(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setStep("saving");
    try {
      const prepared = await prepareRevokeAction(attestationId, slug, reason);
      if (!prepared.ok) {
        setNotice({ tone: "error", text: prepared.message });
        return;
      }
      let transactionHash: string | null = null;
      if (prepared.value.onChain) {
        if (!issuerAccountId) {
          setNotice({ tone: "error", text: "The issuing NEAR account is not recorded." });
          return;
        }
        setStep("wallet");
        await requireAccount(issuerAccountId);
        transactionHash = await callContract({
          signerId: issuerAccountId,
          contractId: prepared.value.contractId,
          methodName: "revoke",
          args: { token_id: prepared.value.tokenId },
          deposit: ONE_YOCTO,
        });
        setStep("saving");
      }
      const result = await revokeAction(attestationId, slug, reason, transactionHash);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.message });
        return;
      }
      setOpen(false);
    } catch (error) {
      setNotice({ tone: "error", text: walletErrorMessage(error) });
    } finally {
      setStep("idle");
    }
  }

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className="action action-secondary">
          <Ban aria-hidden="true" size={16} /> Revoke
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={revoke} method="post" className="well grid gap-3 p-4">
      <div className="field">
        <label htmlFor={id} className="field-label">
          Why is it being revoked?
        </label>
        <textarea
          id={id}
          name="reason"
          rows={3}
          maxLength={500}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="field-input"
        />
        <p className="field-hint">
          The contributor sees this. It is kept on ProofMe, not written to NEAR. Revoking cannot be
          undone.
        </p>
      </div>
      <NoticeLine notice={notice} />
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={!hydrated || step !== "idle"}
          className="action border-[1.5px] border-bad-ink bg-bad text-bad-ink hover:bg-bad-ink hover:text-surface"
        >
          {step === "wallet"
            ? "Waiting for the wallet…"
            : step === "saving"
              ? "Revoking…"
              : "Revoke for good"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="action action-secondary">
          Keep it
        </button>
      </div>
    </form>
  );
}
