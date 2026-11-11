import { ExternalLink, MapPin } from "lucide-react";

import { PROFESSIONAL_ROLE_LABELS, type ProfessionalRole } from "@/lib/validation/profile";
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
  embedded = false,
}: {
  profile: PublicProfile;
  /** True when shown inside another page, which then owns the main heading. */
  embedded?: boolean;
}) {
  const Name = embedded ? "h2" : "h1";
  const links = Object.entries(profile.socialLinks);
  const roleLabel = (role: string) => PROFESSIONAL_ROLE_LABELS[role as ProfessionalRole] ?? role;

  return (
    <div className="grid gap-4">
      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <span
            aria-hidden="true"
            className="grid size-20 place-items-center rounded-[1.4rem] bg-[#FFD166] font-display text-[1.75rem] font-extrabold text-[#1B1A2E]"
          >
            {initialsOf(profile.displayName)}
          </span>
          <div className="min-w-0">
            <Name className="text-[clamp(1.8rem,3.4vw,2.4rem)] leading-tight font-extrabold tracking-[-0.035em]">
              {profile.displayName}
            </Name>
            <p className="text-muted">
              @{profile.username} · on ProofMe since{" "}
              {MEMBER_SINCE.format(new Date(profile.memberSince))}
            </p>
          </div>
        </div>

        {profile.bio ? <p className="mt-6 max-w-[62ch] text-[1.05rem]">{profile.bio}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {profile.roles.map((role) => (
            <span key={role} className="chip chip-neutral">
              {roleLabel(role)}
            </span>
          ))}
          {profile.location ? (
            <span className="inline-flex items-center gap-1.5 text-[0.9rem] text-muted">
              <MapPin aria-hidden="true" size={15} /> {profile.location}
            </span>
          ) : null}
        </div>

        {profile.skills.length > 0 ? (
          <div className="mt-6">
            <h2 className="font-sans text-[0.85rem] font-semibold tracking-normal text-muted">
              Skills
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <li key={skill} className="rounded-full bg-surface-2 px-3 py-1 text-[0.9rem]">
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
              <span className="inline-flex items-center gap-2 text-[0.9rem] text-muted">
                NEAR testnet: <span className="digest text-ink">{profile.nearAccountId}</span>
                <span className="chip chip-neutral">Self-declared</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card p-6 sm:p-8">
        <h2 className="text-[1.3rem]">Verified contributions</h2>
        <p className="mt-2 max-w-[60ch] text-muted">
          None yet. Contributions appear here once the organisation they were done for has confirmed
          them.
          {links.length > 0 || profile.websiteUrl || profile.nearAccountId
            ? ` The links and account above were added by ${profile.displayName} and have not been verified by ProofMe.`
            : null}
        </p>
      </section>
    </div>
  );
}
