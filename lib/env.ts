import { z } from "zod";

/**
 * Server-side environment validation. Variables are added here in the
 * milestone that first uses them, so a missing value fails with a clear
 * message instead of surfacing later as an obscure runtime error.
 * Never log the parsed object: it contains secrets.
 */
const envSchema = z
  .object({
    APP_ENV: z.enum(["local", "preview", "production"]).default("local"),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    // Mainnet is intentionally not accepted in this build (brief section 13.5).
    NEAR_NETWORK: z.enum(["sandbox", "testnet"]).default("testnet"),
    // A PostgreSQL connection string. Optional only for local development,
    // where an embedded PostgreSQL (PGlite) is used instead.
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string")
      .optional(),
    // Where the embedded local database keeps its files. "memory://" keeps
    // nothing, which is what the automated browser tests use.
    PGLITE_DATA_DIR: z.string().min(1).default(".pglite"),
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  })
  .superRefine((value, context) => {
    if (value.APP_ENV !== "local" && !value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "is required outside local development",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

const KEYS = [
  "APP_ENV",
  "NEXT_PUBLIC_APP_URL",
  "NEAR_NETWORK",
  "DATABASE_URL",
  "PGLITE_DATA_DIR",
  "BETTER_AUTH_SECRET",
] as const;

export function parseEnv(source: Record<string, string | undefined>): Env {
  // Empty strings (an unfilled line in an env file) count as unset.
  const input = Object.fromEntries(KEYS.map((key) => [key, source[key] || undefined]));
  const result = envSchema.safeParse(input);
  if (!result.success) {
    // Names and reasons only. Values are never included in the message.
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid environment configuration: ${problems}. See .env.example for what each variable is.`,
    );
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
