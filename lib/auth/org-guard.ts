import "server-only";

import { notFound } from "next/navigation";

import { canInOrganisation, type OrganisationAction } from "../permissions/organisation";
import { getOrganisationForMember } from "@/server/services/organisations";
import { requireWorkspace } from "./guards";

/**
 * For every organisation workspace page. Signed-out visitors go to sign in;
 * signed-in people who are not active members see "not found", exactly as if
 * the organisation did not exist.
 */
export async function requireOrganisation(slug: string, path: string) {
  const workspace = await requireWorkspace(path);
  const access = await getOrganisationForMember(workspace.db, workspace.user.id, slug);
  if (!access) notFound();
  const can = (action: OrganisationAction) =>
    canInOrganisation(access.membership, access.organisation.id, action).allowed;
  return { ...workspace, ...access, can };
}
