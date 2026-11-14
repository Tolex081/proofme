"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import {
  changeMember,
  createInvitation,
  createOrganisation,
  createProject,
  requestPlatformReview,
  respondToInvitation,
  revokeInvitation,
  transferOwnership,
  updateOrganisation,
  updateProject,
} from "@/server/services/organisations";
import type { FormState } from "./account";

/**
 * Server actions for organisations. Each authenticates itself; the services
 * then load the actor's membership from the database and check the role
 * against the organisation that owns the record.
 */

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

function failed(errors: Record<string, string>): FormState {
  return {
    status: "error",
    errors,
    message: errors.form ?? "Some details need fixing. Check the highlighted fields.",
  };
}

const organisationFields = (form: FormData) => ({
  name: text(form, "name"),
  slug: text(form, "slug"),
  category: text(form, "category"),
  description: text(form, "description"),
  websiteUrl: text(form, "websiteUrl"),
});

const projectFields = (form: FormData) => ({
  name: text(form, "name"),
  description: text(form, "description"),
  websiteUrl: text(form, "websiteUrl"),
  repositoryUrl: text(form, "repositoryUrl"),
  status: text(form, "status"),
  startDate: text(form, "startDate"),
  endDate: text(form, "endDate"),
});

export async function createOrganisationAction(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser("/organisations/new");
  const result = await createOrganisation(await getDb(), user.id, organisationFields(form));
  if (!result.ok) return failed(result.errors);
  redirect(`/org/${result.value.slug}/dashboard?created=1`);
}

export async function updateOrganisationAction(
  organisationId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const result = await updateOrganisation(
    await getDb(),
    user.id,
    organisationId,
    organisationFields(form),
  );
  if (!result.ok) return failed(result.errors);
  redirect(`/org/${result.value.slug}/settings?saved=1`);
}

export async function requestReviewAction(organisationId: string): Promise<FormState> {
  const user = await requireUser();
  const result = await requestPlatformReview(await getDb(), user.id, organisationId);
  if (!result.ok) return failed(result.errors);
  refresh();
  return {
    status: "success",
    message: "Sent for review. A Atesta administrator will look at it.",
  };
}

export async function createProjectAction(
  organisationId: string,
  organisationSlug: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const result = await createProject(await getDb(), user.id, organisationId, projectFields(form));
  if (!result.ok) return failed(result.errors);
  redirect(`/org/${organisationSlug}/projects/${result.value.id}?saved=1`);
}

export async function updateProjectAction(
  projectId: string,
  organisationSlug: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const result = await updateProject(await getDb(), user.id, projectId, projectFields(form));
  if (!result.ok) return failed(result.errors);
  redirect(`/org/${organisationSlug}/projects/${projectId}?saved=1`);
}

export interface InviteState extends FormState {
  link?: string;
  email?: string;
}

export async function inviteAction(
  organisationId: string,
  _previous: InviteState,
  form: FormData,
): Promise<InviteState> {
  const user = await requireUser();
  const result = await createInvitation(await getDb(), user.id, organisationId, {
    email: text(form, "email"),
    role: text(form, "role"),
  });
  if (!result.ok) return failed(result.errors);
  refresh();
  return {
    status: "success",
    message: "Invitation created.",
    link: `${getEnv().NEXT_PUBLIC_APP_URL}/invitations/${result.value.token}`,
    email: text(form, "email").trim().toLowerCase(),
  };
}

export async function revokeInvitationAction(
  organisationId: string,
  invitationId: string,
): Promise<void> {
  const user = await requireUser();
  await revokeInvitation(await getDb(), user.id, organisationId, invitationId);
  refresh();
}

export async function changeMemberAction(
  organisationId: string,
  targetUserId: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const choice = text(form, "role");
  const result = await changeMember(
    await getDb(),
    user.id,
    organisationId,
    targetUserId,
    choice === "remove" ? null : choice,
  );
  if (!result.ok) return failed(result.errors);
  if (choice === "remove" && targetUserId === user.id) redirect("/dashboard/organisations?left=1");
  refresh();
  return { status: "success", message: choice === "remove" ? "Removed." : "Role changed." };
}

export async function transferOwnershipAction(
  organisationId: string,
  targetUserId: string,
): Promise<FormState> {
  const user = await requireUser();
  const result = await transferOwnership(await getDb(), user.id, organisationId, targetUserId);
  if (!result.ok) return failed(result.errors);
  refresh();
  return { status: "success", message: "They are now an owner too." };
}

export async function respondToInvitationAction(
  token: string,
  accept: boolean,
): Promise<FormState> {
  const user = await requireUser(`/invitations/${token}`);
  const result = await respondToInvitation(await getDb(), user, token, accept);
  if (!result.ok) return failed(result.errors);
  if (accept) redirect(`/org/${result.value.organisationSlug}/dashboard?joined=1`);
  redirect("/dashboard/organisations?declined=1");
}
