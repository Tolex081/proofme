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
 * The landing page's working demonstration: a sample credit whose digest the
 * visitor recomputes in their own browser. Changing the role changes the
 * record, so the recomputed digest stops matching the recorded one.
 *
 * The hashing here is the same canonicalisation and SHA-256 the product uses
 * for real attestations. The record itself is fictional and says so.
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
      onSubmit={(event) => {
        event.preventDefault();
        void recompute();
      }}
    >
      <dl className="credits settle gap-y-[clamp(0.7rem,1.6vh,1.15rem)]">
        <dt className="role">Contribution</dt>
        <dd className="name text-[clamp(1.5rem,2.7vw,2.3rem)]">{SAMPLE_ATTESTATION.claim.title}</dd>

        <dt className="role">Credited to</dt>
        <dd className="name text-[clamp(1.2rem,1.9vw,1.6rem)]">{SAMPLE_SUBJECT_DISPLAY_NAME}</dd>

        <dt className="role">
          <label htmlFor={roleId}>Role</label>
        </dt>
        <dd>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <input
              id={roleId}
              name="role"
              type="text"
              value={role}
              maxLength={120}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => changeRole(event.target.value)}
              aria-describedby={`${roleId}-hint`}
              className="name w-full max-w-[22rem] border-b border-dashed border-on-ink-muted bg-transparent pb-0.5 text-[clamp(1.2rem,1.9vw,1.6rem)] text-on-ink transition-colors outline-none hover:border-teal-bright focus-visible:border-solid focus-visible:border-teal-bright"
            />
            {edited ? (
              <button
                type="button"
                onClick={restore}
                className="text-link inline-flex min-h-11 items-center gap-1.5 text-[0.9rem]"
              >
                <RotateCcw aria-hidden="true" size={15} strokeWidth={2} />
                Restore the original
              </button>
            ) : null}
          </div>
          <p id={`${roleId}-hint`} className="mt-1.5 text-[0.88rem] text-on-ink-muted">
            You can edit this. Change a word, then recompute.
          </p>
        </dd>

        <dt className="role">Confirmed by</dt>
        <dd className="name text-[clamp(1.2rem,1.9vw,1.6rem)]">{SAMPLE_ATTESTATION.issuer.name}</dd>

        <dt className="role">Issued</dt>
        <dd className="name text-[clamp(1.2rem,1.9vw,1.6rem)]">{ISSUED}</dd>
      </dl>

      <hr className="rule my-[clamp(1.25rem,2.4vh,1.6rem)]" />

      <dl className="credits gap-y-[clamp(0.7rem,1.6vh,1.15rem)]">
        <dt className="role">Recorded digest</dt>
        <dd className="digest text-on-ink-muted">{SAMPLE_ATTESTATION_DIGEST}</dd>

        <dt className="role">Your browser&rsquo;s</dt>
        <dd className="digest min-h-[2.5rem]" aria-live="polite">
          {check.state === "done" ? (
            <span key={check.run} className="resolve inline-block">
              {check.digest}
            </span>
          ) : check.state === "working" ? (
            <span className="text-on-ink-muted">Computing&hellip;</span>
          ) : (
            <span className="text-on-ink-muted">Not computed yet.</span>
          )}
        </dd>
      </dl>

      <div className="credits mt-[clamp(0.9rem,2vh,1.4rem)]">
        <div className="from-axis flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            type="submit"
            className="action action-primary"
            disabled={check.state === "working"}
          >
            Recompute the digest
          </button>

          <p role="status" className="min-w-0 flex-1 basis-64 text-[0.95rem] leading-snug">
            {check.state === "done" && matches ? (
              <span className="inline-flex items-start gap-2 text-ok-bright">
                <Check
                  aria-hidden="true"
                  size={19}
                  strokeWidth={2.25}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  <strong className="font-semibold">Match.</strong> This is exactly the record that
                  was approved.
                </span>
              </span>
            ) : check.state === "done" ? (
              <span className="inline-flex items-start gap-2 text-bad-bright">
                <TriangleAlert
                  aria-hidden="true"
                  size={19}
                  strokeWidth={2.25}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  <strong className="font-semibold">No match.</strong> This is not the record that
                  was approved. One changed word is enough.
                </span>
              </span>
            ) : check.state === "error" ? (
              <span className="inline-flex items-start gap-2 text-bad-bright">
                <TriangleAlert
                  aria-hidden="true"
                  size={19}
                  strokeWidth={2.25}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  Your browser could not compute the digest. Reload the page and try again.
                </span>
              </span>
            ) : (
              <span className="text-on-ink-muted">
                The digest is a fingerprint of the whole record, computed here in your browser.
              </span>
            )}
          </p>
        </div>
      </div>
    </form>
  );
}
