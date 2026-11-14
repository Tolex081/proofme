"use client";

import { Flag } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { FieldError, FormMessage } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { useHydrated } from "@/components/forms/use-hydrated";
import { createReportAction } from "@/server/actions/admin";

const REASONS = [
  { value: "impersonation", label: "Pretends to be someone else" },
  { value: "false_claim", label: "Claims work that is not theirs" },
  { value: "abusive", label: "Abusive or offensive" },
  { value: "spam", label: "Spam" },
  { value: "privacy", label: "Shares private information" },
  { value: "other", label: "Something else" },
] as const;

/**
 * "Report this" for public profiles and organisation pages. Signed-out
 * visitors get a sign-in link instead of the form.
 */
export function ReportForm({
  targetType,
  targetId,
  returnTo,
  noun,
  signedIn,
}: {
  targetType: "profile" | "organisation" | "attestation";
  targetId: string;
  returnTo: string;
  noun: string;
  signedIn: boolean;
}) {
  return (
    <details className="group px-2 text-note">
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-muted hover:text-ink">
        <Flag aria-hidden="true" size={15} />
        Report this {noun}
      </summary>
      <div className="card mt-2 p-5 sm:p-6">
        {signedIn ? (
          <Form targetType={targetType} targetId={targetId} returnTo={returnTo} />
        ) : (
          <p>
            <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="text-link">
              Sign in
            </Link>{" "}
            to send a report. Reports go to Atesta administrators, never to the person or
            organisation reported.
          </p>
        )}
      </div>
    </details>
  );
}

function Form({
  targetType,
  targetId,
  returnTo,
}: {
  targetType: "profile" | "organisation" | "attestation";
  targetId: string;
  returnTo: string;
}) {
  const { state, pending, onSubmit } = useFormAction(
    createReportAction.bind(null, { type: targetType, id: targetId, returnTo }),
  );
  const hydrated = useHydrated();
  const id = useId();

  if (state.status === "success") {
    return <FormMessage tone="success">{state.message}</FormMessage>;
  }

  return (
    <form onSubmit={onSubmit} method="post" className="grid gap-4">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}-reason`} className="field-label">
          What is wrong?
        </label>
        <select
          id={`${id}-reason`}
          name="reason"
          className="field-input"
          defaultValue=""
          aria-invalid={state.errors?.reason ? true : undefined}
          aria-describedby={state.errors?.reason ? `${id}-reason-error` : undefined}
        >
          <option value="" disabled>
            Choose one
          </option>
          {REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
        <FieldError id={`${id}-reason-error`} message={state.errors?.reason} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-details`} className="field-label">
          Details <span className="field-optional">(optional)</span>
        </label>
        <textarea
          id={`${id}-details`}
          name="details"
          rows={3}
          maxLength={1000}
          className="field-input"
          aria-describedby={`${id}-details-hint`}
        />
        <p id={`${id}-details-hint`} className="field-hint">
          Links or context help. Only Atesta administrators read this.
        </p>
      </div>
      <div>
        <button type="submit" className="action action-secondary" disabled={pending || !hydrated}>
          {pending ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
