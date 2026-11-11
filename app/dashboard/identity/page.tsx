import type { Metadata } from "next";
import { Suspense } from "react";

import { IdentityForm } from "@/components/account/forms";
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
          title="Links and NEAR account"
          intro="These are links you add yourself. ProofMe shows them as you entered them and does not check that they are yours."
        >
          <IdentityForm
            initial={{
              github: links.github ?? "",
              x: links.x ?? "",
              linkedin: links.linkedin ?? "",
              other: links.other ?? "",
              nearAccountId: profile.nearAccountId ?? "",
            }}
          />
        </Panel>
        <Panel title="Your NEAR account and attestations">
          <p className="max-w-[62ch] text-muted">
            When an organisation approves your work, it can issue the record to your NEAR account as
            an NFT that cannot be transferred. Add the account above to receive it; without one, the
            approval still stands on ProofMe but is not on NEAR. ProofMe will never ask for a seed
            phrase or private key.
          </p>
        </Panel>
      </div>
    </>
  );
}
