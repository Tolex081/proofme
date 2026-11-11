import { UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireOrganisation } from "@/lib/auth/org-guard";

export const metadata: Metadata = { title: "Contributors" };

export default function Contributors({ params }: PageProps<"/org/[slug]/contributors">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/org/[slug]/contributors">, "params">) {
  const { slug } = await params;
  await requireOrganisation(slug, `/org/${slug}/contributors`);
  return (
    <>
      <PageHeading
        title="Contributors"
        intro="People whose contributions this organisation has reviewed or confirmed."
      />
      <div className="card grid place-items-center px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
          <UserRoundCheck aria-hidden="true" size={24} />
        </span>
        <h2 className="mt-5 text-[1.3rem]">No contributors yet</h2>
        <p className="mt-2 max-w-[48ch] text-muted">
          Contributors appear here once they send you a contribution to review. Receiving and
          reviewing claims is the next stage of this build.
        </p>
      </div>
    </>
  );
}
