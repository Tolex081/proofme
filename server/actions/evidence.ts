"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getAgentDependencies } from "@/lib/evidence/server";
import { investigateContribution } from "@/server/services/evidence-agent";
import { disconnectGitHubIdentity } from "@/server/services/github-identity";

export type EvidenceActionResult<T = null> =
  { ok: true; value: T } | { ok: false; message: string };

/** The contributor asks the Evidence Agent to investigate their contribution. */
export async function investigateAction(
  contributionId: string,
): Promise<EvidenceActionResult<{ version: number }>> {
  const user = await requireUser(`/dashboard/contributions/${contributionId}`);
  const result = await investigateContribution(
    await getDb(),
    getAgentDependencies(),
    user.id,
    contributionId,
  );
  if (!result.ok) return { ok: false, message: result.errors.form ?? "That did not work." };
  refresh();
  return { ok: true, value: { version: result.value.version } };
}

export async function disconnectGitHubAction(githubUserId: number): Promise<EvidenceActionResult> {
  const user = await requireUser("/dashboard/identity");
  const result = await disconnectGitHubIdentity(await getDb(), user.id, githubUserId);
  if (!result.ok) return { ok: false, message: result.errors.form ?? "That did not work." };
  refresh();
  return { ok: true, value: null };
}
