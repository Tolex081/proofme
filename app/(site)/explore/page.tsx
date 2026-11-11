import { BadgeCheck, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PlatformBadge } from "@/components/organisations/badges";
import { getDb } from "@/lib/db/client";
import { CONTRIBUTION_CATEGORIES } from "@/lib/attestations/payload";
import { CATEGORY_LABELS } from "@/lib/validation/contribution";
import { PROJECT_STATUS_LABELS } from "@/lib/validation/organisation";
import { explore } from "@/server/services/admin";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Find contributors with verified work, the organisations that confirm it, and their projects.",
};

const KINDS = [
  { value: "people", label: "People" },
  { value: "organisations", label: "Organisations" },
  { value: "projects", label: "Projects" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

export default function ExplorePage({ searchParams }: PageProps<"/explore">) {
  return (
    <div className="column pt-6 pb-20 lg:pt-12">
      <div className="mx-auto max-w-[56rem]">
        <h1 className="text-heading leading-[1.02] font-extrabold tracking-[-0.045em]">Explore</h1>
        <p className="mt-3 max-w-[56ch] text-lead text-muted">
          People who chose to make their record public, the organisations that confirm work, and
          their projects. Private profiles never appear here.
        </p>
        <Suspense
          fallback={<div className="mt-8 h-72 animate-pulse rounded-[1.75rem] bg-surface-2" />}
        >
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/explore">, "searchParams">) {
  const params = await searchParams;
  const kind: Kind = KINDS.find((item) => item.value === params.kind)?.value ?? "people";
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const category = typeof params.category === "string" ? params.category : "";
  const verifiedOnly = params.verified === "1";
  const result = await explore(await getDb(), { query: q, kind, category, verifiedOnly });

  const hrefFor = (next: Kind) => {
    const search = new URLSearchParams();
    if (next !== "people") search.set("kind", next);
    if (q) search.set("q", q);
    const text = search.toString();
    return text ? `/explore?${text}` : "/explore";
  };

  return (
    <div className="mt-8">
      <nav aria-label="What to explore" className="mb-5">
        <ul className="flex flex-wrap gap-2">
          {KINDS.map((item) => (
            <li key={item.value}>
              <Link
                href={hrefFor(item.value)}
                aria-current={item.value === kind ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 font-semibold text-muted no-underline hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-canvas"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form action="/explore" method="get" role="search" className="card grid gap-4 p-5 sm:p-6">
        {kind === "people" ? null : <input type="hidden" name="kind" value={kind} />}
        <div className="field">
          <label htmlFor="explore-q" className="field-label">
            {kind === "people"
              ? "Name or username"
              : kind === "organisations"
                ? "Organisation name"
                : "Project name"}
          </label>
          <input
            id="explore-q"
            name="q"
            type="search"
            maxLength={80}
            defaultValue={q}
            className="field-input"
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {kind === "people" ? (
            <div className="field min-w-[12rem] flex-1">
              <label htmlFor="explore-category" className="field-label">
                Verified work in
              </label>
              <select
                id="explore-category"
                name="category"
                defaultValue={category}
                className="field-input"
              >
                <option value="">Any kind of work</option>
                {CONTRIBUTION_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {kind === "projects" ? null : (
            <label className="inline-flex min-h-11 items-center gap-2.5 font-semibold">
              <input
                type="checkbox"
                name="verified"
                value="1"
                defaultChecked={verifiedOnly}
                className="size-4"
              />
              {kind === "people" ? "Only people with verified work" : "Only reviewed by ProofMe"}
            </label>
          )}
          <button type="submit" className="action action-primary">
            <Search aria-hidden="true" size={16} />
            Search
          </button>
        </div>
      </form>

      <section aria-labelledby="explore-results" className="mt-8">
        <h2 id="explore-results" className="sr-only">
          Results
        </h2>
        {"people" in result && result.people ? (
          <ResultList empty={result.people.length === 0}>
            {result.people.map((person) => (
              <li key={person.username}>
                <Link
                  href={`/u/${person.username}`}
                  className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-5 text-ink no-underline hover:border-line-strong sm:p-6"
                >
                  <div className="min-w-[14rem] flex-1">
                    <p className="font-display text-lead font-bold">{person.displayName}</p>
                    <p className="text-note text-muted">@{person.username}</p>
                    {person.bio ? <p className="mt-1.5 line-clamp-2">{person.bio}</p> : null}
                  </div>
                  {person.verified > 0 ? (
                    <span className="chip chip-ok">
                      <BadgeCheck aria-hidden="true" size={13} strokeWidth={2.5} />
                      {person.verified} verified
                    </span>
                  ) : (
                    <span className="chip chip-neutral">No verified work yet</span>
                  )}
                </Link>
              </li>
            ))}
          </ResultList>
        ) : null}
        {"organisations" in result && result.organisations ? (
          <ResultList empty={result.organisations.length === 0}>
            {result.organisations.map((organisation) => (
              <li key={organisation.slug}>
                <Link
                  href={`/org/${organisation.slug}`}
                  className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-5 text-ink no-underline hover:border-line-strong sm:p-6"
                >
                  <div className="min-w-[14rem] flex-1">
                    <p className="font-display text-lead font-bold">{organisation.name}</p>
                    {organisation.description ? (
                      <p className="mt-1 line-clamp-2 text-muted">{organisation.description}</p>
                    ) : null}
                  </div>
                  <PlatformBadge status={organisation.platformVerificationStatus} />
                </Link>
              </li>
            ))}
          </ResultList>
        ) : null}
        {"projects" in result && result.projects ? (
          <ResultList empty={result.projects.length === 0}>
            {result.projects.map((project) => (
              <li key={project.slug}>
                <Link
                  href={`/project/${project.slug}`}
                  className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-5 text-ink no-underline hover:border-line-strong sm:p-6"
                >
                  <div className="min-w-[14rem] flex-1">
                    <p className="font-display text-lead font-bold">{project.name}</p>
                    <p className="text-note text-muted">{project.organisationName}</p>
                    {project.description ? (
                      <p className="mt-1 line-clamp-2">{project.description}</p>
                    ) : null}
                  </div>
                  <span className="chip chip-neutral">{PROJECT_STATUS_LABELS[project.status]}</span>
                </Link>
              </li>
            ))}
          </ResultList>
        ) : null}
      </section>
    </div>
  );
}

function ResultList({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  if (empty) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-display text-title font-bold">Nothing found</p>
        <p className="mx-auto mt-2 max-w-[44ch] text-muted">
          Try a shorter search or remove a filter.
        </p>
      </div>
    );
  }
  return <ul className="grid gap-3">{children}</ul>;
}
