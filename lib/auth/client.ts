"use client";

import { createAuthClient } from "better-auth/react";

/** Browser-side sign-up, sign-in and sign-out. Same origin; no base URL needed. */
export const authClient = createAuthClient();
