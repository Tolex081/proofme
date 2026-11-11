import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { databaseReady } from "../db/client";
import { getAuth } from "./server";

/** The narrow view of the signed-in person that the rest of the app works with. */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: boolean;
}

/**
 * Reads and validates the session against the database. Cached for the length
 * of one request, so a layout and its page do not look it up twice.
 * Returns null when nobody is signed in or the account is not active.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Read the request first: while prerendering this postpones the work to
  // request time, so the database is never opened at build time.
  const requestHeaders = await headers();
  await databaseReady();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;

  const { user } = session;
  if (user.status !== "active") return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isPlatformAdmin: user.isPlatformAdmin === true,
  };
});

/**
 * For every private page and server action: returns the signed-in user or
 * sends the visitor to sign in. This is the access control. Hiding a link in
 * the interface is not.
 */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}
