import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDbHandle } from "../db/client";
import * as schema from "../db/schema";
import { getEnv } from "../env";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

function createAuth() {
  const env = getEnv();

  return betterAuth({
    appName: "ProofMe",
    baseURL: env.NEXT_PUBLIC_APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDbHandle(), { provider: "pg", usePlural: true, schema }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      // No email provider is configured yet, so verification and password
      // reset emails cannot be sent. Both are enabled when one is.
      requireEmailVerification: false,
    },

    user: {
      additionalFields: {
        // `input: false`: these can never be set from a sign-up or update request.
        status: { type: "string", required: false, defaultValue: "active", input: false },
        isPlatformAdmin: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },

    databaseHooks: {
      user: {
        create: {
          // Local development and automated tests only: an account whose email
          // is listed in PROOFME_LOCAL_ADMIN_EMAIL (comma-separated) becomes a
          // platform administrator when it signs up. Ignored everywhere else;
          // real environments use `npm run admin:grant`.
          before: async (user) => {
            if (env.APP_ENV !== "local") return;
            const admins = (process.env.PROOFME_LOCAL_ADMIN_EMAIL ?? "")
              .split(",")
              .map((email) => email.trim().toLowerCase())
              .filter(Boolean);
            if (!admins.includes(user.email.toLowerCase())) return;
            return { data: { ...user, isPlatformAdmin: true } };
          },
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
    },

    // Stored in the database so limits hold across serverless instances.
    // Off in local development and automated tests, on everywhere else.
    rateLimit: {
      enabled: env.APP_ENV !== "local",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60 * 60, max: 10 },
      },
    },

    advanced: {
      useSecureCookies: env.APP_ENV !== "local",
    },

    // Must stay last: it lets server actions set the session cookie.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalStore = globalThis as typeof globalThis & { __proofmeAuth?: Auth };

export function getAuth(): Auth {
  globalStore.__proofmeAuth ??= createAuth();
  return globalStore.__proofmeAuth;
}
