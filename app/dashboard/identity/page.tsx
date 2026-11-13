import type { Metadata } from "next";
import { Suspense } from "react";

import { IdentityForm } from "@/components/account/forms";
import { NearAccountProof } from "@/components/near/account-proof";
import { PageHeading, PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Identity" };

export default function Identity() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <IdentityContent />
    </Suspense>
  );
}

async function IdentityContent() {
  const { profile } = await requireWorkspace("/dashboard/identity");
  const links = profile.socialLinks;

  return (
    <>
      <PageHeading
        title="Identity"
        intro="Where else people can find you and your work. Everything here is optional."
      />
      <div className="grid gap-4">
        <Panel
          title="Links"
          intro="These are links you add yourself. ProofMe shows them as you entered them and does not check that they are yours."
        >
          <IdentityForm
            initial={{
              github: links.github ?? "",
              x: links.x ?? "",
              linkedin: links.linkedin ?? "",
              other: links.other ?? "",
            }}
          />
        </Panel>
        <Panel
          title="Your NEAR account"
          intro="Approved work is issued to this account as an NFT credential that cannot be transferred. ProofMe records it only after your wallet signs a one-time message, so nobody can name an account that is not theirs. Signing is not a transaction and moves no funds. ProofMe never asks for a seed phrase or private key."
        >
          <NearAccountProof
            accountId={profile.nearAccountId}
            verified={Boolean(profile.nearAccountVerifiedAt)}
          />
        </Panel>
      </div>
    </>
  );
}
