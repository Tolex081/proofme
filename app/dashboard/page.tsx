import { ArrowRight, Building2, Check, FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { listOwnContributions } from "@/server/services/contributions";

export const metadata: Metadata = { title: "Overview" };

export default function Overview({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OverviewContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OverviewContent({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const { user, profile, db } = await requireWorkspace("/dashboard");
  const own = await listOwnContributions(db, user.id);
  const drafts = own.filter((item) => item.status === "draft").length;
  const { welcome } = await searchParams;
  const firstName = profile.displayName.split(/\s+/)[0];

  const steps = [
    {
      done: Boolean(profile.bio),
      title: "Add a short bio",
      body: "One or two sentences about the work you do.",
      href: "/dashboard/settings",
      action: "Edit profile",
    },
    {
      done: Object.keys(profile.socialLinks).length > 0 || Boolean(profile.nearAccountId),
      title: "Add your links",
      body: "GitHub, X, LinkedIn or a NEAR testnet account, so people can find your work.",
      href: "/dashboard/identity",
      action: "Add links",
    },
    {
      done: profile.visibility === "public",
      title: "Make your profile public",
      body: "Profiles start private. Share yours when you are ready.",
      href: "/dashboard/settings#privacy",
      action: "Privacy settings",
    },
  ];
  const remaining = steps.filter((step) => !step.done).length;
  const wantsOrganisation =
    profile.onboardingIntent === "organisation" || profile.onboardingIntent === "both";

  return (
    <>
      {welcome === "1" ? (
        <p role="status" className="form-message form-message-success mb-6">
          Your profile is set up. It is private until you choose to share it.
        </p>
      ) : null}

      <PageHeading
        title={`Welcome, ${firstName}.`}
        intro={
          remaining === 0
            ? "Your profile is ready."
            : `${remaining} ${remaining === 1 ? "step" : "steps"} left to finish your profile.`
        }
      />

      <section aria-labelledby="setup-title" className="card overflow-hidden">
        <h2 id="setup-title" className="sr-only">
          Finish your profile
        </h2>
        <ol className="divide-y divide-line">
          {steps.map((step) => (
            <li key={step.title} className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
              <span
                className={`grid size-9 flex-none place-items-center rounded-full ${step.done ? "bg-ok text-ok-ink" : "border-2 border-dashed border-line-strong"}`}
              >
                {step.done ? <Check aria-hidden="true" size={18} strokeWidth={3} /> : null}
                <span className="sr-only">{step.done ? "Done:" : "To do:"}</span>
              </span>
              <div className="min-w-[12rem] flex-1">
                <p
                  className={`font-display text-[1.1rem] font-bold ${step.done ? "text-muted line-through decoration-1" : ""}`}
                >
                  {step.title}
                </p>
                <p className="text-[0.92rem] text-muted">{step.body}</p>
              </div>
              <Link
                href={step.href}
                className={`action ${step.done ? "action-secondary" : "action-primary"}`}
              >
                {step.done ? "Review" : step.action}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="card p-6 sm:p-7">
          <span className="grid size-11 place-items-center rounded-2xl bg-highlight text-highlight-ink">
            <FilePlus2 aria-hidden="true" size={21} />
          </span>
          <h2 className="mt-4 text-[1.2rem]">Your contributions</h2>
          <p className="mt-1.5 text-muted">
            {own.length === 0
              ? "Record one specific piece of work you did, with the links that show it."
              : `${own.length} recorded${drafts > 0 ? `, ${drafts} still ${drafts === 1 ? "a draft" : "drafts"}` : ""}. Sending them to an organisation for review arrives with the next stage of this build.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/contributions/new" className="action action-primary">
              New contribution
            </Link>
            {own.length > 0 ? (
              <Link href="/dashboard/contributions" className="action action-secondary">
                See all
              </Link>
            ) : null}
          </div>
        </section>
        <section className="card p-6 sm:p-7">
          <span className="grid size-11 place-items-center rounded-2xl bg-surface-2 text-muted">
            <Building2 aria-hidden="true" size={21} />
          </span>
          <h2 className="mt-4 text-[1.2rem]">
            {wantsOrganisation ? "Your organisation" : "Organisations"}
          </h2>
          <p className="mt-1.5 text-muted">
            {wantsOrganisation
              ? "You said you want to set up an organisation. Organisation tools arrive in a later part of this build."
              : "Organisations confirm the work you record. Organisation tools arrive in a later part of this build."}
          </p>
          <Link
            href="/for-organisations"
            className="text-link mt-3 inline-flex items-center gap-1.5"
          >
            What organisations will do <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>
      </div>
    </>
  );
}
