import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/auth-forms";
import { InvitationResponse } from "@/components/organisations/forms";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/validation/organisation";
import { viewInvitation } from "@/server/services/organisations";

export const metadata: Metadata = {
  title: "Invitation",
  // Invitation links are private. Keep them out of search engines and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Invitation({ params }: PageProps<"/invitations/[token]">) {
  return (
    <main id="main" className="column grid flex-1 place-items-center py-12">
      <div className="w-full max-w-[34rem]">
        <Link href="/" aria-label="Atesta home" className="mb-8 inline-block no-underline">
          <Logo />
        </Link>
        <Suspense fallback={<div className="h-72 animate-pulse rounded-[1.75rem] bg-surface-2" />}>
          <Content params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Content({ params }: Pick<PageProps<"/invitations/[token]">, "params">) {
  const { token } = await params;
  const invitation = await viewInvitation(await getDb(), token);

  if (invitation.state === "invalid") {
    return (
      <div className="card p-7 sm:p-9">
        <h1 className="text-page leading-tight font-extrabold tracking-[-0.03em]">
          This invitation cannot be used
        </h1>
        <p className="mt-3 text-muted">
          It may have expired, been cancelled, or already been answered. Ask the organisation for a
          new one.
        </p>
        <Link href="/" className="action action-secondary mt-6">
          Go to the home page
        </Link>
      </div>
    );
  }

  const user = await getCurrentUser();
  const path = `/invitations/${token}`;
  return (
    <div className="card p-7 sm:p-9">
      <p className="text-note font-semibold text-muted">You are invited to join</p>
      <h1 className="mt-1 text-page leading-tight font-extrabold tracking-[-0.035em]">
        {invitation.organisation.name}
      </h1>
      <p className="mt-4">
        as <span className="font-semibold">{ROLE_LABELS[invitation.role].toLowerCase()}</span>.{" "}
        <span className="text-muted">{ROLE_DESCRIPTIONS[invitation.role]}</span>
      </p>
      <p className="mt-3 text-note text-muted">
        Sent to <span className="font-semibold text-ink">{invitation.email}</span>. Only that
        account can accept it.
      </p>
      <div className="mt-7 border-t border-line pt-6">
        {user ? (
          <div className="grid gap-5">
            <InvitationResponse token={token} />
            <p className="text-note text-muted">
              Signed in as <span className="font-semibold text-ink">{user.email}</span>.{" "}
              <SignOutButton className="text-link" />
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(path)}`}
              className="action action-primary"
            >
              Sign in to respond
            </Link>
            <Link href="/register" className="action action-secondary">
              Create an account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
