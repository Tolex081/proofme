"use client";

import { CircleAlert } from "lucide-react";
import { useId } from "react";
import { useFormStatus } from "react-dom";

/**
 * Form parts shared by every form in the product. Labels are always visible,
 * hints and errors are tied to their field for assistive technology, and an
 * error names the problem and how to fix it.
 */

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      <CircleAlert aria-hidden="true" size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

interface TextFieldProps {
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: React.ReactNode;
  error?: string;
  type?: "text" | "email" | "password" | "url";
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  multiline?: boolean;
  inputMode?: "text" | "email" | "url";
  prefix?: string;
  spellCheck?: boolean;
}

export function TextField({
  name,
  label,
  defaultValue,
  hint,
  error,
  type = "text",
  required = false,
  autoComplete,
  maxLength,
  multiline = false,
  inputMode,
  prefix,
  spellCheck,
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  const shared = {
    id,
    name,
    defaultValue: defaultValue ?? "",
    required,
    maxLength,
    autoComplete,
    spellCheck,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
    className: "field-input",
  } as const;

  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
        {required ? null : <span className="field-optional"> (optional)</span>}
      </label>
      {multiline ? (
        <textarea {...shared} rows={4} />
      ) : prefix ? (
        <div className="field-prefixed">
          <span aria-hidden="true">{prefix}</span>
          <input {...shared} type={type} inputMode={inputMode} />
        </div>
      ) : (
        <input {...shared} type={type} inputMode={inputMode} />
      )}
      {hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`form-message form-message-${tone}`}>
      {children}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="action action-primary"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
