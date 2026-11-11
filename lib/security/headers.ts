/**
 * Security headers sent with every response. Kept free of imports so
 * next.config.ts and the unit tests can both load it.
 *
 * The Content Security Policy is shaped by two constraints (see DECISIONS.md, D36):
 *
 * 1. Pages are prerendered with Cache Components, so per-request nonces are
 *    not available and Next.js needs inline scripts: `script-src` allows
 *    'unsafe-inline'. React escapes all output and the only inline script we
 *    write is the fixed theme script in app/layout.tsx.
 * 2. NEAR Connect runs each wallet in a sandboxed `srcdoc` iframe, which
 *    inherits this policy. Wallets talk to their own RPC and relay servers and
 *    show remote icons, fonts and stylesheets, so `connect-src`, `img-src`,
 *    `style-src` and `font-src` allow any HTTPS host. Scripts never do.
 *    Plain HTTP, other schemes, plugins, framing by other sites, and form posts
 *    to other origins are all refused.
 */

export interface HeaderOptions {
  /** "local" for development and the automated tests. */
  appEnv: string;
  /** True for `next dev`, which needs eval for fast refresh. */
  development: boolean;
}

export function contentSecurityPolicy({ appEnv, development }: HeaderOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'", "https:"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:", "https:"],
    "connect-src": ["'self'", "https:", "wss:", ...(development ? ["ws:"] : [])],
    "frame-src": ["'self'", "https:"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (appEnv !== "local") policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(options: HeaderOptions): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()",
    },
    // Wallets open their own window and talk back to it, so popups keep their opener.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
  if (options.appEnv !== "local") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }
  return headers;
}
