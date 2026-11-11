"use client";

import { useId, useState } from "react";

import { FieldError, FormMessage } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { useHydrated } from "@/components/forms/use-hydrated";
import type { FormState } from "@/server/actions/account";
import {
  decideOrganisationAction,
  resolveReportAction,
  setUserSuspendedAction,
} from "@/server/actions/admin";

function Feedback({ state }: { state: FormState }) {
  if (state.status === "error" && state.message)
    return <FormMessage tone="error">{state.message}</FormMessage>;
  if (state.status === "success" && state.message)
    return <FormMessage tone="success">{state.message}</FormMessage>;
  return null;
}

const DECISION_TEXT: Record<string, { label: string; body: string }> = {
  approve: {
    label: "Approve",
    body: "You checked who runs it. Its pages show “Reviewed by ProofMe”.",
  },
  request_information: {
    label: "Ask for more",
    body: "Something is missing. The owners see your reason and can ask again.",
  },
  reject: { label: "Decline", body: "ProofMe will not mark it as reviewed. Say why." },
  suspend: {
    label: "Suspend",
    body: "Hides it from explore and marks its pages as suspended. Attestations already issued stay as they are.",
  },
  reinstate: { label: "Reinstate", body: "Lifts the suspension. It returns as not reviewed." },
};

export function OrganisationDecisionForm({
  organisationId,
  allowed,
}: {
  organisationId: string;
  allowed: string[];
}) {
  const { state, pending, onSubmit } = useFormAction(
    decideOrganisationAction.bind(null, organisationId),
  );
  const [decision, setDecision] = useState(allowed[0]);
  const hydrated = useHydrated();
  const id = useId();
  const needsReason = decision !== "approve";

  return (
    <form onSubmit={onSubmit} method="post" className="grid gap-5">
      <Feedback state={state} />
      <fieldset className="field">
        <legend className="field-label">Decision</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {allowed.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer flex-col gap-1.5 rounded-2xl border-[1.5px] border-line-strong bg-surface p-4 transition-colors hover:border-ink has-[:checked]:border-brand has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link"
            >
              <span className="flex items-center justify-between gap-3 font-semibold">
                {DECISION_TEXT[value].label}
                <input
                  type="radio"
                  name="decision"
                  value={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                  className="size-4"
                />
              </span>
              <span className="text-[0.88rem] text-muted">{DECISION_TEXT[value].body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={id} className="field-label">
          Reason{needsReason ? null : <span className="field-optional"> (optional)</span>}
        </label>
        <textarea
          id={id}
          name="reason"
          rows={3}
          maxLength={1000}
          className="field-input"
          aria-invalid={state.errors?.reason ? true : undefined}
          aria-describedby={state.errors?.reason ? `${id}-error` : `${id}-hint`}
        />
        <p id={`${id}-hint`} className="field-hint">
          The organisation&rsquo;s owners and admins see this. It is also kept in the audit log.
        </p>
        <FieldError id={`${id}-error`} message={state.errors?.reason} />
      </div>
      <div>
        <button type="submit" className="action action-primary" disabled={pending || !hydrated}>
          {pending ? "Saving…" : "Record decision"}
        </button>
      </div>
    </form>
  );
}

export function SuspendUserForm({
  userId,
  name,
  suspend,
}: {
  userId: string;
  name: string;
  suspend: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction(
    setUserSuspendedAction.bind(null, userId, suspend),
  );
  const hydrated = useHydrated();
  const id = useId();
  if (state.status === "success") return <Feedback state={state} />;
  return (
    <form onSubmit={onSubmit} method="post" className="grid gap-3">
      <Feedback state={state} />
      <div className="field">
        <label htmlFor={id} className="field-label">
          Reason for {suspend ? "suspending" : "reinstating"} {name}
        </label>
        <input
          id={id}
          name="reason"
          maxLength={1000}
          className="field-input"
          aria-invalid={state.errors?.reason ? true : undefined}
          aria-describedby={state.errors?.reason ? `${id}-error` : undefined}
        />
        <FieldError id={`${id}-error`} message={state.errors?.reason} />
      </div>
      <div>
        <button
          type="submit"
          className={
            suspend
              ? "action border-[1.5px] border-bad-ink bg-bad text-bad-ink hover:bg-bad-ink hover:text-surface"
              : "action action-secondary"
          }
          disabled={pending || !hydrated}
        >
          {pending ? "Saving…" : suspend ? "Suspend account" : "Reinstate account"}
        </button>
      </div>
    </form>
  );
}

export function ResolveReportForm({ reportId }: { reportId: string }) {
  const { state, pending, onSubmit } = useFormAction(resolveReportAction.bind(null, reportId));
  const hydrated = useHydrated();
  const id = useId();
  if (state.status === "success") return <Feedback state={state} />;
  return (
    <form onSubmit={onSubmit} method="post" className="grid gap-3">
      <Feedback state={state} />
      <div className="field">
        <label htmlFor={id} className="field-label">
          What you did <span className="field-optional">(optional)</span>
        </label>
        <input id={id} name="note" maxLength={1000} className="field-input" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="outcome"
          value="reviewed"
          className="action action-primary"
          disabled={pending || !hydrated}
        >
          Mark as handled
        </button>
        <button
          type="submit"
          name="outcome"
          value="dismissed"
          className="action action-secondary"
          disabled={pending || !hydrated}
        >
          Dismiss
        </button>
      </div>
    </form>
  );
}
