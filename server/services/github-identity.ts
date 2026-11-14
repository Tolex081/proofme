import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { auditEvents, githubIdentities, githubOauthStates } from "@/lib/db/schema";
import type { GitHubAccount } from "@/lib/github/client";

/**
 * Linking GitHub accounts to Atesta users.
 *
 * The identity key is GitHub's immutable numeric user ID, taken from GitHub's
 * own answer to the OAuth access token. Logins are display only; emails,
 * profile URLs and anything the browser sends are never used to identify an
 * account. The unique index on github_identities.github_user_id makes the
 * database the final authority: one GitHub account belongs to one Atesta
 * user, even when two link attempts race. Database triggers stop an identity
 * being deleted, moved to another user, or claimed after its owner's account
 * was deleted.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };
const fail = (form: string) => ({ ok: false as const, errors: { form } });

const STATE_TTL_MS = 10 * 60 * 1000;
export const ALREADY_LINKED =
  "That GitHub account is already linked to another Atesta account. It cannot be linked twice.";

async function audit(
  db: Database,
  actorUserId: string | null,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  await db.insert(auditEvents).values({
    actorUserId,
    organisationId: null,
    action,
    entityType: "github_identity",
    entityId,
    metadata,
  });
}

function sha256(value: string, encoding: "hex" | "base64url" = "hex"): string {
  return createHash("sha256").update(value).digest(encoding);
}

function isUniqueViolation(error: unknown): boolean {
  const code =
    (error as { code?: string; cause?: { code?: string } })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

/**
 * Starts linking: a single-use state bound to this user, and a PKCE verifier
 * kept on the server. Returns the GitHub authorisation URL. No scopes are
 * requested: the public profile is all Atesta reads.
 */
export async function startGitHubLink(
  db: Database,
  userId: string,
  input: { clientId: string; redirectUri: string },
): Promise<{ url: string }> {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  await db.insert(githubOauthStates).values({
    stateHash: sha256(state),
    userId,
    codeVerifier,
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "");
  url.searchParams.set("allow_signup", "false");
  url.searchParams.set("code_challenge", sha256(codeVerifier, "base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  return { url: url.toString() };
}

/**
 * Uses up an OAuth state. It must exist, belong to this signed-in user, be
 * unexpired and unused; marking it used is atomic, so a replayed callback
 * fails. Returns the PKCE verifier for the code exchange.
 */
export async function consumeGitHubState(
  db: Database,
  userId: string,
  state: unknown,
): Promise<Result<{ codeVerifier: string }>> {
  if (typeof state !== "string" || state.length < 20 || state.length > 200) {
    return fail("That GitHub sign-in link is not valid. Start again.");
  }
  const used = await db
    .update(githubOauthStates)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(githubOauthStates.stateHash, sha256(state)),
        eq(githubOauthStates.userId, userId),
        isNull(githubOauthStates.usedAt),
        gt(githubOauthStates.expiresAt, new Date()),
      ),
    )
    .returning({ codeVerifier: githubOauthStates.codeVerifier });
  if (used.length === 0) {
    return fail(
      "That GitHub sign-in link has expired, was already used, or is not yours. Start again.",
    );
  }
  return { ok: true, value: { codeVerifier: used[0].codeVerifier } };
}

/**
 * Links the GitHub account GitHub itself reported for the access token.
 *
 * - First time: the identity is recorded for this user.
 * - Already this user's (connected or disconnected): reconnected; a changed
 *   login updates the display name, never the identity.
 * - Anyone else's, or reserved after an account deletion: refused.
 * Two simultaneous attempts for one GitHub account: the unique index lets
 * exactly one insert succeed.
 */
export async function linkGitHubIdentity(
  db: Database,
  userId: string,
  account: GitHubAccount,
): Promise<Result<{ githubUserId: number; login: string; reconnected: boolean }>> {
  if (!Number.isSafeInteger(account.id) || account.id <= 0 || !account.login) {
    return fail("GitHub did not report a valid account.");
  }
  const [existing] = await db
    .select()
    .from(githubIdentities)
    .where(eq(githubIdentities.githubUserId, account.id));
  if (existing) {
    if (existing.userId !== userId) {
      await audit(db, userId, "github_identity.link_refused", existing.id, {
        githubUserId: account.id,
        reason: existing.status === "reserved" ? "reserved" : "linked_to_another_user",
      });
      return fail(ALREADY_LINKED);
    }
    await db
      .update(githubIdentities)
      .set({
        login: account.login,
        status: "connected",
        disconnectedAt: null,
        lastVerifiedAt: new Date(),
      })
      .where(eq(githubIdentities.id, existing.id));
    await audit(db, userId, "github_identity.reconnected", existing.id, {
      githubUserId: account.id,
      login: account.login,
      previousLogin: existing.login,
    });
    return {
      ok: true,
      value: { githubUserId: account.id, login: account.login, reconnected: true },
    };
  }
  try {
    const [created] = await db
      .insert(githubIdentities)
      .values({ githubUserId: account.id, userId, login: account.login })
      .returning();
    await audit(db, userId, "github_identity.linked", created.id, {
      githubUserId: account.id,
      login: account.login,
    });
    return {
      ok: true,
      value: { githubUserId: account.id, login: account.login, reconnected: false },
    };
  } catch (error) {
    // Someone linked the same GitHub account a moment ago.
    if (isUniqueViolation(error)) return fail(ALREADY_LINKED);
    throw error;
  }
}

/**
 * Disconnects a GitHub account. The ownership record stays: the identity is
 * still this user's and nobody else can link it.
 */
export async function disconnectGitHubIdentity(
  db: Database,
  userId: string,
  githubUserId: number,
): Promise<Result<null>> {
  const updated = await db
    .update(githubIdentities)
    .set({ status: "disconnected", disconnectedAt: new Date() })
    .where(
      and(
        eq(githubIdentities.githubUserId, githubUserId),
        eq(githubIdentities.userId, userId),
        eq(githubIdentities.status, "connected"),
      ),
    )
    .returning({ id: githubIdentities.id });
  if (updated.length === 0) return fail("That GitHub account is not connected to you.");
  await audit(db, userId, "github_identity.disconnected", updated[0].id, { githubUserId });
  return { ok: true, value: null };
}

export async function listGitHubIdentities(db: Database, userId: string) {
  return db
    .select({
      githubUserId: githubIdentities.githubUserId,
      login: githubIdentities.login,
      status: githubIdentities.status,
      connectedAt: githubIdentities.connectedAt,
      lastVerifiedAt: githubIdentities.lastVerifiedAt,
    })
    .from(githubIdentities)
    .where(eq(githubIdentities.userId, userId));
}

/** The user's connected GitHub accounts, for attribution checks. */
export async function connectedGitHubAccounts(db: Database, userId: string) {
  return db
    .select({ id: githubIdentities.githubUserId, login: githubIdentities.login })
    .from(githubIdentities)
    .where(and(eq(githubIdentities.userId, userId), eq(githubIdentities.status, "connected")));
}

/**
 * Exchanges an OAuth code for a token, server-side, with the PKCE verifier.
 * The token is used once to read the account and then discarded; it is never
 * stored or sent to the browser.
 */
export async function exchangeGitHubCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  send?: typeof fetch;
}): Promise<string> {
  const send = input.send ?? fetch;
  const response = await send("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => null)) as { access_token?: unknown } | null;
  if (!response.ok || typeof body?.access_token !== "string") {
    throw new Error("GitHub did not accept the sign-in code.");
  }
  return body.access_token;
}
