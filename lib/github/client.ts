import { z } from "zod";

/**
 * Read-only GitHub API access for the Evidence Agent.
 *
 * Every request goes to https://api.github.com with a path built from parsed,
 * validated parts (see urls.ts); no user-supplied URL is ever fetched. The
 * interface lets services be tested with a stand-in. All text returned
 * (titles, bodies, commit messages) is untrusted data.
 */

export class GitHubUnavailableError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "GitHubUnavailableError";
  }
}

export interface GitHubAccount {
  id: number;
  login: string;
}

export interface GitHubRepository {
  id: number;
  fullName: string;
  htmlUrl: string;
  private: boolean;
  owner: GitHubAccount;
}

export interface GitHubPull {
  repositoryId: number;
  number: number;
  htmlUrl: string;
  title: string;
  body: string;
  state: "open" | "closed";
  createdAt: string;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: GitHubAccount | null;
  author: GitHubAccount | null;
}

export interface GitHubCommit {
  repositoryId: number;
  sha: string;
  htmlUrl: string;
  message: string;
  /** The GitHub account GitHub attributes the authorship to, if any. */
  author: GitHubAccount | null;
  committer: GitHubAccount | null;
  /** Git author and committer names as written in the commit, which anyone can set. */
  gitAuthorName: string | null;
  gitCommitterName: string | null;
  authoredAt: string | null;
  signatureVerified: boolean;
  signatureReason: string | null;
}

export interface GitHubIssue {
  repositoryId: number;
  number: number;
  htmlUrl: string;
  title: string;
  body: string;
  state: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  author: GitHubAccount | null;
  assignees: GitHubAccount[];
  labels: string[];
  isPullRequest: boolean;
}

export interface GitHubReview {
  reviewer: GitHubAccount | null;
  state: string;
}

export interface GitHubReader {
  getRepository(owner: string, repo: string): Promise<GitHubRepository | null>;
  getPull(owner: string, repo: string, number: number): Promise<GitHubPull | null>;
  getPullCommits(owner: string, repo: string, number: number): Promise<GitHubCommit[]>;
  getPullReviews(owner: string, repo: string, number: number): Promise<GitHubReview[]>;
  getCommit(owner: string, repo: string, sha: string): Promise<GitHubCommit | null>;
  getIssue(owner: string, repo: string, number: number): Promise<GitHubIssue | null>;
}

const account = z
  .object({ id: z.number().int(), login: z.string() })
  .nullable()
  .optional()
  .transform((value) => (value ? { id: value.id, login: value.login } : null));

const repositorySchema = z.object({
  id: z.number().int(),
  full_name: z.string(),
  html_url: z.string(),
  private: z.boolean(),
  owner: z.object({ id: z.number().int(), login: z.string() }),
});

const pullSchema = z.object({
  number: z.number().int(),
  html_url: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  created_at: z.string(),
  merged: z.boolean().optional(),
  merged_at: z.string().nullable(),
  merged_by: account,
  user: account,
  base: z.object({ repo: z.object({ id: z.number().int() }) }),
});

const commitSchema = z.object({
  sha: z.string(),
  html_url: z.string(),
  author: account,
  committer: account,
  commit: z.object({
    message: z.string(),
    author: z
      .object({ name: z.string().nullable().optional(), date: z.string().nullable().optional() })
      .nullable(),
    committer: z.object({ name: z.string().nullable().optional() }).nullable(),
    verification: z
      .object({ verified: z.boolean(), reason: z.string().nullable().optional() })
      .nullable()
      .optional(),
  }),
});

const issueSchema = z.object({
  number: z.number().int(),
  html_url: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  user: account,
  assignees: z.array(z.object({ id: z.number().int(), login: z.string() })).default([]),
  labels: z
    .array(z.union([z.string(), z.object({ name: z.string().nullable().optional() })]))
    .default([]),
  pull_request: z.unknown().optional(),
});

const reviewSchema = z.object({ user: account, state: z.string() });

function toCommit(raw: z.infer<typeof commitSchema>, repositoryId: number): GitHubCommit {
  return {
    repositoryId,
    sha: raw.sha,
    htmlUrl: raw.html_url,
    message: raw.commit.message,
    author: raw.author,
    committer: raw.committer,
    gitAuthorName: raw.commit.author?.name ?? null,
    gitCommitterName: raw.commit.committer?.name ?? null,
    authoredAt: raw.commit.author?.date ?? null,
    signatureVerified: raw.commit.verification?.verified ?? false,
    signatureReason: raw.commit.verification?.reason ?? null,
  };
}

type Fetch = typeof fetch;

export function createGitHubReader(options: { token?: string; send?: Fetch } = {}): GitHubReader {
  const send = options.send ?? fetch;

  async function get(path: string): Promise<unknown | null> {
    let response: Response;
    try {
      response = await send(`https://api.github.com${path}`, {
        headers: {
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "ProofMe-Evidence-Agent",
          ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new GitHubUnavailableError("GitHub could not be reached.");
    }
    if (response.status === 404) return null;
    if (response.status === 403 || response.status === 429) {
      throw new GitHubUnavailableError("GitHub's rate limit was reached.", response.status);
    }
    if (!response.ok) {
      throw new GitHubUnavailableError(
        `GitHub answered with status ${response.status}.`,
        response.status,
      );
    }
    return response.json().catch(() => {
      throw new GitHubUnavailableError("GitHub gave an unreadable answer.");
    });
  }

  const enc = encodeURIComponent;

  async function repositoryId(owner: string, repo: string): Promise<number | null> {
    const raw = await get(`/repos/${enc(owner)}/${enc(repo)}`);
    return raw ? repositorySchema.parse(raw).id : null;
  }

  return {
    async getRepository(owner, repo) {
      const raw = await get(`/repos/${enc(owner)}/${enc(repo)}`);
      if (!raw) return null;
      const value = repositorySchema.parse(raw);
      return {
        id: value.id,
        fullName: value.full_name,
        htmlUrl: value.html_url,
        private: value.private,
        owner: { id: value.owner.id, login: value.owner.login },
      };
    },
    async getPull(owner, repo, number) {
      const raw = await get(`/repos/${enc(owner)}/${enc(repo)}/pulls/${number}`);
      if (!raw) return null;
      const value = pullSchema.parse(raw);
      return {
        repositoryId: value.base.repo.id,
        number: value.number,
        htmlUrl: value.html_url,
        title: value.title,
        body: value.body ?? "",
        state: value.state,
        createdAt: value.created_at,
        merged: value.merged ?? value.merged_at !== null,
        mergedAt: value.merged_at,
        mergedBy: value.merged_by,
        author: value.user,
      };
    },
    async getPullCommits(owner, repo, number) {
      const id = await repositoryId(owner, repo);
      const raw = await get(
        `/repos/${enc(owner)}/${enc(repo)}/pulls/${number}/commits?per_page=100`,
      );
      if (!raw || id === null) return [];
      return z
        .array(commitSchema)
        .parse(raw)
        .map((item) => toCommit(item, id));
    },
    async getPullReviews(owner, repo, number) {
      const raw = await get(
        `/repos/${enc(owner)}/${enc(repo)}/pulls/${number}/reviews?per_page=100`,
      );
      if (!raw) return [];
      return z
        .array(reviewSchema)
        .parse(raw)
        .map((item) => ({ reviewer: item.user, state: item.state }));
    },
    async getCommit(owner, repo, sha) {
      const id = await repositoryId(owner, repo);
      if (id === null) return null;
      const raw = await get(`/repos/${enc(owner)}/${enc(repo)}/commits/${enc(sha)}`);
      return raw ? toCommit(commitSchema.parse(raw), id) : null;
    },
    async getIssue(owner, repo, number) {
      const id = await repositoryId(owner, repo);
      if (id === null) return null;
      const raw = await get(`/repos/${enc(owner)}/${enc(repo)}/issues/${number}`);
      if (!raw) return null;
      const value = issueSchema.parse(raw);
      return {
        repositoryId: id,
        number: value.number,
        htmlUrl: value.html_url,
        title: value.title,
        body: value.body ?? "",
        state: value.state,
        createdAt: value.created_at,
        closedAt: value.closed_at,
        author: value.user,
        assignees: value.assignees.map((item) => ({ id: item.id, login: item.login })),
        labels: value.labels
          .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
          .filter(Boolean),
        isPullRequest: value.pull_request !== undefined,
      };
    },
  };
}

/**
 * The account behind an OAuth access token: GET /user. Used once, at linking,
 * and only its numeric ID and login are kept. The token itself is discarded.
 */
export async function fetchAuthenticatedAccount(
  token: string,
  send: Fetch = fetch,
): Promise<GitHubAccount> {
  let response: Response;
  try {
    response = await send("https://api.github.com/user", {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "ProofMe-Evidence-Agent",
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new GitHubUnavailableError("GitHub could not be reached.");
  }
  if (!response.ok)
    throw new GitHubUnavailableError("GitHub did not confirm the account.", response.status);
  const value = z
    .object({ id: z.number().int().positive(), login: z.string().min(1) })
    .parse(await response.json());
  return { id: value.id, login: value.login };
}
