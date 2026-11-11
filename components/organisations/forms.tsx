"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { FieldError, FormMessage, TextField } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { useHydrated } from "@/components/forms/use-hydrated";
import {
  ORGANISATION_CATEGORIES,
  ORGANISATION_CATEGORY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  slugify,
} from "@/lib/validation/organisation";
import type { FormState } from "@/server/actions/account";
import {
  changeMemberAction,
  inviteAction,
  requestReviewAction,
  respondToInvitationAction,
  transferOwnershipAction,
  type InviteState,
} from "@/server/actions/organisations";

type Action = (previous: FormState, form: FormData) => Promise<FormState>;

function Submit({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  const hydrated = useHydrated();
  const disabled = pending || !hydrated;
  return (
    <button
      type="submit"
      className="action action-primary"
      disabled={disabled}
      aria-disabled={disabled}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Feedback({ state }: { state: FormState }) {
  if (state.status === "error" && state.message)
    return <FormMessage tone="error">{state.message}</FormMessage>;
  if (state.status === "success" && state.message)
    return <FormMessage tone="success">{state.message}</FormMessage>;
  return null;
}

function Select({
  name,
  label,
  value,
  options,
  error,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="field-input"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export interface OrganisationValues {
  name: string;
  slug: string;
  category: string;
  description: string | null;
  websiteUrl: string | null;
}

export function OrganisationForm({
  initial,
  action,
  submitLabel,
  cancelHref,
  isNew,
}: {
  initial: OrganisationValues;
  action: Action;
  submitLabel: string;
  cancelHref: string;
  isNew: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction(action);
  const errors = state.errors ?? {};
  // On a new organisation the address follows the name until edited by hand.
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  return (
    <form onSubmit={onSubmit} method="post" className="form-stack gap-6" noValidate>
      <Feedback state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="field">
          <TextField
            name="name"
            label="Organisation name"
            required
            maxLength={120}
            defaultValue={initial.name}
            error={errors.name}
          />
        </div>
        <div className="field">
          <label htmlFor="org-slug" className="field-label">
            Address
          </label>
          <div className="field-prefixed">
            <span aria-hidden="true">proofme/org/</span>
            <input
              id="org-slug"
              name="slug"
              value={slug}
              maxLength={60}
              spellCheck={false}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugTouched(true);
              }}
              aria-invalid={errors.slug ? true : undefined}
              aria-describedby={errors.slug ? "org-slug-error" : "org-slug-hint"}
              className="field-input"
            />
          </div>
          <p id="org-slug-hint" className="field-hint">
            Lowercase letters, numbers and hyphens.
          </p>
          <FieldError id="org-slug-error" message={errors.slug} />
        </div>
      </div>
      {!slugTouched ? <SlugFollower onName={(name) => setSlug(slugify(name))} /> : null}
      <Select
        name="category"
        label="What kind of organisation is it?"
        value={initial.category}
        error={errors.category}
        options={ORGANISATION_CATEGORIES.map((value) => ({
          value,
          label: ORGANISATION_CATEGORY_LABELS[value],
        }))}
      />
      <TextField
        name="description"
        label="About the organisation"
        multiline
        maxLength={1000}
        defaultValue={initial.description}
        hint="What it does and who runs it. Contributors and ProofMe reviewers read this."
        error={errors.description}
      />
      <TextField
        name="websiteUrl"
        label="Website"
        type="url"
        inputMode="url"
        defaultValue={initial.websiteUrl}
        hint="A full https:// link. Needed before asking ProofMe to review the organisation."
        error={errors.websiteUrl}
      />
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Submit pending={pending} label={submitLabel} pendingLabel="Saving…" />
        <Link href={cancelHref} className="action action-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

/** Keeps the address in step with the name field while the address is untouched. */
function SlugFollower({ onName }: { onName: (name: string) => void }) {
  return (
    <input
      type="hidden"
      ref={(element) => {
        const form = element?.form;
        const nameInput = form?.elements.namedItem("name");
        if (!(nameInput instanceof HTMLInputElement)) return;
        const listener = () => onName(nameInput.value);
        nameInput.addEventListener("input", listener);
        return () => nameInput.removeEventListener("input", listener);
      }}
    />
  );
}

export interface ProjectValues {
  name: string;
  description: string | null;
  websiteUrl: string | null;
  repositoryUrl: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export function ProjectForm({
  initial,
  action,
  submitLabel,
  cancelHref,
}: {
  initial: ProjectValues;
  action: Action;
  submitLabel: string;
  cancelHref: string;
}) {
  const { state, pending, onSubmit } = useFormAction(action);
  const errors = state.errors ?? {};
  return (
    <form onSubmit={onSubmit} method="post" className="form-stack gap-6" noValidate>
      <Feedback state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="name"
          label="Project name"
          required
          maxLength={120}
          defaultValue={initial.name}
          error={errors.name}
        />
        <Select
          name="status"
          label="Status"
          value={initial.status}
          error={errors.status}
          options={PROJECT_STATUSES.map((value) => ({
            value,
            label: PROJECT_STATUS_LABELS[value],
          }))}
        />
      </div>
      <p className="field-hint -mt-3">
        Only active and completed projects appear on your public page.
      </p>
      <TextField
        name="description"
        label="Description"
        multiline
        maxLength={2000}
        defaultValue={initial.description}
        error={errors.description}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="websiteUrl"
          label="Website"
          type="url"
          inputMode="url"
          defaultValue={initial.websiteUrl}
          error={errors.websiteUrl}
        />
        <TextField
          name="repositoryUrl"
          label="Repository"
          type="url"
          inputMode="url"
          defaultValue={initial.repositoryUrl}
          error={errors.repositoryUrl}
        />
        <TextField
          name="startDate"
          label="Started"
          type="date"
          defaultValue={initial.startDate}
          error={errors.startDate}
        />
        <TextField
          name="endDate"
          label="Finished"
          type="date"
          defaultValue={initial.endDate}
          error={errors.endDate}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Submit pending={pending} label={submitLabel} pendingLabel="Saving…" />
        <Link href={cancelHref} className="action action-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function RequestReviewButton({ organisationId }: { organisationId: string }) {
  const [state, action, pending] = useActionState(requestReviewAction.bind(null, organisationId), {
    status: "idle",
  } as FormState);
  const hydrated = useHydrated();
  return (
    <form action={action} className="grid gap-3">
      <Feedback state={state} />
      {state.status !== "success" ? (
        <div>
          <button type="submit" className="action action-primary" disabled={pending || !hydrated}>
            {pending ? "Sending…" : "Ask ProofMe to review us"}
          </button>
        </div>
      ) : null}
    </form>
  );
}

export function InviteForm({
  organisationId,
  canInviteAdmins,
}: {
  organisationId: string;
  canInviteAdmins: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction<InviteState>(
    inviteAction.bind(null, organisationId),
    {
      status: "idle",
    },
  );
  const hydrated = useHydrated();
  const [copied, setCopied] = useState(false);
  const errors = state.errors ?? {};
  const roles = canInviteAdmins
    ? (["admin", "reviewer", "viewer"] as const)
    : (["reviewer", "viewer"] as const);

  return (
    <div className="grid gap-5">
      <form onSubmit={onSubmit} method="post" className="form-stack" noValidate>
        {state.status === "error" && state.message ? (
          <FormMessage tone="error">{state.message}</FormMessage>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-[1fr_14rem]">
          <TextField
            name="email"
            label="Their email"
            type="email"
            inputMode="email"
            required
            autoComplete="off"
            error={errors.email}
          />
          <Select
            name="role"
            label="Role"
            value="reviewer"
            error={errors.role}
            options={roles.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          />
        </div>
        <ul className="grid gap-1 text-[0.88rem] text-muted">
          {roles.map((role) => (
            <li key={role}>
              <span className="font-semibold text-ink">{ROLE_LABELS[role]}:</span>{" "}
              {ROLE_DESCRIPTIONS[role]}
            </li>
          ))}
        </ul>
        <div>
          <button type="submit" className="action action-primary" disabled={pending || !hydrated}>
            {pending ? "Creating…" : "Create invitation"}
          </button>
        </div>
      </form>

      {state.status === "success" && state.link ? (
        <div role="status" className="rounded-2xl border border-ok-ink/30 bg-ok p-5 text-ok-ink">
          <p className="font-semibold">Invitation for {state.email} created.</p>
          <p className="mt-1 text-[0.92rem]">
            This build cannot send email. Copy this link and send it to them yourself. It is shown
            only once, works only when they sign in with that address, and expires in 7 days.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="invite-link" className="sr-only">
              Invitation link
            </label>
            <input
              id="invite-link"
              readOnly
              value={state.link}
              className="field-input digest min-w-0 flex-1 text-ink"
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              className="action action-secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(state.link ?? "");
                setCopied(true);
              }}
            >
              {copied ? (
                <Check aria-hidden="true" size={16} />
              ) : (
                <Copy aria-hidden="true" size={16} />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MemberControls({
  organisationId,
  userId,
  role,
  assignable,
  canMakeOwner,
  isSelf,
  name,
}: {
  organisationId: string;
  userId: string;
  role: string;
  assignable: string[];
  canMakeOwner: boolean;
  isSelf: boolean;
  name: string;
}) {
  const { state, pending, onSubmit } = useFormAction(
    changeMemberAction.bind(null, organisationId, userId),
  );
  const [ownerState, ownerAction, ownerPending] = useActionState(
    transferOwnershipAction.bind(null, organisationId, userId),
    { status: "idle" } as FormState,
  );
  const hydrated = useHydrated();
  const id = useId();
  const options = [...new Set([role, ...assignable])];

  return (
    <div className="grid gap-2">
      <form onSubmit={onSubmit} method="post" className="flex flex-wrap items-end gap-2">
        <div className="field">
          <label htmlFor={id} className="sr-only">
            Role for {name}
          </label>
          <select id={id} name="role" defaultValue={role} className="field-input min-h-11 py-2">
            {options.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option as keyof typeof ROLE_LABELS] ?? option}
              </option>
            ))}
            <option value="remove">
              {isSelf ? "Leave organisation" : "Remove from organisation"}
            </option>
          </select>
        </div>
        <button
          type="submit"
          className="action action-secondary min-h-11 py-2"
          disabled={pending || !hydrated}
        >
          {pending ? "Saving…" : "Apply"}
        </button>
      </form>
      {canMakeOwner && role !== "owner" ? (
        <form action={ownerAction}>
          <button
            type="submit"
            className="text-link text-[0.88rem]"
            disabled={ownerPending || !hydrated}
          >
            Make {name} an owner too
          </button>
        </form>
      ) : null}
      <Feedback state={state.status !== "idle" ? state : ownerState} />
    </div>
  );
}

export function InvitationResponse({ token }: { token: string }) {
  const [acceptState, accept, accepting] = useActionState(
    respondToInvitationAction.bind(null, token, true),
    {
      status: "idle",
    } as FormState,
  );
  const [declineState, decline, declining] = useActionState(
    respondToInvitationAction.bind(null, token, false),
    {
      status: "idle",
    } as FormState,
  );
  const hydrated = useHydrated();
  const busy = accepting || declining || !hydrated;
  const state = acceptState.status !== "idle" ? acceptState : declineState;
  return (
    <div className="grid gap-4">
      <Feedback state={state} />
      <div className="flex flex-wrap gap-3">
        <form action={accept}>
          <button type="submit" className="action action-primary" disabled={busy}>
            {accepting ? "Joining…" : "Accept and join"}
          </button>
        </form>
        <form action={decline}>
          <button type="submit" className="action action-secondary" disabled={busy}>
            {declining ? "Declining…" : "Decline"}
          </button>
        </form>
      </div>
    </div>
  );
}
