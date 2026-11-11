import { SiteFooter } from "@/components/marketing/site-footer";
import { Suspense } from "react";

import { SiteHeader, SiteHeaderView } from "@/components/marketing/site-header";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<SiteHeaderView pathname={null} />}>
        <SiteHeader />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
