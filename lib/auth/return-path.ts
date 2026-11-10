/**
 * Only same-site paths are accepted as a place to return to after signing in,
 * so a crafted link cannot bounce someone to another website.
 */
export function safeReturnPath(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value;
}
