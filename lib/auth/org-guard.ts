import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { canInOrganisation, type OrganisationAction } from "../permissions/organisation";
import { getOrganisationForMember } from "@/server/services/organisations";
import { requireWorkspace, type Workspace } from "./guards";

/** One membership lookup per request, shared by the layout and the page. */
const loadAccess = cache((db: Workspace["db"], userId: string, slug: string) =>
  getOrganisationForMember(db, userId, slug),
);

/**
 * For every organisation workspace page. Signed-out visitors go to sign in;
 * signed-in people who are not active members see "not found", exactly as if
 * the organisation did not exist.
 */
export async function requireOrganisation(slug: string, path: string) {
  const workspace = await requireWorkspace(path);
  const access = await loadAccess(workspace.db, workspace.user.id, slug);
  if (!access) notFound();
  const can = (action: OrganisationAction) =>
    canInOrganisation(access.membership, access.organisation.id, action).allowed;
  return { ...workspace, ...access, can };
}
