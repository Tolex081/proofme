import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingForm } from "@/components/account/forms";
import { AccountMenu } from "@/components/workspace/shell";
import { PageSkeleton, WorkspaceTopBar } from "@/components/workspace/parts";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { USERNAME_PATTERN } from "@/lib/validation/profile";
import { getProfileByUserId, isOnboarded, isUsernameAvailable } from "@/server/services/profile";

export const metadata: Metadata = { title: "Set up your profile" };

export default function Onboarding() {
  return (
    <>
      <WorkspaceTopBar
        account={
          <Suspense fallback={null}>
            <OnboardingAccount />
          </Suspense>
        }
      />
      <main id="main" className="column flex-1 py-8 lg:py-14">
        <div className="mx-auto max-w-[52rem]">
          <Suspense fallback={<PageSkeleton />}>
            <OnboardingContent />
          </Suspense>
        </div>
      </main>
    </>
  );
}

function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

async function OnboardingContent() {
  const user = await requireUser("/onboarding");
  const db = await getDb();
  if (isOnboarded(await getProfileByUserId(db, user.id))) redirect("/dashboard");

  const base = slugify(user.name);
  const suggestion =
    USERNAME_PATTERN.test(base) && (await isUsernameAvailable(db, base, user.id)) ? base : "";

  return (
    <>
      <div className="mb-8">
        <div>
          <h1 className="text-heading leading-[1.02] font-extrabold tracking-[-0.04em]">
            Set up your <span className="marker">profile</span>.
          </h1>
          <p className="mt-3 max-w-[40rem] text-muted">
            A few details so people know whose work they are looking at. Only the name and username
            are needed now.
          </p>
        </div>
      </div>
      <div className="card p-6 sm:p-9">
        <OnboardingForm suggestedName={user.name} suggestedUsername={suggestion} />
      </div>
    </>
  );
}

async function OnboardingAccount() {
  const user = await requireUser("/onboarding");
  return <AccountMenu name={user.name} username={user.email} />;
}
