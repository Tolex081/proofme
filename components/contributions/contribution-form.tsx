"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { FieldError, FormMessage, TextField } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { useHydrated } from "@/components/forms/use-hydrated";
import { CONTRIBUTION_CATEGORIES } from "@/lib/attestations/payload";
import { CATEGORY_LABELS, EVIDENCE_TYPE_LABELS, MAX_EVIDENCE } from "@/lib/validation/contribution";
import { EVIDENCE_TYPES, suggestEvidenceType, validateEvidenceUrl } from "@/lib/urls/evidence";
import type { FormState } from "@/server/actions/account";

export interface ContributionFormValues {
  title: string;
  summary: string;
  description: string;
  category: string;
  role: string;
  skills: string[];
  startDate: string | null;
  endDate: string | null;
  visibility: "public" | "private";
  evidence: { type: string; url: string; label: string }[];
}

export const EMPTY_CONTRIBUTION: ContributionFormValues = {
  title: "",
  summary: "",
  description: "",
  category: "development",
  role: "",
  skills: [],
  startDate: null,
  endDate: null,
  visibility: "public",
  evidence: [],
};

interface Row {
  key: number;
  type: string;
  url: string;
  label: string;
}

function SelectField({
  name,
  label,
  value,
  options,
  error,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
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

function EvidenceEditor({
  initial,
  errors,
}: {
  initial: ContributionFormValues["evidence"];
  errors: Record<string, string>;
}) {
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((item, index) => ({ key: index, ...item })),
  );
  const baseId = useId();

  function update(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function add() {
    setRows((current) => [
      ...current,
      { key: nextKey.current++, type: "other", url: "", label: "" },
    ]);
  }

  function suggestType(row: Row) {
    const checked = validateEvidenceUrl(row.url);
    if (!checked.ok) return;
    const suggestion = suggestEvidenceType(checked.url);
    if (suggestion && row.type === "other") update(row.key, { type: suggestion });
  }

  return (
    <fieldset className="field">
      <legend className="field-label">Evidence</legend>
      <p className="field-hint">
        Links a reviewer can open: a pull request, an issue, a document, a demo. Only https links to
        public websites are accepted. ProofMe does not open them; the reviewer judges them.
      </p>
      {errors.evidence ? <FieldError id={`${baseId}-all`} message={errors.evidence} /> : null}

      <ol className="mt-2 grid gap-3">
        {rows.map((row, index) => {
          const prefix = `evidence.${index}`;
          const rowId = `${baseId}-${row.key}`;
          return (
            <li key={row.key} className="well grid gap-3 p-4 sm:grid-cols-[11rem_1fr]">
              <div className="field">
                <label htmlFor={`${rowId}-type`} className="field-label text-[0.88rem]">
                  Link {index + 1}: kind
                </label>
                <select
                  id={`${rowId}-type`}
                  name="evidence-type"
                  value={row.type}
                  onChange={(event) => update(row.key, { type: event.target.value })}
                  className="field-input"
                >
                  {EVIDENCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EVIDENCE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${rowId}-url`} className="field-label text-[0.88rem]">
                  Link {index + 1}: address
                </label>
                <input
                  id={`${rowId}-url`}
                  name="evidence-url"
                  type="url"
                  inputMode="url"
                  value={row.url}
                  placeholder="https://"
                  spellCheck={false}
                  onChange={(event) => update(row.key, { url: event.target.value })}
                  onBlur={() => suggestType(row)}
                  aria-invalid={errors[`${prefix}.url`] ? true : undefined}
                  aria-describedby={errors[`${prefix}.url`] ? `${rowId}-url-error` : undefined}
                  className="field-input"
                />
                <FieldError id={`${rowId}-url-error`} message={errors[`${prefix}.url`]} />
              </div>
              <div className="field sm:col-span-2 sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-3">
                <div className="field">
                  <label htmlFor={`${rowId}-label`} className="field-label text-[0.88rem]">
                    Link {index + 1}: description
                  </label>
                  <input
                    id={`${rowId}-label`}
                    name="evidence-label"
                    value={row.label}
                    maxLength={120}
                    placeholder="For example: Pull request #42"
                    onChange={(event) => update(row.key, { label: event.target.value })}
                    aria-invalid={errors[`${prefix}.label`] ? true : undefined}
                    aria-describedby={
                      errors[`${prefix}.label`] ? `${rowId}-label-error` : undefined
                    }
                    className="field-input"
                  />
                  <FieldError id={`${rowId}-label-error`} message={errors[`${prefix}.label`]} />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRows((current) => current.filter((item) => item.key !== row.key))
                  }
                  className="action action-secondary mt-2 sm:mt-0"
                  aria-label={`Remove link ${index + 1}`}
                >
                  <Trash2 aria-hidden="true" size={16} /> Remove
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {rows.length < MAX_EVIDENCE ? (
        <div className="mt-2">
          <button type="button" onClick={add} className="action action-secondary">
            <Plus aria-hidden="true" size={17} />{" "}
            {rows.length === 0 ? "Add a link" : "Add another link"}
          </button>
        </div>
      ) : (
        <p className="field-hint">You can add up to {MAX_EVIDENCE} links.</p>
      )}
    </fieldset>
  );
}

export function ContributionForm({
  initial,
  action,
  submitLabel,
  cancelHref,
}: {
  initial: ContributionFormValues;
  action: (previous: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  cancelHref: string;
}) {
  const { state, pending, onSubmit } = useFormAction(action);
  const hydrated = useHydrated();
  const errors = state.errors ?? {};
  const disabled = pending || !hydrated;

  return (
    <form onSubmit={onSubmit} method="post" className="form-stack gap-6" noValidate>
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <TextField
        name="title"
        label="Title"
        required
        maxLength={160}
        defaultValue={initial.title}
        hint="Name the specific piece of work, for example “Proposal review interface”."
        error={errors.title}
      />
      <TextField
        name="summary"
        label="One-line summary"
        maxLength={400}
        defaultValue={initial.summary}
        hint="What you did, in a sentence."
        error={errors.summary}
      />
      <TextField
        name="description"
        label="What you did"
        multiline
        maxLength={8000}
        defaultValue={initial.description}
        hint="The detail a reviewer needs: the problem, what you built or did, and what came of it."
        error={errors.description}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="category"
          label="Kind of work"
          value={initial.category}
          error={errors.category}
          options={CONTRIBUTION_CATEGORIES.map((value) => ({
            value,
            label: CATEGORY_LABELS[value],
          }))}
        />
        <TextField
          name="role"
          label="Your role"
          maxLength={120}
          defaultValue={initial.role}
          error={errors.role}
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

      <TextField
        name="skills"
        label="Skills used"
        defaultValue={initial.skills.join(", ")}
        hint="Separate with commas."
        error={errors.skills}
      />

      <EvidenceEditor initial={initial.evidence} errors={errors} />

      <fieldset className="field">
        <legend className="field-label">Visibility</legend>
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          {(
            [
              [
                "public",
                "Can appear on my public profile",
                "Only once it is self-reported or verified, and only if your profile is public. Drafts never appear.",
              ],
              ["private", "Keep it private", "Never shown on your profile, whatever its status."],
            ] as const
          ).map(([value, title, body]) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-2xl border-[1.5px] border-line-strong bg-surface p-4 transition-colors hover:border-ink has-[:checked]:border-brand has-[:focus-visible]:outline-[2.5px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-link"
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                defaultChecked={initial.visibility === value}
                className="mt-1 size-4"
              />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-[0.88rem] text-muted">{body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button
          type="submit"
          className="action action-primary"
          disabled={disabled}
          aria-disabled={disabled}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} className="action action-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
