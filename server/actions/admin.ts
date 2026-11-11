"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  createReport,
  decideOrganisation,
  resolveReport,
  setUserSuspended,
} from "@/server/services/admin";
import type { FormState } from "./account";

/**
 * Server actions for platform administration and reporting. Each one signs
 * the caller in again, and the service re-checks the admin flag in the
 * database, so hiding a button is never the only protection.
 */

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

function failed(errors: Record<string, string>): FormState {
  return { status: "error", errors, message: errors.form ?? Object.values(errors)[0] };
}

export async function decideOrganisationAction(
  organisationId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser(`/admin/organisations/${organisationId}`);
  const decision = text(form, "decision");
  const result = await decideOrganisation(await getDb(), user.id, organisationId, {
    decision,
    reason: text(form, "reason"),
  });
  if (!result.ok) return failed(result.errors);
  redirect(`/admin/organisations/${organisationId}?decided=${decision}`);
}

export async function setUserSuspendedAction(
  userId: string,
  suspend: boolean,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser("/admin/users");
  const result = await setUserSuspended(
    await getDb(),
    user.id,
    userId,
    suspend,
    text(form, "reason"),
  );
  if (!result.ok) return failed(result.errors);
  return {
    status: "success",
    message: suspend ? "Account suspended and signed out everywhere." : "Account reinstated.",
  };
}

export async function resolveReportAction(
  reportId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser("/admin/reports");
  const outcome = text(form, "outcome");
  const result = await resolveReport(await getDb(), user.id, reportId, outcome, text(form, "note"));
  if (!result.ok) return failed(result.errors);
  return {
    status: "success",
    message: outcome === "dismissed" ? "Report dismissed." : "Report marked as handled.",
  };
}

export async function createReportAction(
  target: { type: "profile" | "organisation" | "attestation"; id: string; returnTo: string },
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const returnTo =
    target.returnTo.startsWith("/") && !target.returnTo.startsWith("//") ? target.returnTo : "/";
  const user = await requireUser(returnTo);
  const result = await createReport(await getDb(), user.id, {
    targetType: target.type,
    targetId: target.id,
    reason: text(form, "reason"),
    details: text(form, "details"),
  });
  if (!result.ok) return failed(result.errors);
  return {
    status: "success",
    message:
      "Thank you. A ProofMe administrator will look at this. The person you reported is not told who sent it.",
  };
}
