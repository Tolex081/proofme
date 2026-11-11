"use client";

/**
 * Last resort, when the root layout itself fails. It renders its own document
 * without the site's stylesheet, so it carries a few inline styles and follows
 * the system light or dark setting.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          colorScheme: "light dark",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <title>Something went wrong · ProofMe</title>
        <main>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Something went wrong.</h1>
          <p style={{ marginTop: "0.75rem" }}>ProofMe could not load. Try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1.5rem",
              minHeight: "2.75rem",
              padding: "0 1.25rem",
              borderRadius: "999px",
              border: "none",
              background: "#2F54EB",
              color: "#fff",
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
