import type { Metadata } from "next";
import { Suspense } from "react";

import { InviteForm, MemberControls } from "@/components/organisations/forms";
import { PageHeading, PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";
import { canAssignRole, ORGANISATION_ROLES } from "@/lib/permissions/organisation";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/validation/organisation";
import { revokeInvitationAction } from "@/server/actions/organisations";
import { listMembers, listPendingInvitations } from "@/server/services/organisations";

export const metadata: Metadata = { title: "Team" };

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function Team({ params }: PageProps<"/org/[slug]/team">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/org/[slug]/team">, "params">) {
  const { slug } = await params;
  const { organisation, membership, user, db, can } = await requireOrganisation(
    slug,
    `/org/${slug}/team`,
  );
  const members = (await listMembers(db, user.id, organisation.id)) ?? [];
  const canManage = can("team.manage");
  const invitations = canManage
    ? ((await listPendingInvitations(db, user.id, organisation.id)) ?? [])
    : [];
  const assignable = ORGANISATION_ROLES.filter(
    (role) => canAssignRole(membership.role, role).allowed,
  );

  return (
    <>
      <PageHeading
        title="Team"
        intro="Who can act for this organisation, and what each person may do. Every action is checked on the server against the person's role."
      />
      <div className="grid gap-4">
        <Panel title={`Members (${members.length})`}>
          <ul className="divide-y divide-line">
            {members.map((member) => {
              const isSelf = member.userId === user.id;
              const mayChange =
                canManage &&
                (isSelf ||
                  membership.role === "owner" ||
                  (member.role !== "owner" && member.role !== "admin"));
              return (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-semibold">
                      {member.name}
                      {isSelf ? <span className="font-normal text-muted"> (you)</span> : null}
                    </p>
                    <p className="text-meta text-muted">
                      {member.username ? `@${member.username} · ` : ""}joined{" "}
                      {DAY.format(member.joinedAt)}
                    </p>
                  </div>
                  {mayChange ? (
                    <MemberControls
                      organisationId={organisation.id}
                      userId={member.userId}
                      role={member.role}
                      assignable={isSelf ? [] : assignable}
                      canMakeOwner={membership.role === "owner" && !isSelf}
                      isSelf={isSelf}
                      name={member.name}
                    />
                  ) : (
                    <span className="chip chip-neutral">{ROLE_LABELS[member.role]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        {canManage ? (
          <Panel
            title="Invite someone"
            intro="They join with their existing ProofMe account, or create one with the invited email address."
          >
            <InviteForm
              organisationId={organisation.id}
              canInviteAdmins={membership.role === "owner"}
            />
          </Panel>
        ) : (
          <Panel title="Roles">
            <ul className="grid gap-2">
              {ORGANISATION_ROLES.map((role) => (
                <li key={role}>
                  <span className="font-semibold">{ROLE_LABELS[role]}:</span>{" "}
                  <span className="text-muted">{ROLE_DESCRIPTIONS[role]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-note text-muted">
              Only owners and admins can invite people or change roles.
            </p>
          </Panel>
        )}

        {canManage && invitations.length > 0 ? (
          <Panel title="Waiting for a reply">
            <ul className="divide-y divide-line">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-[12rem] flex-1">
                    <p className="font-semibold break-all">{invitation.email}</p>
                    <p className="text-meta text-muted">
                      {ROLE_LABELS[invitation.role]} · expires {DAY.format(invitation.expiresAt)}
                    </p>
                  </div>
                  <form action={revokeInvitationAction.bind(null, organisation.id, invitation.id)}>
                    <button type="submit" className="action action-secondary">
                      Cancel invitation
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
