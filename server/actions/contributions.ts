"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { parseSkillList } from "@/lib/validation/profile";
import {
  createContribution,
  deleteDraft,
  publishSelfReported,
  updateContribution,
} from "@/server/services/contributions";
import type { FormState } from "./account";

/**
 * Server actions for contributions. Each authenticates itself and passes only
 * the session's user ID to the service, which scopes every query by it.
 */

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const all = (form: FormData, name: string) =>
  form.getAll(name).map((value) => (typeof value === "string" ? value : ""));

function readContribution(form: FormData) {
  const types = all(form, "evidence-type");
  const urls = all(form, "evidence-url");
  const labels = all(form, "evidence-label");
  const evidence = urls
    .map((url, index) => ({ type: types[index] ?? "", url, label: labels[index] ?? "" }))
    // A row left completely empty is not a link.
    .filter((item) => item.url.trim() !== "" || item.label.trim() !== "");
  return {
    title: text(form, "title"),
    summary: text(form, "summary"),
    description: text(form, "description"),
    category: text(form, "category"),
    role: text(form, "role"),
    skills: parseSkillList(text(form, "skills")),
    startDate: text(form, "startDate"),
    endDate: text(form, "endDate"),
    visibility: text(form, "visibility") === "public" ? "public" : "private",
    evidence,
  };
}

function failed(errors: Record<string, string>): FormState {
  return {
    status: "error",
    errors,
    message: errors.form ?? "Some details need fixing. Check the highlighted fields.",
  };
}

export async function createContributionAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser("/dashboard/contributions/new");
  const result = await createContribution(await getDb(), user.id, readContribution(form));
  if (!result.ok) return failed(result.errors);
  redirect(`/dashboard/contributions/${result.value.id}?saved=1`);
}

export async function updateContributionAction(
  contributionId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser(`/dashboard/contributions/${contributionId}`);
  const result = await updateContribution(
    await getDb(),
    user.id,
    contributionId,
    readContribution(form),
  );
  if (!result.ok) return failed(result.errors);
  redirect(`/dashboard/contributions/${contributionId}?saved=1`);
}

export async function publishContributionAction(contributionId: string): Promise<FormState> {
  const user = await requireUser(`/dashboard/contributions/${contributionId}`);
  const result = await publishSelfReported(await getDb(), user.id, contributionId);
  if (!result.ok) return failed(result.errors);
  refresh();
  return { status: "success", message: "Marked as self-reported." };
}

export async function deleteContributionAction(contributionId: string): Promise<FormState> {
  const user = await requireUser(`/dashboard/contributions/${contributionId}`);
  const result = await deleteDraft(await getDb(), user.id, contributionId);
  if (!result.ok) return failed(result.errors);
  redirect("/dashboard/contributions?deleted=1");
}
