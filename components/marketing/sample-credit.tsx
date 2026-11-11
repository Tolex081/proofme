"use client";

import { Check, RotateCcw, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";

import { canonicalize, sha256Hex, type JsonValue } from "@/lib/attestations/canonical";
import {
  SAMPLE_ATTESTATION,
  SAMPLE_ATTESTATION_DIGEST,
  SAMPLE_SUBJECT_DISPLAY_NAME,
} from "@/lib/demo/sample-attestation";

type CheckState =
  | { state: "idle" }
  | { state: "working" }
  | { state: "done"; digest: string; run: number }
  | { state: "error" };

const ORIGINAL_ROLE = SAMPLE_ATTESTATION.claim.role;
const ISSUED = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
  new Date(SAMPLE_ATTESTATION.issuedAt),
);

/**
 * The landing page's working demonstration: a sample record whose digest the
 * visitor recomputes in their own browser. Changing the role changes the
 * record, so the recomputed digest stops matching the recorded one.
 *
 * The hashing is the same canonicalisation and SHA-256 the product uses for
 * real attestations. The record itself is fictional and says so.
 */
export function SampleCredit() {
  const roleId = useId();
  const [role, setRole] = useState(ORIGINAL_ROLE);
  const [check, setCheck] = useState<CheckState>({ state: "idle" });
  const [runs, setRuns] = useState(0);

  const edited = role.normalize("NFC").trim() !== ORIGINAL_ROLE;

  async function recompute() {
    setCheck({ state: "working" });
    try {
      const record = {
        ...SAMPLE_ATTESTATION,
        claim: { ...SAMPLE_ATTESTATION.claim, role: role.normalize("NFC").trim() },
      };
      const digest = await sha256Hex(canonicalize(record as JsonValue));
      const run = runs + 1;
      setRuns(run);
      setCheck({ state: "done", digest, run });
    } catch {
      setCheck({ state: "error" });
    }
  }

  function changeRole(value: string) {
    setRole(value);
    // A result describes the record it was computed from; once the record
    // changes, the old result is no longer shown as current.
    if (check.state !== "idle") setCheck({ state: "idle" });
  }

  function restore() {
    setRole(ORIGINAL_ROLE);
    setCheck({ state: "idle" });
  }

  const matches = check.state === "done" && check.digest === SAMPLE_ATTESTATION_DIGEST;

  return (
    <form
      className="card overflow-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        void recompute();
      }}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4 sm:px-8">
        <span aria-hidden="true" className="org-mark">
          N
        </span>
        <div className="min-w-[8.5rem] flex-1">
          <p className="font-semibold">Sample record</p>
          <p className="text-meta text-muted">Fictional, and not anchored on NEAR</p>
        </div>
        <span className="chip chip-ok">
          <Check aria-hidden="true" size={13} strokeWidth={3} /> Organisation approved
        </span>
      </div>

      <dl className="grid gap-x-8 gap-y-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
        <div className="sm:col-span-2">
          <dt className="text-label font-semibold text-faint">Contribution</dt>
          <dd className="mt-0.5 font-display text-subhead font-bold tracking-[-0.02em]">
            {SAMPLE_ATTESTATION.claim.title}
          </dd>
        </div>
        <div>
          <dt className="text-label font-semibold text-faint">Credited to</dt>
          <dd className="mt-0.5 font-semibold">{SAMPLE_SUBJECT_DISPLAY_NAME}</dd>
        </div>
        <div>
          <dt className="text-label font-semibold text-faint">Confirmed by</dt>
          <dd className="mt-0.5 font-semibold">{SAMPLE_ATTESTATION.issuer.name}</dd>
        </div>
        <div>
          <dt className="text-label font-semibold text-faint">
            <label htmlFor={roleId}>Role (you can edit this)</label>
          </dt>
          <dd className="mt-1">
            <input
              id={roleId}
              name="role"
              type="text"
              value={role}
              maxLength={120}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => changeRole(event.target.value)}
              className="field-input font-semibold"
            />
          </dd>
        </div>
        <div>
          <dt className="text-label font-semibold text-faint">Issued</dt>
          <dd className="mt-0.5 font-semibold">{ISSUED}</dd>
        </div>
      </dl>

      <div className="mx-6 grid gap-3 rounded-2xl bg-surface-2 p-4 sm:mx-8">
        <div>
          <p className="text-label font-semibold text-faint">Recorded digest</p>
          <p className="digest mt-0.5 text-muted">{SAMPLE_ATTESTATION_DIGEST}</p>
        </div>
        <div>
          <p className="text-label font-semibold text-faint">Computed by your browser</p>
          <p className="digest mt-0.5 min-h-[1.25rem]" aria-live="polite">
            {check.state === "done" ? (
              <span key={check.run} className="resolve inline-block">
                {check.digest}
              </span>
            ) : check.state === "working" ? (
              <span className="text-muted">Computing…</span>
            ) : (
              <span className="text-faint">Not computed yet</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-6 sm:px-8">
        <button
          type="submit"
          className="action action-primary"
          disabled={check.state === "working"}
        >
          Recompute the digest
        </button>
        {edited ? (
          <button type="button" onClick={restore} className="action action-secondary">
            <RotateCcw aria-hidden="true" size={15} strokeWidth={2.25} />
            Restore the original
          </button>
        ) : null}
        <div role="status" className="min-w-0 basis-full text-note">
          {check.state === "done" && matches ? (
            <p key={check.run} className="pop chip chip-ok whitespace-normal">
              <Check aria-hidden="true" size={15} strokeWidth={3} className="shrink-0" />
              Match. This is exactly the record that was approved.
            </p>
          ) : check.state === "done" ? (
            <p key={check.run} className="pop chip chip-bad whitespace-normal">
              <TriangleAlert aria-hidden="true" size={15} strokeWidth={2.5} className="shrink-0" />
              No match. This is not the record that was approved.
            </p>
          ) : check.state === "error" ? (
            <p className="chip chip-bad whitespace-normal">
              <TriangleAlert aria-hidden="true" size={15} strokeWidth={2.5} className="shrink-0" />
              Your browser could not compute the digest. Reload the page and try again.
            </p>
          ) : (
            <p className="text-muted">
              Change one word of the role, recompute, and watch the digest stop matching.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
