import { z } from "zod";

import { ORGANISATION_ROLES } from "../permissions/organisation";
import { validateEvidenceUrl } from "../urls/evidence";

/** Organisation, project and invitation input rules. Pure and shared. */

export const ORGANISATION_CATEGORIES = [
  "dao",
  "web3_protocol",
  "open_source_project",
  "startup",
  "community",
  "hackathon",
  "grant_programme",
  "other",
] as const;

export const ORGANISATION_CATEGORY_LABELS: Record<
  (typeof ORGANISATION_CATEGORIES)[number],
  string
> = {
  dao: "DAO",
  web3_protocol: "Web3 protocol",
  open_source_project: "Open-source project",
  startup: "Startup",
  community: "Community",
  hackathon: "Hackathon",
  grant_programme: "Grant programme",
  other: "Other",
};

export const ROLE_LABELS: Record<(typeof ORGANISATION_ROLES)[number], string> = {
  owner: "Owner",
  admin: "Admin",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<(typeof ORGANISATION_ROLES)[number], string> = {
  owner: "Everything, including the NEAR issuer account and transferring ownership.",
  admin: "Projects, the team and the review queue. Can revoke attestations.",
  reviewer: "Reviews contribution claims and issues attestations.",
  viewer: "Reads what the organisation has issued. Changes nothing.",
};

export const PROJECT_STATUSES = ["draft", "active", "completed", "archived"] as const;
export const PROJECT_STATUS_LABELS: Record<(typeof PROJECT_STATUSES)[number], string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const RESERVED_SLUGS = new Set([
  "new",
  "admin",
  "api",
  "dashboard",
  "settings",
  "proofme",
  "organisations",
  "org",
  "project",
  "explore",
  "verify",
]);

export const ORGANISATION_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$/;

/** A URL-safe slug from a name: "Northstar Protocol" → "northstar-protocol". */
export function slugify(value: string, max = 60): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export const organisationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters.")
  .max(60, "Use at most 60 characters.")
  .regex(
    ORGANISATION_SLUG_PATTERN,
    "Use lowercase letters, numbers and hyphens, starting and ending with a letter or number.",
  )
  .refine((value) => !value.includes("--"), "Do not use two hyphens in a row.")
  .refine((value) => !RESERVED_SLUGS.has(value), "That address is reserved. Choose another.");

const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((value) => (value === "" ? null : value.normalize("NFC")))
    .nullable();

const optionalUrl = (label: string) =>
  z
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
      return result.url;
    })
    .nullable();

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `Enter the ${label}.`)
    .max(120, `The ${label} can be at most 120 characters.`)
    .transform((value) => value.normalize("NFC"));

export const organisationSchema = z.object({
  name: name("organisation's name"),
  slug: organisationSlugSchema,
  category: z.enum(ORGANISATION_CATEGORIES, "Choose what kind of organisation this is."),
  description: text(1000, "The description"),
  websiteUrl: optionalUrl("The website"),
});

export type OrganisationInput = z.infer<typeof organisationSchema>;

const optionalDate = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === "") return null;
      const parsed = new Date(`${value}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
      ) {
        context.addIssue({ code: "custom", message: `${label} must be a real date.` });
        return z.NEVER;
      }
      return value;
    })
    .nullable();

export const projectSchema = z
  .object({
    name: name("project name"),
    description: text(2000, "The description"),
    websiteUrl: optionalUrl("The website"),
    repositoryUrl: optionalUrl("The repository"),
    status: z.enum(PROJECT_STATUSES, "Choose the project's status."),
    startDate: optionalDate("The start date"),
    endDate: optionalDate("The end date"),
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The end date must be on or after the start date.",
      });
    }
  });

export type ProjectInput = z.infer<typeof projectSchema>;

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "That email address is too long.")
    .pipe(z.email("Enter a complete email address, like name@example.com.")),
  role: z.enum(
    ["admin", "reviewer", "viewer"],
    "Choose a role. Ownership is transferred separately.",
  ),
});

export type InvitationInput = z.infer<typeof invitationSchema>;

export const roleSchema = z.enum(ORGANISATION_ROLES);
