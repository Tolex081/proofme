import { Suspense } from "react";

import { AccountMenu, SideNav, SideNavView } from "@/components/workspace/shell";
import { WorkspaceTopBar } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { countUnreadNotifications } from "@/server/services/account";

export default function WorkspaceLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <WorkspaceTopBar
        account={
          <Suspense fallback={<span className="size-11 rounded-full bg-surface-2" />}>
            <Account />
          </Suspense>
        }
      />
      <div className="column grid flex-1 gap-6 py-6 lg:grid-cols-[14.5rem_1fr] lg:gap-10 lg:py-10">
        <Suspense fallback={<SideNavView pathname={null} unread={0} />}>
          <Navigation />
        </Suspense>
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </>
  );
}

async function Account() {
  const { profile } = await requireWorkspace("/dashboard");
  return <AccountMenu name={profile.displayName} username={profile.username} />;
}

async function Navigation() {
  const { user, db } = await requireWorkspace("/dashboard");
  return <SideNav unread={await countUnreadNotifications(db, user.id)} />;
}
