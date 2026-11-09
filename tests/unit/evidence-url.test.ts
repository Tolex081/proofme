import { describe, expect, it } from "vitest";

import {
  EVIDENCE_URL_MAX_LENGTH,
  evidenceUrlErrorMessage,
  suggestEvidenceType,
  validateEvidenceUrl,
} from "@/lib/urls/evidence";

describe("validateEvidenceUrl", () => {
  it("accepts ordinary https links and reports a readable host", () => {
    expect(validateEvidenceUrl("https://github.com/acme/app/pull/12")).toEqual({
      ok: true,
      url: "https://github.com/acme/app/pull/12",
      host: "github.com",
    });
    expect(validateEvidenceUrl("  https://www.example.org/report.pdf?v=2#page=3  ")).toEqual({
      ok: true,
      url: "https://www.example.org/report.pdf?v=2#page=3",
      host: "example.org",
    });
  });

  it("accepts internationalised domain names", () => {
    const result = validateEvidenceUrl("https://bücher.example/");
    expect(result.ok).toBe(true);
  });

  it.each([
    ["javascript:alert(1)"],
    ["JaVaScRiPt:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["file:///etc/passwd"],
    ["ftp://example.com/file"],
    ["http://example.com/"],
    ["blob:https://example.com/123"],
    ["vbscript:msgbox(1)"],
    ["mailto:someone@example.com"],
  ])("rejects the unsupported scheme in %s", (input) => {
    expect(validateEvidenceUrl(input)).toEqual({ ok: false, error: "unsupported_scheme" });
  });

  it.each([
    ["java\nscript:alert(1)"],
    ["java\tscript:alert(1)"],
    ["https://example.com/a b"],
    ["https:\\\\example.com"],
    ["https://example.com/\u0000"],
    ["https://exa\u0085mple.com/"],
  ])("rejects control characters, whitespace and backslashes in %j", (input) => {
    expect(validateEvidenceUrl(input)).toEqual({ ok: false, error: "illegal_characters" });
  });

  it.each([["not a url"], ["example.com"], ["https://"], ["//example.com"]])(
    "rejects malformed input %j",
    (input) => {
      const result = validateEvidenceUrl(input);
      expect(result.ok).toBe(false);
    },
  );

  it("rejects non-string input", () => {
    expect(validateEvidenceUrl(undefined)).toEqual({ ok: false, error: "malformed" });
    expect(validateEvidenceUrl(42)).toEqual({ ok: false, error: "malformed" });
    expect(validateEvidenceUrl({ href: "https://example.com" })).toEqual({
      ok: false,
      error: "malformed",
    });
  });

  it("rejects empty and over-long input", () => {
    expect(validateEvidenceUrl("   ")).toEqual({ ok: false, error: "empty" });
    const long = `https://example.com/${"a".repeat(EVIDENCE_URL_MAX_LENGTH)}`;
    expect(validateEvidenceUrl(long)).toEqual({ ok: false, error: "too_long" });
  });

  it("rejects embedded credentials", () => {
    expect(validateEvidenceUrl("https://user:secret@example.com/")).toEqual({
      ok: false,
      error: "credentials_not_allowed",
    });
    expect(validateEvidenceUrl("https://github.com@evil.example/")).toEqual({
      ok: false,
      error: "credentials_not_allowed",
    });
  });

  it.each([
    ["https://localhost/"],
    ["https://127.0.0.1/"],
    ["https://10.0.0.5/admin"],
    ["https://192.168.1.1/"],
    ["https://169.254.169.254/latest/meta-data"],
    ["https://[::1]/"],
    ["https://[fd00::1]/"],
    ["https://2130706433/"],
    ["https://0x7f.0.0.1/"],
    ["https://intranet/"],
    ["https://printer.local/"],
    ["https://db.internal/"],
    ["https://app.localhost/"],
    ["https://example./"],
  ])("rejects the non-public host in %s", (input) => {
    expect(validateEvidenceUrl(input)).toEqual({ ok: false, error: "host_not_public" });
  });

  it("allows http on loopback only when explicitly enabled", () => {
    expect(validateEvidenceUrl("http://localhost:3000/demo-evidence")).toEqual({
      ok: false,
      error: "unsupported_scheme",
    });
    expect(
      validateEvidenceUrl("http://localhost:3000/demo-evidence", { allowLocalHttp: true }),
    ).toEqual({ ok: true, url: "http://localhost:3000/demo-evidence", host: "localhost" });
    // The option never opens up http for real hosts.
    expect(validateEvidenceUrl("http://example.com/", { allowLocalHttp: true })).toEqual({
      ok: false,
      error: "unsupported_scheme",
    });
  });

  it("has a plain-language message for every error", () => {
    const errors = [
      "empty",
      "too_long",
      "illegal_characters",
      "malformed",
      "unsupported_scheme",
      "credentials_not_allowed",
      "host_not_public",
    ] as const;
    for (const error of errors) {
      expect(evidenceUrlErrorMessage(error).length).toBeGreaterThan(10);
    }
  });
});

describe("suggestEvidenceType", () => {
  it.each([
    ["https://github.com/acme/app", "github_repo"],
    ["https://github.com/acme/app/pull/12", "github_pr"],
    ["https://github.com/acme/app/pull/12/files", "github_pr"],
    ["https://github.com/acme/app/issues/7", "github_issue"],
    ["https://www.youtube.com/watch?v=abc", "video"],
    ["https://youtu.be/abc", "video"],
  ])("suggests a type for %s", (url, expected) => {
    expect(suggestEvidenceType(url)).toBe(expected);
  });

  it.each([
    ["https://github.com/acme"],
    ["https://github.com/acme/app/pull/new"],
    ["https://github.com.evil.example/acme/app/pull/12"],
    ["https://example.org/"],
  ])("makes no suggestion for %s", (url) => {
    expect(suggestEvidenceType(url)).toBeNull();
  });
});
