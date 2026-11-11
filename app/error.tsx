"use client";

import Link from "next/link";

/**
 * Shown when a page fails. Never shows the error itself: server errors reach
 * the browser only as a reference code, which matches the server log entry.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;
  return (
    <main id="main" className="column grid flex-1 place-items-center py-24 text-center">
      <div>
        <h1 className="text-page leading-tight">Something went wrong.</h1>
        <p className="mx-auto mt-3 max-w-[44ch] text-muted">
          This page could not be shown. Try again in a moment.
        </p>
        {digest ? (
          <p className="mt-3 text-note text-muted">
            Reference: <span className="digest">{digest}</span>
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="action action-primary">
            Try again
          </button>
          <Link href="/" className="action action-secondary">
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}
