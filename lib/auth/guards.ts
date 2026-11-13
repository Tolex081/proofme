import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getDb, type Database } from "../db/client";
import { getProfileByUserId, isOnboarded, type Profile } from "@/server/services/profile";
import { getCurrentUser, requireUser, type CurrentUser } from "./session";

export interface Workspace {
  user: CurrentUser;
  profile: Profile;
  db: Database;
}

/**
 * The signed-in user's profile, loaded once per request however many parts of
 * the page ask (the account menu, the side menu and the page itself).
 */
const loadWorkspace = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = await getDb();
  const profile = await getProfileByUserId(db, user.id);
  return { user, profile, db };
});

/**
 * For every page inside the workspace: a signed-in user who has finished
 * onboarding. Anyone else is sent to sign in, or to finish setting up.
 */
export async function requireWorkspace(returnTo: string): Promise<Workspace> {
  const loaded = await loadWorkspace();
  if (!loaded) await requireUser(returnTo);
  const { user, profile, db } = loaded!;
  if (!isOnboarded(profile)) redirect("/onboarding");
  return { user, profile, db };
}
