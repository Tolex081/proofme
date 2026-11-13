"use client";

import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Browser-side sign-up, sign-in, sign-out and email codes. Same origin; no base URL needed. */
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
