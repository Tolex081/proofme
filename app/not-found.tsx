import Link from "next/link";

import { Logo } from "@/components/brand/logo";

/** For addresses outside every section of the site. */
export default function NotFound() {
  return (
    <main id="main" className="column grid flex-1 place-items-center py-24 text-center">
      <div>
        <Link href="/" aria-label="ProofMe home" className="inline-block no-underline">
          <Logo />
        </Link>
        <h1 className="mt-10 text-page leading-tight">There is nothing to see here.</h1>
        <p className="mt-3 text-muted">This page does not exist.</p>
        <Link href="/" className="action action-primary mt-8">
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
