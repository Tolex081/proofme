import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { fetchAuthenticatedAccount } from "@/lib/github/client";
import {
  consumeGitHubState,
  exchangeGitHubCode,
  linkGitHubIdentity,
} from "@/server/services/github-identity";

/**
 * GitHub sends the user back here. The ProofMe user comes from the session,
 * the state must be this user's unused one, the code is exchanged on the
 * server with the PKCE verifier, and the account linked is whatever GitHub
 * reports for that token. Nothing in the query string names an account.
 */
export async function GET(request: Request) {
  const env = getEnv();
  const back = new URL("/dashboard/identity", env.NEXT_PUBLIC_APP_URL);
  const done = (outcome: string) => {
    back.searchParams.set("github", outcome);
    return Response.redirect(back, 303);
  };
  const user = await getCurrentUser();
  if (!user) return done("signed_out");
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return done("not_configured");

  const params = new URL(request.url).searchParams;
  const db = await getDb();
  const state = await consumeGitHubState(db, user.id, params.get("state"));
  if (!state.ok) return done("invalid_state");
  const code = params.get("code");
  if (!code || code.length > 200) return done("cancelled");

  try {
    const token = await exchangeGitHubCode({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      code,
      codeVerifier: state.value.codeVerifier,
      redirectUri: new URL("/api/github/callback", env.NEXT_PUBLIC_APP_URL).toString(),
    });
    const account = await fetchAuthenticatedAccount(token);
    const linked = await linkGitHubIdentity(db, user.id, account);
    return done(linked.ok ? (linked.value.reconnected ? "reconnected" : "linked") : "taken");
  } catch {
    return done("failed");
  }
}
