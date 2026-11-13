import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";

import { getDbHandle } from "../db/client";
import * as schema from "../db/schema";
import {
  passwordResetEmail,
  sendEmail,
  verificationCodeEmail,
  type EmailConfig,
} from "../email/send";
import { getEnv } from "../env";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** Whether password reset and verification emails can be sent on this deployment. */
export function isEmailConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.BREVO_API_KEY && env.EMAIL_FROM);
}

function createAuth() {
  const env = getEnv();
  const email: EmailConfig | null =
    env.BREVO_API_KEY && env.EMAIL_FROM
      ? { apiKey: env.BREVO_API_KEY, from: env.EMAIL_FROM, fromName: "ProofMe" }
      : null;
  // Sent without waiting, so how long a request takes never reveals whether
  // an account exists. Failures are logged without the address or link.
  const deliver = (message: Parameters<typeof sendEmail>[1]) => {
    if (!email) return;
    void sendEmail(email, message).catch((error: unknown) => {
      console.error("Account email not sent:", error instanceof Error ? error.message : "unknown");
    });
  };

  return betterAuth({
    appName: "ProofMe",
    baseURL: env.NEXT_PUBLIC_APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDbHandle(), { provider: "pg", usePlural: true, schema }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      // Where email can be sent, a new account must confirm its address with
      // a 6-digit code before it can be used. Locally and in automated tests
      // nothing can be emailed, so nothing is required there.
      requireEmailVerification: email !== null,
      resetPasswordTokenExpiresIn: 60 * 60,
      // A reset signs out every other session on the account.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: email
        ? async ({ user, url }) => deliver(passwordResetEmail(user.email, url))
        : undefined,
    },

    emailVerification: email
      ? {
          // Signing in before confirming sends a fresh code.
          sendOnSignIn: true,
          autoSignInAfterVerification: true,
        }
      : undefined,

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
        "/request-password-reset": { window: 60 * 60, max: 5 },
        "/reset-password": { window: 60 * 60, max: 10 },
        "/send-verification-email": { window: 60 * 60, max: 5 },
        "/email-otp/send-verification-otp": { window: 60 * 60, max: 6 },
        "/email-otp/verify-email": { window: 60 * 15, max: 10 },
      },
    },

    advanced: {
      useSecureCookies: env.APP_ENV !== "local",
    },

    plugins: [
      ...(email
        ? [
            emailOTP({
              otpLength: 6,
              expiresIn: 10 * 60,
              allowedAttempts: 5,
              storeOTP: "hashed",
              sendVerificationOnSignUp: true,
              // The confirmation email carries a code, not a link.
              overrideDefaultEmailVerification: true,
              sendVerificationOTP: async ({ email: to, otp, type }) => {
                if (type === "email-verification") deliver(verificationCodeEmail(to, otp));
              },
            }),
          ]
        : []),
      // Must stay last: it lets server actions set the session cookie.
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalStore = globalThis as typeof globalThis & { __proofmeAuth?: Auth };

export function getAuth(): Auth {
  globalStore.__proofmeAuth ??= createAuth();
  return globalStore.__proofmeAuth;
}
