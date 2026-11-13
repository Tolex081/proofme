"use client";

import { Ban, Link2, RefreshCw, Stamp } from "lucide-react";
import { useId, useState } from "react";

import { FormMessage } from "@/components/forms/fields";
import { useHydrated } from "@/components/forms/use-hydrated";
import {
  confirmMintAction,
  correctAttestationAction,
  issuerChallengeAction,
  prepareMintAction,
  proveIssuerAction,
  prepareRevokeAction,
  refreshIssuerAction,
  revokeAction,
} from "@/server/actions/near";
import {
  callContract,
  connectWallet,
  requireAccount,
  signChallenge,
  walletErrorMessage,
} from "./wallet";

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
      // Proof of control: the wallet signs a one-time ProofMe challenge.
      const challenge = await issuerChallengeAction(organisationId, slug, chosen);
      if (!challenge.ok) {
        setNotice({ tone: "error", text: challenge.message });
        return;
      }
      const proof = await signChallenge(challenge.value);
      const result = await proveIssuerAction(organisationId, slug, proof);
      setNotice(
        result.ok
          ? {
              tone: "success",
              text: `Signed. ${chosen} is proven to be this organisation's NEAR account.`,
            }
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
        methodName: request.method,
        args:
          request.method === "supersede"
            ? {
                old_token_id: request.oldTokenId,
                token_id: request.tokenId,
                digest: request.digest,
                reference: request.reference,
              }
            : {
                token_id: request.tokenId,
                receiver_id: request.receiverId,
                digest: request.digest,
                reference: request.reference,
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

/**
 * Replace an active record with a corrected one. The old record is never
 * edited; the correction is linked to it and, once minted, the contract's
 * `supersede` marks the old token superseded in the same transaction.
 */
export function CorrectionControl({
  attestationId,
  slug,
  initial,
  onNear,
}: {
  attestationId: string;
  slug: string;
  initial: {
    title: string;
    summary: string;
    description: string;
    role: string;
    startDate: string;
    endDate: string;
  };
  onNear: boolean;
}) {
  const hydrated = useHydrated();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [values, setValues] = useState({ ...initial, reason: "" });

  function field(name: keyof typeof values, label: string, multiline = false) {
    const id = `${formId}-${name}`;
    const props = {
      id,
      value: values[name],
      onChange: (event: { target: { value: string } }) =>
        setValues((current) => ({ ...current, [name]: event.target.value })),
      className: "field-input",
    };
    return (
      <div className="grid gap-1.5">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {multiline ? <textarea rows={3} {...props} /> : <input {...props} />}
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    setNotice(null);
    const result = await correctAttestationAction(attestationId, slug, values);
    setNotice(
      result.ok
        ? {
            tone: "success",
            text: result.value.supersededNow
              ? "Corrected. The old record is now marked superseded. The contributor must agree to publish the correction before it can be issued."
              : "Corrected record created. The old NFT stays active until you issue the correction, which supersedes it on NEAR in the same transaction.",
          }
        : { tone: "error", text: result.message },
    );
    setBusy(false);
    if (result.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div className="grid gap-2">
        <div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!hydrated}
            className="action action-secondary"
          >
            Correct this record
          </button>
        </div>
        <NoticeLine notice={notice} />
      </div>
    );
  }
  return (
    <div className="grid w-full gap-3 rounded-2xl border border-line p-4">
      <p className="text-[0.92rem] text-muted">
        {onNear
          ? "The NFT already on NEAR is not changed. A corrected record is created; issuing it calls the contract's supersede, which marks the old token superseded and links the two."
          : "The old record is marked superseded straight away and linked to the corrected one."}
      </p>
      {field("title", "Title")}
      {field("summary", "One-line summary")}
      {field("description", "What they did", true)}
      {field("role", "Their role")}
      <div className="grid gap-3 sm:grid-cols-2">
        {field("startDate", "Started (YYYY-MM-DD)")}
        {field("endDate", "Finished (YYYY-MM-DD)")}
      </div>
      {field("reason", "What is being corrected (shown in the public history)", true)}
      <NoticeLine notice={notice} />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!hydrated || busy}
          className="action action-primary"
        >
          {busy ? "Saving…" : "Create corrected record"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="action action-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
