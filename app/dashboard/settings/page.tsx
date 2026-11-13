import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { DeleteAccountForm, PrivacyForm, ProfileForm } from "@/components/account/forms";
import { PageHeading, PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { sectionVisibilityOf } from "@/server/services/profile";
import { ResendVerification } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Settings" };

export default function Settings() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const { user, profile } = await requireWorkspace("/dashboard/settings");

  return (
    <>
      <PageHeading title="Settings" intro="Your profile, who can see it, and your account." />
      <div className="grid gap-4">
        <Panel id="profile" title="Profile" intro="What people see on your profile page.">
          <ProfileForm
            initial={{
              displayName: profile.displayName,
              username: profile.username,
              bio: profile.bio,
              location: profile.location,
              websiteUrl: profile.websiteUrl,
              roles: profile.professionalCategories,
              skills: profile.skills,
            }}
          />
        </Panel>

        <Panel
          id="privacy"
          title="Privacy"
          intro="Drafts, pending claims and reviewers' notes are never public, whatever you choose here."
        >
          <PrivacyForm visibility={profile.visibility} sections={sectionVisibilityOf(profile)} />
        </Panel>

        <Panel id="account" title="Account">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-meta font-semibold text-muted">Email</dt>
              <dd className="mt-0.5 font-semibold break-all">{user.email}</dd>
              <dd className="mt-2">
                {user.emailVerified ? (
                  <span className="chip chip-ok">Confirmed</span>
                ) : (
                  <ResendVerification email={user.email} />
                )}
              </dd>
            </div>
            <div>
              <dt className="text-meta font-semibold text-muted">Password</dt>
              <dd className="mt-0.5 text-muted">
                Forgotten it? Sign out and use{" "}
                <a href="/forgot-password" className="text-link">
                  Reset it by email
                </a>{" "}
                on the sign-in page.
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-line pt-6">
            <a href="/api/account/export" download className="action action-secondary">
              <Download aria-hidden="true" size={17} />
              Download my data
            </a>
            <p className="text-note text-muted">
              A JSON file of everything ProofMe holds about you.
            </p>
          </div>
        </Panel>

        <Panel
          id="close"
          tone="danger"
          title="Close your account"
          intro="You will be signed out everywhere and your profile will be hidden at once. Records that organisations have already issued about your work stay checkable, because they are the organisation's statement as well as yours."
        >
          <DeleteAccountForm username={profile.username} />
        </Panel>
      </div>
    </>
  );
}
