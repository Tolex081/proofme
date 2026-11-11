import "server-only";

import { notFound } from "next/navigation";

import { isPlatformAdmin } from "@/server/services/admin";
import { requireWorkspace } from "./guards";

/**
 * For every admin page. Signed-out visitors go to sign in; anyone signed in
 * who is not an active platform administrator sees "not found", so the admin
 * area does not reveal that it exists.
 */
export async function requireAdmin(path: string) {
  const workspace = await requireWorkspace(path);
  if (!(await isPlatformAdmin(workspace.db, workspace.user.id))) notFound();
  return workspace;
}
