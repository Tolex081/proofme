import { z } from "zod";

/**
 * Server-side environment validation. Variables are added here in the
 * milestone that first uses them, so a missing value fails with a clear
 * message instead of surfacing later as an obscure runtime error.
 * Never log the parsed object: later milestones add secrets to it.
 */
const envSchema = z.object({
  APP_ENV: z.enum(["local", "preview", "production"]).default("local"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  // Mainnet is intentionally not accepted in this build (brief section 13.5).
  NEAR_NETWORK: z.enum(["sandbox", "testnet"]).default("testnet"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse({
    APP_ENV: source.APP_ENV || undefined,
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL || undefined,
    NEAR_NETWORK: source.NEAR_NETWORK || undefined,
  });
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration. ${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
