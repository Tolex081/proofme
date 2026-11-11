import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const GROUPS = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/for-contributors", label: "For contributors" },
      { href: "/for-organisations", label: "For organisations" },
      { href: "/explore", label: "Explore" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/register", label: "Start your record" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Small print",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="column grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-[34ch]">
          <Logo />
          <p className="mt-4 text-note text-muted">
            An early build running on NEAR testnet only. ProofMe is independent and has no
            partnership with NEAR or with any organisation in its sample records, all of which are
            fictional.
          </p>
        </div>
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="font-sans text-meta font-semibold tracking-normal text-faint">
              {group.title}
            </h2>
            <ul className="mt-3 grid gap-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-10 items-center font-medium text-ink no-underline hover:text-link"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
