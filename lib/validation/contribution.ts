import { z } from "zod";

import { CONTRIBUTION_CATEGORIES } from "../attestations/payload";
import { EVIDENCE_TYPES, evidenceUrlErrorMessage, validateEvidenceUrl } from "../urls/evidence";

/**
 * Contribution input rules, shared by forms (for messages) and services (for
 * enforcement). Pure: no database, no request.
 */

export const CATEGORY_LABELS: Record<(typeof CONTRIBUTION_CATEGORIES)[number], string> = {
  development: "Development",
  design: "Design",
  research: "Research",
  community_management: "Community management",
  content_documentation: "Content and documentation",
  product_management: "Product management",
  project_management: "Project management",
  mentorship: "Mentorship",
  governance: "Governance",
  hackathon_achievement: "Hackathon achievement",
  other: "Other",
};

export const EVIDENCE_TYPE_LABELS: Record<(typeof EVIDENCE_TYPES)[number], string> = {
  github_repo: "GitHub repository",
  github_pr: "GitHub pull request",
  github_issue: "GitHub issue",
  website: "Project website",
  document: "Public document",
  demo: "Demo",
  video: "Video",
  other: "Other link",
};

export const MAX_EVIDENCE = 10;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters.`)
    .transform((value) => value.normalize("NFC"));

const optionalDate = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === "") return null;
      const parsed = new Date(`${value}T00:00:00Z`);
      // Round-trip check: JavaScript quietly turns 31 February into 3 March.
      const real =
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value;
      if (!real) {
        context.addIssue({ code: "custom", message: `${label} must be a real date.` });
        return z.NEVER;
      }
      return value;
    })
    .nullable();

export const evidenceItemSchema = z.object({
  type: z.enum(EVIDENCE_TYPES, "Choose what kind of link this is."),
  url: z
    .string()
    .trim()
    .transform((value, context) => {
      const result = validateEvidenceUrl(value);
      if (!result.ok) {
        context.addIssue({ code: "custom", message: evidenceUrlErrorMessage(result.error) });
        return z.NEVER;
      }
      return result.url;
    }),
  label: z
    .string()
    .trim()
    .min(1, "Describe the link in a few words, for example “Pull request #42”.")
    .max(120, "A link description can be at most 120 characters.")
    .transform((value) => value.normalize("NFC")),
});

export type EvidenceInput = z.infer<typeof evidenceItemSchema>;

const today = () => new Date().toISOString().slice(0, 10);

export const contributionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Give the contribution a title of at least 3 characters.")
      .max(160, "The title can be at most 160 characters.")
      .transform((value) => value.normalize("NFC")),
    summary: optionalText(400, "The summary"),
    description: optionalText(8000, "The description"),
    category: z.enum(CONTRIBUTION_CATEGORIES, "Choose the kind of work."),
    role: optionalText(120, "Your role"),
    skills: z
      .array(z.string().trim().min(1).max(40, "A skill can be at most 40 characters."))
      .max(15, "List up to 15 skills.")
      .transform((values) => [...new Set(values.map((value) => value.normalize("NFC")))]),
    startDate: optionalDate("The start date"),
    endDate: optionalDate("The end date"),
    visibility: z.enum(["public", "private"]),
    evidence: z.array(evidenceItemSchema).max(MAX_EVIDENCE, `Add up to ${MAX_EVIDENCE} links.`),
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The end date must be on or after the start date.",
      });
    }
    for (const [key, label] of [
      ["startDate", "The start date"],
      ["endDate", "The end date"],
    ] as const) {
      const date = value[key];
      if (date && date > today()) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${label} cannot be in the future.`,
        });
      }
    }
    const urls = value.evidence.map((item) => item.url);
    const duplicate = urls.findIndex((url, index) => urls.indexOf(url) !== index);
    if (duplicate >= 0) {
      context.addIssue({
        code: "custom",
        path: ["evidence", duplicate, "url"],
        message: "This link is already listed.",
      });
    }
  });

export type ContributionInput = z.infer<typeof contributionSchema>;

/** What must be true before a contribution can stand on its own as a record. */
export function readinessProblems(input: {
  summary: string;
  description: string;
  role: string;
  evidenceCount: number;
}): string[] {
  const problems: string[] = [];
  if (input.summary.trim().length === 0) problems.push("Add a one-line summary.");
  if (input.description.trim().length === 0) problems.push("Describe what you did.");
  if (input.role.trim().length === 0) problems.push("Say what your role was.");
  if (input.evidenceCount === 0) problems.push("Add at least one evidence link.");
  return problems;
}

/** Field path → first message. Evidence errors use keys like "evidence.0.url". */
export function contributionFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
