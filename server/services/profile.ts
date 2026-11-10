import { and, eq, ne } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { auditEvents, userProfiles, users } from "@/lib/db/schema";
import {
  PROFILE_SECTIONS,
  fieldErrors,
  identitySchema,
  onboardingSchema,
  privacySchema,
  profileSchema,
  usernameSchema,
  type ProfileSection,
} from "@/lib/validation/profile";

/**
 * Profile rules. Every function takes the acting user's ID from the caller's
 * verified session and only ever touches that user's own profile, so there is
 * no profile ID a request could swap for someone else's.
 */

export type Profile = typeof userProfiles.$inferSelect;

export type ServiceResult<T> =
  { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const USERNAME_TAKEN = "That username is taken. Choose another.";

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === "23505") return true;
    if (
      typeof candidate.message === "string" &&
      /duplicate key|unique constraint/i.test(candidate.message)
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export async function getProfileByUserId(db: Database, userId: string): Promise<Profile | null> {
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
  return profile ?? null;
}

/** True when the profile exists and onboarding has been completed. */
export function isOnboarded(profile: Profile | null): profile is Profile {
  return profile !== null && profile.onboardedAt !== null;
}

export async function isUsernameAvailable(
  db: Database,
  username: string,
  forUserId?: string,
): Promise<boolean> {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return false;
  const condition = forUserId
    ? and(eq(userProfiles.username, parsed.data), ne(userProfiles.userId, forUserId))
    : eq(userProfiles.username, parsed.data);
  const [existing] = await db.select({ id: userProfiles.id }).from(userProfiles).where(condition);
  return existing === undefined;
}

/** Creates the profile at the end of onboarding. Profiles start private. */
export async function completeOnboarding(
  db: Database,
  userId: string,
  input: unknown,
): Promise<ServiceResult<Profile>> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  const existing = await getProfileByUserId(db, userId);
  if (isOnboarded(existing)) {
    return { ok: false, errors: { form: "You have already set up your profile." } };
  }
  if (!(await isUsernameAvailable(db, data.username, userId))) {
    return { ok: false, errors: { username: USERNAME_TAKEN } };
  }

  const values = {
    username: data.username,
    displayName: data.displayName,
    bio: data.bio,
    professionalCategories: data.roles,
    onboardingIntent: data.intent,
    onboardedAt: new Date(),
  };

  try {
    const [profile] = existing
      ? await db.update(userProfiles).set(values).where(eq(userProfiles.userId, userId)).returning()
      : await db
          .insert(userProfiles)
          .values({ userId, ...values })
          .returning();
    // Keep the account's own name in step with the name the person chose.
    await db.update(users).set({ name: data.displayName }).where(eq(users.id, userId));
    return { ok: true, value: profile };
  } catch (error) {
    // Two people can pass the availability check at the same moment; the
    // database's unique constraint is what actually decides.
    if (isUniqueViolation(error)) return { ok: false, errors: { username: USERNAME_TAKEN } };
    throw error;
  }
}

export async function updateProfile(
  db: Database,
  userId: string,
  input: unknown,
): Promise<ServiceResult<Profile>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const data = parsed.data;

  if (!(await isUsernameAvailable(db, data.username, userId))) {
    return { ok: false, errors: { username: USERNAME_TAKEN } };
  }

  try {
    const [profile] = await db
      .update(userProfiles)
      .set({
        username: data.username,
        displayName: data.displayName,
        bio: data.bio,
        location: data.location,
        websiteUrl: data.websiteUrl,
        professionalCategories: data.roles,
        skills: data.skills,
      })
      .where(eq(userProfiles.userId, userId))
      .returning();
    if (!profile) return { ok: false, errors: { form: "Set up your profile first." } };
    await db.update(users).set({ name: data.displayName }).where(eq(users.id, userId));
    return { ok: true, value: profile };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, errors: { username: USERNAME_TAKEN } };
    throw error;
  }
}

/** Links and the optional NEAR account. All self-declared; none are verified. */
export async function updateIdentity(
  db: Database,
  userId: string,
  input: unknown,
): Promise<ServiceResult<Profile>> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { nearAccountId, ...links } = parsed.data;

  const socialLinks: Record<string, string> = {};
  for (const [key, value] of Object.entries(links)) {
    if (value) socialLinks[key] = value;
  }

  const [profile] = await db
    .update(userProfiles)
    .set({ socialLinks, nearAccountId })
    .where(eq(userProfiles.userId, userId))
    .returning();
  if (!profile) return { ok: false, errors: { form: "Set up your profile first." } };
  return { ok: true, value: profile };
}

export async function updatePrivacy(
  db: Database,
  userId: string,
  input: unknown,
): Promise<ServiceResult<Profile>> {
  const parsed = privacySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const before = await getProfileByUserId(db, userId);
  if (!before) return { ok: false, errors: { form: "Set up your profile first." } };

  const [profile] = await db
    .update(userProfiles)
    .set({ visibility: parsed.data.visibility, sectionVisibility: parsed.data.sections })
    .where(eq(userProfiles.userId, userId))
    .returning();

  if (before.visibility !== profile.visibility) {
    await db.insert(auditEvents).values({
      actorUserId: userId,
      action: "profile.visibility_changed",
      entityType: "user_profile",
      entityId: profile.id,
      metadata: { from: before.visibility, to: profile.visibility },
    });
  }
  return { ok: true, value: profile };
}

/** Whether a section is shown publicly. Sections are shown unless switched off. */
export function isSectionVisible(profile: Profile, section: ProfileSection): boolean {
  return profile.sectionVisibility[section] !== false;
}

export function sectionVisibilityOf(profile: Profile): Record<ProfileSection, boolean> {
  return Object.fromEntries(
    PROFILE_SECTIONS.map((section) => [section, isSectionVisible(profile, section)]),
  ) as Record<ProfileSection, boolean>;
}

/** Exactly what a signed-out visitor may see. Built field by field, never by spreading the row. */
export interface PublicProfile {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  memberSince: Date;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string>;
  roles: string[];
  skills: string[];
  nearAccountId: string | null;
}

/**
 * The public view of a profile, or null when there is nothing a visitor may
 * see: no such username, a private profile, an unfinished one, or an account
 * that is not active. All four look identical from outside.
 */
export async function getPublicProfile(
  db: Database,
  username: string,
): Promise<PublicProfile | null> {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return null;

  const [row] = await db
    .select({ profile: userProfiles, status: users.status })
    .from(userProfiles)
    .innerJoin(users, eq(users.id, userProfiles.userId))
    .where(eq(userProfiles.username, parsed.data));

  if (!row || row.status !== "active") return null;
  const { profile } = row;
  if (profile.visibility !== "public" || profile.onboardedAt === null) return null;

  const show = (section: ProfileSection) => isSectionVisible(profile, section);

  return {
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    memberSince: profile.createdAt,
    bio: show("bio") ? profile.bio : null,
    location: show("location") ? profile.location : null,
    websiteUrl: show("links") ? profile.websiteUrl : null,
    socialLinks: show("links") ? profile.socialLinks : {},
    roles: show("skills") ? profile.professionalCategories : [],
    skills: show("skills") ? profile.skills : [],
    nearAccountId: show("nearAccount") ? profile.nearAccountId : null,
  };
}
