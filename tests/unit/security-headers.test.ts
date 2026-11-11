import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, securityHeaders } from "@/lib/security/headers";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(" ") ?? [];

describe("security headers", () => {
  const production = { appEnv: "production", development: false };
  const policy = contentSecurityPolicy(production);

  it("refuses framing, plugins, foreign bases and foreign form posts", () => {
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
    expect(directive(policy, "default-src")).toEqual(["'self'"]);
  });

  it("loads scripts only from this site, and never allows eval outside development", () => {
    const scripts = directive(policy, "script-src");
    expect(scripts).not.toContain("https:");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(
      directive(contentSecurityPolicy({ appEnv: "local", development: true }), "script-src"),
    ).toContain("'unsafe-eval'");
  });

  it("allows only encrypted connections to other hosts", () => {
    expect(directive(policy, "connect-src")).toEqual(["'self'", "https:", "wss:"]);
    expect(policy).not.toMatch(/\shttp:/);
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("sends HSTS only outside local development", () => {
    const keys = (appEnv: string) =>
      securityHeaders({ appEnv, development: false }).map((header) => header.key);
    expect(keys("production")).toContain("Strict-Transport-Security");
    expect(keys("preview")).toContain("Strict-Transport-Security");
    expect(keys("local")).not.toContain("Strict-Transport-Security");
  });

  it("sets the standard hardening headers", () => {
    const headers = Object.fromEntries(
      securityHeaders(production).map((header) => [header.key, header.value]),
    );
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });
});
