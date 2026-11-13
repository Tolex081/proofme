import { z } from "zod";

import { validateEvidenceUrl } from "../urls/evidence";

/**
 * Profile input rules. Pure and shared: forms use the messages, services
 * enforce the same schemas on the server.
 */

export const PROFESSIONAL_ROLES = [
  "developer",
  "designer",
  "researcher",
  "writer",
  "community_manager",
  "product_manager",
  "project_manager",
  "mentor",
  "governance",
  "other",
] as const;

export type ProfessionalRole = (typeof PROFESSIONAL_ROLES)[number];

export const PROFESSIONAL_ROLE_LABELS: Record<ProfessionalRole, string> = {
  developer: "Developer",
  designer: "Designer",
  researcher: "Researcher",
  writer: "Writer or documentarian",
  community_manager: "Community manager",
  product_manager: "Product manager",
  project_manager: "Project manager",
  mentor: "Mentor",
  governance: "Governance participant",
  other: "Something else",
};

export const ONBOARDING_INTENTS = ["contributor", "organisation", "both"] as const;
export type OnboardingIntent = (typeof ONBOARDING_INTENTS)[number];

// Usernames that would collide with routes or impersonate the platform.
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "app",
  "dashboard",
  "explore",
  "help",
  "login",
  "logout",
  "me",
  "new",
  "null",
  "onboarding",
  "org",
  "organisations",
  "privacy",
  "project",
  "proofme",
  "register",
  "root",
  "settings",
  "support",
  "system",
  "terms",
  "undefined",
  "verify",
]);

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters.")
  .max(30, "Use at most 30 characters.")
  .regex(
    USERNAME_PATTERN,
    "Use lowercase letters, numbers and hyphens, starting and ending with a letter or number.",
  )
  .refine((value) => !value.includes("--"), "Do not use two hyphens in a row.")
  .refine((value) => !RESERVED_USERNAMES.has(value), "That username is reserved. Choose another.");

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((value) => (value === "" ? null : value.normalize("NFC")))
    .nullable();

function optionalUrl(label: string, allowedHosts?: string[]) {
  return z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === "") return null;
      const result = validateEvidenceUrl(value);
      if (!result.ok) {
        context.addIssue({
          code: "custom",
          message: `${label} must be a full https:// link to a public website.`,
        });
        return z.NEVER;
      }
      if (allowedHosts && !allowedHosts.includes(result.host)) {
        context.addIssue({
          code: "custom",
          message: `${label} must be a link on ${allowedHosts.join(" or ")}.`,
        });
        return z.NEVER;
      }
      return result.url;
    })
    .nullable();
}

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter the name you want shown on your profile.")
  .max(80, "Your name can be at most 80 characters.")
  .transform((value) => value.normalize("NFC"));

const rolesSchema = z
  .array(z.enum(PROFESSIONAL_ROLES))
  .max(3, "Choose up to three.")
  .transform((values) => [...new Set(values)]);

export const onboardingSchema = z.object({
  intent: z.enum(ONBOARDING_INTENTS, "Choose what you want to do first."),
  displayName: displayNameSchema,
  username: usernameSchema,
  bio: optionalText(400, "Your bio"),
  roles: rolesSchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

const skillsSchema = z
  .array(z.string().trim().min(1).max(40, "A skill can be at most 40 characters."))
  .max(15, "List up to 15 skills.")
  .transform((values) => [...new Set(values.map((value) => value.normalize("NFC")))]);

/** Turns "TypeScript, React,  Figma" into a clean list. */
export function parseSkillList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export const profileSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  bio: optionalText(400, "Your bio"),
  location: optionalText(80, "Your location"),
  websiteUrl: optionalUrl("Your website"),
  roles: rolesSchema,
  skills: skillsSchema,
});

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * A NEAR account ID as the protocol defines it: 2 to 64 characters of
 * lowercase letters and digits, with single `.`, `-` or `_` separators.
 * This build runs on testnet, so a named account must end in `.testnet`;
 * 64-character implicit accounts are also accepted.
 */
const NEAR_ACCOUNT_PATTERN = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export const nearAccountIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value, context) => {
    if (value === "") return null;
    const wellFormed = value.length >= 2 && value.length <= 64 && NEAR_ACCOUNT_PATTERN.test(value);
    const implicit = /^[0-9a-f]{64}$/.test(value);
    if (!wellFormed || !(implicit || value.endsWith(".testnet"))) {
      context.addIssue({
        code: "custom",
        message: "Enter a NEAR testnet account, such as yourname.testnet.",
      });
      return z.NEVER;
    }
    return value;
  })
  .nullable();

export const identitySchema = z.object({
  github: optionalUrl("Your GitHub link", ["github.com"]),
  x: optionalUrl("Your X link", ["x.com", "twitter.com"]),
  linkedin: optionalUrl("Your LinkedIn link", ["linkedin.com"]),
  other: optionalUrl("Your other link"),
});

export type IdentityInput = z.infer<typeof identitySchema>;

/** Parts of a public profile the owner can hide individually. */
export const PROFILE_SECTIONS = ["bio", "location", "links", "skills", "nearAccount"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const PROFILE_SECTION_LABELS: Record<ProfileSection, string> = {
  bio: "Bio",
  location: "Location",
  links: "Website and social links",
  skills: "Roles and skills",
  nearAccount: "NEAR account",
};

export const privacySchema = z.object({
  visibility: z.enum(["public", "private"]),
  sections: z.object(
    Object.fromEntries(PROFILE_SECTIONS.map((section) => [section, z.boolean()])) as Record<
      ProfileSection,
      z.ZodBoolean
    >,
  ),
});

export type PrivacyInput = z.infer<typeof privacySchema>;

/** Field name → first message, the shape forms display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
