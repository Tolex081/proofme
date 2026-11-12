import { BadgeCheck, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";

import { PROFESSIONAL_ROLE_LABELS, type ProfessionalRole } from "@/lib/validation/profile";
import { StatusChip } from "@/components/contributions/status";
import { isContributionOrganisationApproved } from "@/lib/domain/status";
import { CATEGORY_LABELS } from "@/lib/validation/contribution";
import type { PublicContribution } from "@/server/services/contributions";
import type { PublicProfile } from "@/server/services/profile";

const LINK_LABELS: Record<string, string> = {
  github: "GitHub",
  x: "X",
  linkedin: "LinkedIn",
  other: "Link",
};

const MEMBER_SINCE = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/**
 * A public profile as a visitor sees it. Takes only the public view model, so
 * nothing private can reach it by accident.
 */
export function PublicProfileView({
  profile,
  contributions = [],
  embedded = false,
}: {
  profile: PublicProfile;
  contributions?: PublicContribution[];
  /** True when shown inside another page, which then owns the main heading. */
  embedded?: boolean;
}) {
  const Name = embedded ? "h2" : "h1";
  const Section = embedded ? "h3" : "h2";
  // Organisation-approved work counts as verified whether or not it is on NEAR yet;
  // each item's status chip says which. Withdrawn records stay visible, marked.
  const verified = contributions.filter((item) => isContributionOrganisationApproved(item.status));
  const selfReported = contributions.filter((item) => item.status === "self_reported");
  const withdrawn = contributions.filter(
    (item) => item.status === "revoked" || item.status === "superseded",
  );
  const links = Object.entries(profile.socialLinks);
  const roleLabel = (role: string) => PROFESSIONAL_ROLE_LABELS[role as ProfessionalRole] ?? role;

  return (
    <div className="grid gap-4">
      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <span
            aria-hidden="true"
            className="grid size-20 place-items-center rounded-[1.4rem] bg-[#FFD166] font-display text-figure font-extrabold text-[#1B1A2E]"
          >
            {initialsOf(profile.displayName)}
          </span>
          <div className="min-w-0">
            <Name className="text-page leading-tight font-extrabold tracking-[-0.035em]">
              {profile.displayName}
            </Name>
            <p className="text-muted">
              @{profile.username} · on ProofMe since{" "}
              {MEMBER_SINCE.format(new Date(profile.memberSince))}
            </p>
          </div>
        </div>

        {profile.bio ? <p className="mt-6 max-w-[62ch] text-lead">{profile.bio}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {profile.roles.map((role) => (
            <span key={role} className="chip chip-neutral">
              {roleLabel(role)}
            </span>
          ))}
          {profile.location ? (
            <span className="inline-flex items-center gap-1.5 text-note text-muted">
              <MapPin aria-hidden="true" size={15} /> {profile.location}
            </span>
          ) : null}
        </div>

        {profile.skills.length > 0 ? (
          <div className="mt-6">
            <h2 className="font-sans text-meta font-semibold tracking-normal text-muted">Skills</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <li key={skill} className="rounded-full bg-surface-2 px-3 py-1 text-note">
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {links.length > 0 || profile.websiteUrl || profile.nearAccountId ? (
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5">
            {profile.websiteUrl ? (
              <a
                href={profile.websiteUrl}
                rel="nofollow noopener noreferrer"
                target="_blank"
                className="text-link inline-flex items-center gap-1.5"
              >
                Website <ExternalLink aria-hidden="true" size={14} />
              </a>
            ) : null}
            {links.map(([key, url]) => (
              <a
                key={key}
                href={url}
                rel="nofollow noopener noreferrer"
                target="_blank"
                className="text-link inline-flex items-center gap-1.5"
              >
                {LINK_LABELS[key] ?? "Link"} <ExternalLink aria-hidden="true" size={14} />
              </a>
            ))}
            {profile.nearAccountId ? (
              <span className="inline-flex items-center gap-2 text-note text-muted">
                NEAR testnet: <span className="digest text-ink">{profile.nearAccountId}</span>
                <span className="chip chip-neutral">Self-declared</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card p-6 sm:p-8">
        <Section className="text-subhead">Verified contributions</Section>
        {verified.length === 0 ? (
          <p className="mt-2 max-w-[60ch] text-muted">
            None yet. Contributions appear here once the organisation they were done for has
            confirmed them.
          </p>
        ) : (
          <ContributionList items={verified} />
        )}
      </section>

      {selfReported.length > 0 ? (
        <section className="card p-6 sm:p-8">
          <Section className="text-subhead">Self-reported</Section>
          <p className="mt-2 max-w-[60ch] text-muted">
            {profile.displayName}&rsquo;s own account of their work. No organisation has confirmed
            these.
          </p>
          <ContributionList items={selfReported} />
        </section>
      ) : null}

      {withdrawn.length > 0 ? (
        <section className="card p-6 sm:p-8">
          <Section className="text-subhead">No longer confirmed</Section>
          <p className="mt-2 max-w-[60ch] text-muted">
            The organisation withdrew or replaced these records. They stay listed so the history
            cannot be quietly rewritten.
          </p>
          <ContributionList items={withdrawn} />
        </section>
      ) : null}

      {links.length > 0 || profile.websiteUrl || profile.nearAccountId ? (
        <p className="px-2 text-meta text-muted">
          Links and accounts on this profile were added by {profile.displayName} and have not been
          verified by ProofMe.
        </p>
      ) : null}
    </div>
  );
}

function ContributionList({ items }: { items: PublicContribution[] }) {
  return (
    <ul className="mt-5 grid gap-3">
      {items.map((item) => (
        <li key={item.id} className="well p-4 sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[12rem] flex-1">
              <p className="font-display text-lead font-bold tracking-[-0.015em]">{item.title}</p>
              <p className="text-meta text-muted">
                {CATEGORY_LABELS[item.category]}
                {item.role ? ` · ${item.role}` : ""}
              </p>
            </div>
            <StatusChip status={item.status} />
          </div>
          {item.attestation ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-note">
              {item.attestation.status === "active" ? (
                <BadgeCheck aria-hidden="true" size={16} className="text-ok-ink" />
              ) : null}
              <span>
                {item.attestation.status === "active"
                  ? "Confirmed by"
                  : item.attestation.status === "revoked"
                    ? "Revoked by"
                    : "Replaced by a newer record from"}{" "}
                <Link href={`/org/${item.attestation.issuerSlug}`} className="text-link">
                  {item.attestation.issuerName}
                </Link>
              </span>
              <span aria-hidden="true" className="text-muted">
                ·
              </span>
              <Link href={`/verify/${item.attestation.id}`} className="text-link">
                Check the record<span className="sr-only">: {item.title}</span>
              </Link>
            </p>
          ) : null}
          {item.summary ? <p className="mt-2">{item.summary}</p> : null}
          {item.evidence.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {item.evidence.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="text-link inline-flex items-center gap-1.5 text-note"
                  >
                    {link.label} <ExternalLink aria-hidden="true" size={13} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
