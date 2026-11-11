import { ExternalLink, Eye, EyeOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PublicProfileView } from "@/components/profile/public-profile";
import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { listPublicContributions } from "@/server/services/contributions";
import { publicViewOf } from "@/server/services/profile";

export const metadata: Metadata = { title: "Portfolio" };

export default function Portfolio() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PortfolioContent />
    </Suspense>
  );
}

async function PortfolioContent() {
  const { user, profile, db } = await requireWorkspace("/dashboard/portfolio");
  const contributions = await listPublicContributions(db, user.id);
  const isPublic = profile.visibility === "public";
  const path = `/u/${profile.username}`;

  return (
    <>
      <PageHeading
        title="Portfolio"
        intro="A preview of your profile as a visitor would see it, with your privacy choices applied."
      />

      <div className="card mb-4 flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <span
          className={`grid size-11 flex-none place-items-center rounded-2xl ${isPublic ? "bg-ok text-ok-ink" : "bg-surface-2 text-muted"}`}
        >
          {isPublic ? (
            <Eye aria-hidden="true" size={20} />
          ) : (
            <EyeOff aria-hidden="true" size={20} />
          )}
        </span>
        <div className="min-w-[12rem] flex-1">
          <p className="font-semibold">
            {isPublic ? "Your profile is public" : "Your profile is private"}
          </p>
          <p className="text-note text-muted">
            {isPublic ? (
              <>
                Anyone with the link can see it at <span className="digest text-ink">{path}</span>
              </>
            ) : (
              "Only you can see it. Visitors to your link see a page that does not exist."
            )}
          </p>
        </div>
        {isPublic ? (
          <Link href={path} target="_blank" className="action action-secondary">
            Open public page <ExternalLink aria-hidden="true" size={15} />
          </Link>
        ) : null}
        <Link href="/dashboard/settings#privacy" className="action action-primary">
          {isPublic ? "Change visibility" : "Make it public"}
        </Link>
      </div>

      <p className="mb-3 text-meta font-semibold text-muted">Preview</p>
      <PublicProfileView profile={publicViewOf(profile)} contributions={contributions} embedded />
    </>
  );
}
