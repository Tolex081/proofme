"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  decide,
  respondToRequest,
  reviseRejected,
  submitForReview,
  withdrawRequest,
} from "@/server/services/verification";
import type { FormState } from "./account";

/** Server actions for the review workflow. Each authenticates itself. */

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

function failed(errors: Record<string, string>): FormState {
  return { status: "error", errors, message: errors.form ?? Object.values(errors)[0] };
}

export async function submitForReviewAction(
  contributionId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser(`/dashboard/contributions/${contributionId}`);
  // The choice is "organisationId" or "organisationId:projectId".
  const [organisationId = "", projectId = ""] = text(form, "target").split(":");
  const result = await submitForReview(await getDb(), user.id, contributionId, {
    organisationId,
    projectId,
  });
  if (!result.ok) return failed(result.errors);
  redirect(`/dashboard/contributions/${contributionId}?update=sent`);
}

export async function withdrawAction(contributionId: string): Promise<FormState> {
  const user = await requireUser(`/dashboard/contributions/${contributionId}`);
  const result = await withdrawRequest(await getDb(), user.id, contributionId);
  if (!result.ok) return failed(result.errors);
  redirect(`/dashboard/contributions/${contributionId}?update=withdrawn`);
}

export async function respondAction(
  contributionId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser(`/dashboard/contributions/${contributionId}`);
  const result = await respondToRequest(
    await getDb(),
    user.id,
    contributionId,
    text(form, "message"),
  );
  if (!result.ok) return failed(result.errors);
  redirect(`/dashboard/contributions/${contributionId}?update=answered`);
}

export async function reviseAction(contributionId: string): Promise<FormState> {
  const user = await requireUser(`/dashboard/contributions/${contributionId}`);
  const result = await reviseRejected(await getDb(), user.id, contributionId);
  if (!result.ok) return failed(result.errors);
  redirect(`/dashboard/contributions/${contributionId}/edit`);
}

export async function decideAction(
  requestId: string,
  organisationSlug: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser(`/org/${organisationSlug}/verifications/${requestId}`);
  const result = await decide(await getDb(), user.id, requestId, {
    decision: text(form, "decision"),
    message: text(form, "message"),
    internalNote: text(form, "internalNote"),
    expectedVersion: text(form, "expectedVersion"),
  });
  if (!result.ok) return failed(result.errors);
  redirect(`/org/${organisationSlug}/verifications/${requestId}?decided=${result.value.status}`);
}
