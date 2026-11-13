"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { PROFILE_SECTIONS, parseSkillList } from "@/lib/validation/profile";
import { markAllNotificationsRead, requestAccountDeletion } from "@/server/services/account";
import {
  completeOnboarding,
  updateIdentity,
  updatePrivacy,
  updateProfile,
} from "@/server/services/profile";

/**
 * Server actions behind the account forms. Every one authenticates on its
 * own, takes the user ID only from the verified session, and validates input
 * on the server, whatever the page that rendered the form already checked.
 */

export interface FormState {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string>;
}

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const failed = (errors: Record<string, string>): FormState => ({
  status: "error",
  errors,
  message: errors.form ?? "Some details need fixing. Check the highlighted fields.",
});

export async function finishOnboarding(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/onboarding");
  const result = await completeOnboarding(await getDb(), user.id, {
    intent: text(form, "intent"),
    displayName: text(form, "displayName"),
    username: text(form, "username"),
    bio: text(form, "bio"),
    roles: form.getAll("roles").filter((value) => typeof value === "string"),
  });
  if (!result.ok) return failed(result.errors);
  redirect("/dashboard?welcome=1");
}

export async function saveProfile(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard/settings");
  const result = await updateProfile(await getDb(), user.id, {
    displayName: text(form, "displayName"),
    username: text(form, "username"),
    bio: text(form, "bio"),
    location: text(form, "location"),
    websiteUrl: text(form, "websiteUrl"),
    roles: form.getAll("roles").filter((value) => typeof value === "string"),
    skills: parseSkillList(text(form, "skills")),
  });
  if (!result.ok) return failed(result.errors);
  refresh();
  return { status: "success", message: "Profile saved." };
}

export async function saveIdentity(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard/identity");
  const result = await updateIdentity(await getDb(), user.id, {
    github: text(form, "github"),
    x: text(form, "x"),
    linkedin: text(form, "linkedin"),
    other: text(form, "other"),
  });
  if (!result.ok) return failed(result.errors);
  refresh();
  return { status: "success", message: "Links saved." };
}

export async function savePrivacy(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard/settings");
  const result = await updatePrivacy(await getDb(), user.id, {
    visibility: text(form, "visibility"),
    sections: Object.fromEntries(
      PROFILE_SECTIONS.map((section) => [section, form.get(`show-${section}`) === "on"]),
    ),
  });
  if (!result.ok) return failed(result.errors);
  refresh();
  return {
    status: "success",
    message:
      result.value.visibility === "public"
        ? "Saved. Your profile is public."
        : "Saved. Your profile is private.",
  };
}

export async function markNotificationsRead(): Promise<void> {
  const user = await requireUser("/dashboard/notifications");
  await markAllNotificationsRead(await getDb(), user.id);
  refresh();
}

export async function deleteAccount(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard/settings");
  const result = await requestAccountDeletion(await getDb(), user.id, text(form, "confirm"));
  if (!result.ok)
    return { status: "error", errors: { confirm: result.error }, message: result.error };
  redirect("/?account=closed");
}
