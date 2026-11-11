import { Suspense } from "react";

import { OrgNav, OrgNavFallback } from "@/components/organisations/org-nav";
import { WorkspaceTopBar } from "@/components/workspace/parts";
import { AccountMenu } from "@/components/workspace/shell";
import { requireOrganisation } from "@/lib/auth/org-guard";

export default function OrganisationLayout({ children, params }: LayoutProps<"/org/[slug]">) {
  return (
    <>
      <WorkspaceTopBar
        account={
          <Suspense fallback={<span className="size-11 rounded-full bg-surface-2" />}>
            <Account params={params} />
          </Suspense>
        }
      />
      <div className="column grid flex-1 gap-6 py-6 lg:grid-cols-[14.5rem_1fr] lg:gap-10 lg:py-10">
        <Suspense fallback={<div className="h-11" />}>
          <Navigation params={params} />
        </Suspense>
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </>
  );
}

async function Account({ params }: Pick<LayoutProps<"/org/[slug]">, "params">) {
  const { slug } = await params;
  const { profile } = await requireOrganisation(slug, `/org/${slug}/dashboard`);
  return <AccountMenu name={profile.displayName} username={profile.username} />;
}

async function Navigation({ params }: Pick<LayoutProps<"/org/[slug]">, "params">) {
  const { slug } = await params;
  const { organisation, can } = await requireOrganisation(slug, `/org/${slug}/dashboard`);
  const props = {
    slug: organisation.slug,
    name: organisation.name,
    canManage: can("organisation.update_profile"),
  };
  return (
    <Suspense fallback={<OrgNavFallback {...props} />}>
      <OrgNav {...props} />
    </Suspense>
  );
}
