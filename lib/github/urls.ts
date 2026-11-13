/**
 * Parsing GitHub evidence links into stable references.
 *
 * ProofMe never fetches a URL a contributor typed. It parses the link, accepts
 * only github.com repository, pull request, commit and issue paths with
 * well-formed owner, repository, number and SHA parts, and then builds its
 * own request to api.github.com from those parts.
 */

export type GitHubRef =
  | { kind: "repository"; owner: string; repo: string }
  | { kind: "pull_request"; owner: string; repo: string; number: number }
  | { kind: "issue"; owner: string; repo: string; number: number }
  | { kind: "commit"; owner: string; repo: string; sha: string };

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const NUMBER = /^[1-9][0-9]{0,9}$/;
const SHA = /^[0-9a-f]{7,40}$/i;

export function parseGitHubUrl(value: string): GitHubRef | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
  if (url.username || url.password || url.port) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const [owner, rawRepo, section, id] = parts;
  if (!owner || !rawRepo || !OWNER.test(owner)) return null;
  const repo = rawRepo.replace(/\.git$/, "");
  if (!REPO.test(repo) || repo === "." || repo === "..") return null;
  if (parts.length === 2) return { kind: "repository", owner, repo };
  if (section === "pull" && id && NUMBER.test(id)) {
    return { kind: "pull_request", owner, repo, number: Number(id) };
  }
  if (section === "issues" && id && NUMBER.test(id)) {
    return { kind: "issue", owner, repo, number: Number(id) };
  }
  if (section === "commit" && id && SHA.test(id)) {
    return { kind: "commit", owner, repo, sha: id.toLowerCase() };
  }
  return null;
}

/** A short, stable label for a reference, used in reports. */
export function describeRef(ref: GitHubRef): string {
  const base = `${ref.owner}/${ref.repo}`;
  switch (ref.kind) {
    case "repository":
      return base;
    case "pull_request":
      return `${base} pull request #${ref.number}`;
    case "issue":
      return `${base} issue #${ref.number}`;
    case "commit":
      return `${base} commit ${ref.sha.slice(0, 12)}`;
  }
}
