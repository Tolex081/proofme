import "server-only";

import { redirect } from "next/navigation";

import { getDb, type Database } from "../db/client";
import { getProfileByUserId, isOnboarded, type Profile } from "@/server/services/profile";
import { requireUser, type CurrentUser } from "./session";

export interface Workspace {
  user: CurrentUser;
  profile: Profile;
  db: Database;
}

/**
 * For every page inside the workspace: a signed-in user who has finished
 * onboarding. Anyone else is sent to sign in, or to finish setting up.
 */
export async function requireWorkspace(returnTo: string): Promise<Workspace> {
  const user = await requireUser(returnTo);
  const db = await getDb();
  const profile = await getProfileByUserId(db, user.id);
  if (!isOnboarded(profile)) redirect("/onboarding");
  return { user, profile, db };
}
