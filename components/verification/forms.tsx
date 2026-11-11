"use client";

import { Check, CircleHelp, Send, X } from "lucide-react";
import { useActionState, useId, useState } from "react";

import { FieldError, FormMessage } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { useHydrated } from "@/components/forms/use-hydrated";
import type { FormState } from "@/server/actions/account";
import {
  decideAction,
  respondAction,
  reviseAction,
  submitForReviewAction,
  withdrawAction,
} from "@/server/actions/verification";

const IDLE: FormState = { status: "idle" };

function Feedback({ state }: { state: FormState }) {
  if (state.status === "error" && state.message)
    return <FormMessage tone="error">{state.message}</FormMessage>;
  if (state.status === "success" && state.message)
    return <FormMessage tone="success">{state.message}</FormMessage>;
  return null;
}

export interface SubmissionTarget {
  id: string;
  name: string;
  reviewed: boolean;
  projects: { id: string; name: string }[];
}

export function SubmitForReviewForm({
  contributionId,
  targets,
}: {
  contributionId: string;
  targets: SubmissionTarget[];
}) {
  const { state, pending, onSubmit } = useFormAction(
    submitForReviewAction.bind(null, contributionId),
  );
  const hydrated = useHydrated();
  const id = useId();
  if (targets.length === 0) {
    return <p className="text-muted">No organisations are on ProofMe yet to send this to.</p>;
  }
  return (
    <form onSubmit={onSubmit} method="post" className="grid gap-4">
      <Feedback state={state} />
      <div className="field">
        <label htmlFor={id} className="field-label">
          Who should confirm it?
        </label>
        <select id={id} name="target" className="field-input" defaultValue={targets[0].id}>
          {targets.map((target) => (
            <optgroup
              key={target.id}
              label={`${target.name}${target.reviewed ? "" : " (not reviewed by ProofMe)"}`}
            >
              <option value={target.id}>{target.name}, no specific project</option>
              {target.projects.map((project) => (
                <option key={project.id} value={`${target.id}:${project.id}`}>
                  {target.name}, {project.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="field-hint">
          Only that organisation&rsquo;s reviewers will see it. You can withdraw it until they
          decide.
        </p>
        <FieldError id={`${id}-error`} message={state.errors?.organisation} />
      </div>
      <div>
        <button type="submit" className="action action-primary" disabled={pending || !hydrated}>
          <Send aria-hidden="true" size={16} />
          {pending ? "Sending…" : "Send for review"}
        </button>
      </div>
    </form>
  );
}

export function WithdrawButton({ contributionId }: { contributionId: string }) {
  const [state, action, pending] = useActionState(withdrawAction.bind(null, contributionId), IDLE);
  const hydrated = useHydrated();
  return (
    <form action={action} className="grid gap-3">
      <Feedback state={state} />
      <div>
        <button type="submit" className="action action-secondary" disabled={pending || !hydrated}>
          {pending ? "Withdrawing…" : "Withdraw from review"}
        </button>
      </div>
    </form>
  );
}

export function RespondForm({ contributionId }: { contributionId: string }) {
  const { state, pending, onSubmit } = useFormAction(respondAction.bind(null, contributionId));
  const hydrated = useHydrated();
  const id = useId();
  return (
    <form onSubmit={onSubmit} method="post" className="grid gap-3">
      <Feedback state={state} />
      <div className="field">
        <label htmlFor={id} className="field-label">
          Your answer
        </label>
        <textarea
          id={id}
          name="message"
          rows={4}
          maxLength={2000}
          className="field-input"
          aria-invalid={state.errors?.message ? true : undefined}
          aria-describedby={state.errors?.message ? `${id}-error` : `${id}-hint`}
        />
        <p id={`${id}-hint`} className="field-hint">
          You can also edit the claim or add evidence before answering.
        </p>
        <FieldError id={`${id}-error`} message={state.errors?.message} />
      </div>
      <div>
        <button type="submit" className="action action-primary" disabled={pending || !hydrated}>
          {pending ? "Sending…" : "Send answer"}
        </button>
      </div>
    </form>
  );
}

export function ReviseButton({ contributionId }: { contributionId: string }) {
  const [state, action, pending] = useActionState(reviseAction.bind(null, contributionId), IDLE);
  const hydrated = useHydrated();
  return (
    <form action={action} className="grid gap-3">
      <Feedback state={state} />
      <div>
        <button type="submit" className="action action-primary" disabled={pending || !hydrated}>
          {pending ? "Opening…" : "Rework and send again"}
        </button>
      </div>
    </form>
  );
}

const DECISIONS = [
  {
    value: "approve",
    label: "Approve",
    icon: Check,
    body: "You stand behind this claim as written. It is frozen and recorded for NEAR anchoring.",
  },
  {
    value: "request_information",
    label: "Ask for more",
    icon: CircleHelp,
    body: "Something is missing or unclear. The contributor can answer and edit.",
  },
  {
    value: "reject",
    label: "Do not approve",
    icon: X,
    body: "The organisation will not confirm this claim. Say why.",
  },
] as const;

export function DecisionForm({
  requestId,
  organisationSlug,
  version,
}: {
  requestId: string;
  organisationSlug: string;
  version: number;
}) {
  const { state, pending, onSubmit } = useFormAction(
    decideAction.bind(null, requestId, organisationSlug),
  );
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]["value"]>("approve");
  const hydrated = useHydrated();
  const id = useId();
  const needsMessage = decision !== "approve";

  if (state.status === "success") return <Feedback state={state} />;

  return (
    <form onSubmit={onSubmit} method="post" className="grid gap-5">
      <Feedback state={state} />
      <input type="hidden" name="expectedVersion" value={version} />
      <fieldset className="field">
        <legend className="field-label">Your decision</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {DECISIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer flex-col gap-1.5 rounded-2xl border-[1.5px] border-line-strong bg-surface p-4 transition-colors hover:border-ink has-[:checked]:border-brand has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link"
            >
              <span className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <option.icon aria-hidden="true" size={17} strokeWidth={2.5} />
                  {option.label}
                </span>
                <input
                  type="radio"
                  name="decision"
                  value={option.value}
                  checked={decision === option.value}
                  onChange={() => setDecision(option.value)}
                  className="size-4"
                />
              </span>
              <span className="text-[0.88rem] text-muted">{option.body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${id}-message`} className="field-label">
          Message to the contributor
          {needsMessage ? null : <span className="field-optional"> (optional)</span>}
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={3}
          maxLength={2000}
          className="field-input"
          aria-invalid={state.errors?.message ? true : undefined}
          aria-describedby={state.errors?.message ? `${id}-message-error` : undefined}
        />
        <FieldError id={`${id}-message-error`} message={state.errors?.message} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-note`} className="field-label">
          Internal note <span className="field-optional">(optional)</span>
        </label>
        <textarea
          id={`${id}-note`}
          name="internalNote"
          rows={2}
          maxLength={2000}
          className="field-input"
          aria-describedby={`${id}-note-hint`}
        />
        <p id={`${id}-note-hint`} className="field-hint">
          Seen only by this organisation&rsquo;s team. Never shown to the contributor or the public.
        </p>
      </div>
      <div>
        <button type="submit" className="action action-primary" disabled={pending || !hydrated}>
          {pending ? "Saving…" : "Record decision"}
        </button>
      </div>
    </form>
  );
}
