import "server-only";

import { getEnv } from "../env";
import { createGitHubReader } from "../github/client";
import { createNearAiAnalyst } from "./analyst";

/** The Evidence Agent's live dependencies, from the environment. */
export function getAgentDependencies() {
  const env = getEnv();
  return {
    github: createGitHubReader({ token: env.GITHUB_API_TOKEN }),
    analyst: env.NEAR_AI_API_KEY
      ? createNearAiAnalyst({
          apiKey: env.NEAR_AI_API_KEY,
          baseUrl: env.NEAR_AI_BASE_URL,
          model: env.NEAR_AI_MODEL,
        })
      : null,
  };
}

export function isGitHubLinkingConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}
