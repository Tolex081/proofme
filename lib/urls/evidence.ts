/**
 * Evidence URL validation.
 *
 * An evidence URL is a reference a reviewer opens and judges in context. It is
 * never fetched by the server, and passing validation says nothing about
 * whether the page exists, who owns it or what it contains.
 */

export const EVIDENCE_TYPES = [
  "github_repo",
  "github_pr",
  "github_issue",
  "website",
  "document",
  "demo",
  "video",
  "other",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_URL_MAX_LENGTH = 2048;

export type EvidenceUrlError =
  | "empty"
  | "too_long"
  | "illegal_characters"
  | "malformed"
  | "unsupported_scheme"
  | "credentials_not_allowed"
  | "host_not_public";

export type EvidenceUrlResult =
  { ok: true; url: string; host: string } | { ok: false; error: EvidenceUrlError };

export interface EvidenceUrlOptions {
  /** Permit http://localhost style URLs. Local development and tests only. */
  allowLocalHttp?: boolean;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const NON_PUBLIC_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".test"];

// Control characters, whitespace and backslashes. The URL parser silently
// strips tabs and newlines and rewrites backslashes, which is how inputs such
// as "java\nscript:" or "https:\\evil" get past naive checks.
const ILLEGAL_CHARACTERS = /[\u0000- \u007f-\u009f\\]/;

function isPublicHostname(hostname: string): boolean {
  if (LOOPBACK_HOSTS.has(hostname)) return false;
  // IP literals (v4 or bracketed v6) are not accepted as public evidence.
  if (hostname.startsWith("[") || /^[0-9.]+$/.test(hostname)) return false;
  if (NON_PUBLIC_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;
  const labels = hostname.split(".");
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return false;
  const tld = labels[labels.length - 1];
  // Alphabetic TLD, or a punycode one.
  return /^[a-z]{2,}$/.test(tld) || /^xn--[a-z0-9-]+$/.test(tld);
}

export function validateEvidenceUrl(
  input: unknown,
  options: EvidenceUrlOptions = {},
): EvidenceUrlResult {
  if (typeof input !== "string") return { ok: false, error: "malformed" };
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, error: "empty" };
  if (trimmed.length > EVIDENCE_URL_MAX_LENGTH) return { ok: false, error: "too_long" };
  if (ILLEGAL_CHARACTERS.test(trimmed)) return { ok: false, error: "illegal_characters" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "malformed" };
  }

  const isLoopback = LOOPBACK_HOSTS.has(parsed.hostname);
  const schemeAllowed =
    parsed.protocol === "https:" ||
    (parsed.protocol === "http:" && isLoopback && options.allowLocalHttp === true);
  if (!schemeAllowed) return { ok: false, error: "unsupported_scheme" };

  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, error: "credentials_not_allowed" };
  }

  if (isLoopback) {
    if (options.allowLocalHttp !== true) return { ok: false, error: "host_not_public" };
  } else if (!isPublicHostname(parsed.hostname)) {
    return { ok: false, error: "host_not_public" };
  }

  return { ok: true, url: parsed.href, host: displayHost(parsed) };
}

function displayHost(url: URL): string {
  return url.hostname.replace(/^www\./, "");
}

const EVIDENCE_URL_MESSAGES: Record<EvidenceUrlError, string> = {
  empty: "Enter a link.",
  too_long: `Links can be at most ${EVIDENCE_URL_MAX_LENGTH} characters.`,
  illegal_characters: "The link contains spaces or characters that are not allowed.",
  malformed: "This does not look like a complete link. Include https:// at the start.",
  unsupported_scheme: "Only https:// links are accepted.",
  credentials_not_allowed: "Links cannot contain a username or password.",
  host_not_public: "The link must point to a public website.",
};

export function evidenceUrlErrorMessage(error: EvidenceUrlError): string {
  return EVIDENCE_URL_MESSAGES[error];
}

const VIDEO_HOSTS = new Set(["youtube.com", "youtu.be", "vimeo.com", "loom.com"]);

/**
 * Suggests an evidence type from the shape of an already validated URL, so the
 * form can pre-select it. The contributor can always choose a different type.
 * Returns null when nothing can be inferred.
 */
export function suggestEvidenceType(validatedUrl: string): EvidenceType | null {
  const url = new URL(validatedUrl);
  const host = displayHost(url);
  if (host === "github.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length >= 4 && segments[2] === "pull" && /^\d+$/.test(segments[3])) {
      return "github_pr";
    }
    if (segments.length >= 4 && segments[2] === "issues" && /^\d+$/.test(segments[3])) {
      return "github_issue";
    }
    if (segments.length === 2) return "github_repo";
    return null;
  }
  if (VIDEO_HOSTS.has(host)) return "video";
  return null;
}
