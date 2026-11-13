import type { Metadata } from "next";
import { Suspense } from "react";

import { IdentityForm } from "@/components/account/forms";
import { GitHubIdentityPanel } from "@/components/evidence/parts";
import { NearAccountProof } from "@/components/near/account-proof";
import { isGitHubLinkingConfigured } from "@/lib/evidence/server";
import { listGitHubIdentities } from "@/server/services/github-identity";
import { PageHeading, PageSkeleton, Panel } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Identity" };

export default function Identity({ searchParams }: PageProps<"/dashboard/identity">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <IdentityContent searchParams={searchParams} />
    </Suspense>
  );
}

async function IdentityContent({
  searchParams,
}: Pick<PageProps<"/dashboard/identity">, "searchParams">) {
  const { github } = await searchParams;
  const { profile, user, db } = await requireWorkspace("/dashboard/identity");
  const links = profile.socialLinks;
  const identities = await listGitHubIdentities(db, user.id);

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
          title="GitHub"
          intro="Link the GitHub account your work is under. ProofMe signs you in with GitHub and keeps only GitHub's numeric account ID and username; it requests no access to your repositories. One GitHub account can belong to only one ProofMe account, and it stays reserved for you even if you disconnect it."
        >
          <GitHubIdentityPanel
            identities={identities}
            configured={isGitHubLinkingConfigured()}
            outcome={typeof github === "string" ? github : null}
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
