import Link from "next/link";

const GROUPS = [
  {
    role: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/for-contributors", label: "For contributors" },
      { href: "/for-organisations", label: "For organisations" },
    ],
  },
  {
    role: "Small print",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

/** The end card: the site's own credits, set on the same axis as everything else. */
export function SiteFooter() {
  return (
    <footer className="on-ink mt-auto">
      <div className="column py-[clamp(3rem,7vw,5rem)]">
        <div className="credits gap-y-5">
          {GROUPS.map((group) => (
            <FooterGroup key={group.role} role={group.role}>
              <ul className="flex flex-wrap gap-x-7 gap-y-1">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="name inline-flex min-h-11 items-center text-[1.15rem] text-on-ink no-underline transition-colors hover:text-teal-bright"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterGroup>
          ))}

          <FooterGroup role="Network">
            <p className="max-w-[46ch] pt-2.5 text-on-ink-muted">
              NEAR testnet only. Nothing in this build runs on mainnet, and testnet records carry no
              real-world value.
            </p>
          </FooterGroup>

          <FooterGroup role="Status">
            <p className="max-w-[46ch] pt-2.5 text-on-ink-muted">
              An early build. ProofMe is independent and has no partnership with NEAR or with any
              organisation named in its sample records, all of which are fictional.
            </p>
          </FooterGroup>
        </div>

        <hr className="rule mt-10 mb-6" />

        <div className="credits">
          <p className="name from-axis text-[1.35rem]">
            Proof<span className="text-teal-bright">Me</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ role, children }: { role: string; children: React.ReactNode }) {
  return (
    <>
      <p className="role pt-[0.95rem]">{role}</p>
      <div>{children}</div>
    </>
  );
}
