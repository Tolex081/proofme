import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { startGitHubLink } from "@/server/services/github-identity";

/** Starts linking a GitHub account to the signed-in Atesta user. */
export async function GET() {
  // Runs per request: never prerendered at build time.
  await connection();
  const env = getEnv();
  const back = new URL("/dashboard/identity", env.NEXT_PUBLIC_APP_URL);
  const user = await getCurrentUser();
  if (!user)
    return Response.redirect(
      new URL("/login?next=%2Fdashboard%2Fidentity", env.NEXT_PUBLIC_APP_URL),
      303,
    );
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    back.searchParams.set("github", "not_configured");
    return Response.redirect(back, 303);
  }
  const { url } = await startGitHubLink(await getDb(), user.id, {
    clientId: env.GITHUB_CLIENT_ID,
    redirectUri: new URL("/api/github/callback", env.NEXT_PUBLIC_APP_URL).toString(),
  });
  return Response.redirect(url, 303);
}
