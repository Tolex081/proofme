import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminNav, AdminNavFallback } from "@/components/admin/admin-nav";
import { WorkspaceTopBar } from "@/components/workspace/parts";
import { AccountMenu } from "@/components/workspace/shell";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const metadata: Metadata = {
  title: { template: "%s · Atesta admin", default: "Atesta admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
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
        <Suspense fallback={<AdminNavFallback />}>
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
  const { profile } = await requireAdmin("/admin");
  return <AccountMenu name={profile.displayName} username={profile.username} />;
}

async function Navigation() {
  await requireAdmin("/admin");
  return (
    <Suspense fallback={<AdminNavFallback />}>
      <AdminNav />
    </Suspense>
  );
}
