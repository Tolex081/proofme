import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PublicProfileView } from "@/components/profile/public-profile";
import { getDb } from "@/lib/db/client";
import { getPublicProfile } from "@/server/services/profile";

export const metadata: Metadata = { title: "Profile" };

export default function PublicProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <div className="column pt-4 pb-20 lg:pt-8">
      <div className="mx-auto max-w-[56rem]">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-[1.75rem] bg-surface-2" />}>
          <ProfileContent params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function ProfileContent({ params }: Pick<PageProps<"/u/[username]">, "params">) {
  const { username } = await params;
  const profile = await getPublicProfile(await getDb(), decodeURIComponent(username));
  // A private, unfinished or missing profile all look the same from outside.
  if (!profile) notFound();
  return <PublicProfileView profile={profile} />;
}
