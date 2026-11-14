import { describe, expect, it } from "vitest";

import { EmailError, passwordResetEmail, sendEmail, verificationEmail } from "@/lib/email/send";

const config = { apiKey: "test-key-not-real", from: "noreply@example.test", fromName: "Atesta" };

describe("account emails", () => {
  it("sends through Brevo with the key in the api-key header and both bodies", async () => {
    let request: { url: string; init?: RequestInit } | null = null;
    await sendEmail(
      config,
      passwordResetEmail("ada@example.test", "https://proofme.test/r?t=1"),
      async (url, init) => {
        request = { url: String(url), init };
        return new Response(JSON.stringify({ messageId: "x" }), { status: 201 });
      },
    );
    expect(request!.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((request!.init!.headers as Record<string, string>)["api-key"]).toBe("test-key-not-real");
    const body = JSON.parse(String(request!.init!.body));
    expect(body.sender).toEqual({ email: "noreply@example.test", name: "Atesta" });
    expect(body.to).toEqual([{ email: "ada@example.test" }]);
    expect(body.textContent).toContain("https://proofme.test/r?t=1");
    expect(body.htmlContent).toContain("https://proofme.test/r?t=1");
  });

  it("fails clearly when Brevo refuses or cannot be reached", async () => {
    const message = verificationEmail("ada@example.test", "https://proofme.test/v");
    await expect(
      sendEmail(config, message, async () => new Response("no", { status: 401 })),
    ).rejects.toBeInstanceOf(EmailError);
    await expect(
      sendEmail(config, message, async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow(/could not be reached/);
  });

  it("escapes the link in the HTML so it cannot inject markup", () => {
    const message = passwordResetEmail(
      "a@example.test",
      'https://x.test/"><script>alert(1)</script>',
    );
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&#60;script&#62;");
  });
});
