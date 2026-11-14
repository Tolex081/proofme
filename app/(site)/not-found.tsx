import Link from "next/link";

/**
 * Shown for any public page that does not exist, including profiles that are
 * private or unfinished. Both look the same on purpose.
 */
export default function NotFound() {
  return (
    <section className="column grid place-items-center py-24 text-center lg:py-32">
      <p className="font-display text-display leading-none font-extrabold tracking-[-0.05em] text-faint">
        404
      </p>
      <h1 className="mt-4 text-page leading-tight">There is nothing to see here.</h1>
      <p className="mt-3 max-w-[44ch] text-muted">
        This page does not exist, or it belongs to a profile that is not public.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="action action-primary">
          Go to the home page
        </Link>
        <Link href="/how-it-works" className="action action-secondary">
          How Atesta works
        </Link>
      </div>
    </section>
  );
}
