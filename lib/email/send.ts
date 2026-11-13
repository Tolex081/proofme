/**
 * Sending ProofMe's account emails (password reset, email verification)
 * through Brevo's transactional email API.
 *
 * Only these two kinds of email exist. Nothing marketing, nothing tracked.
 * Without BREVO_API_KEY and EMAIL_FROM, nothing is sent and the app says that
 * password reset is not available.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailConfig {
  apiKey: string;
  from: string;
  fromName: string;
}

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailError";
  }
}

export async function sendEmail(
  config: EmailConfig,
  message: EmailMessage,
  send: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await send("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: config.from, name: config.fromName },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new EmailError("The email service could not be reached.");
  }
  if (!response.ok) {
    throw new EmailError(`The email service refused the message (status ${response.status}).`);
  }
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function layout(heading: string, intro: string, button: string, url: string, after: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#fbf8f3;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d1d2b">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-weight:800;font-size:20px;margin:0 0 24px">ProofMe</p>
<h1 style="font-size:24px;margin:0 0 12px">${escape(heading)}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 24px">${escape(intro)}</p>
<p style="margin:0 0 24px"><a href="${escape(url)}" style="display:inline-block;background:#2f54eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${escape(button)}</a></p>
<p style="font-size:14px;line-height:1.5;color:#5b5b6b;margin:0 0 8px">${escape(after)}</p>
<p style="font-size:13px;color:#5b5b6b;word-break:break-all;margin:0">${escape(url)}</p>
</div></body></html>`;
  const text = `${heading}\n\n${intro}\n\n${button}: ${url}\n\n${after}\n`;
  return { html, text };
}

export function passwordResetEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Reset your ProofMe password",
    ...layout(
      "Reset your password",
      "Someone asked to reset the password for this ProofMe account. If it was you, choose a new one with the link below. It works once and expires in one hour.",
      "Choose a new password",
      url,
      "If you did not ask for this, ignore this email; your password stays the same. ProofMe will never ask for your password, seed phrase or keys by email.",
    ),
  };
}

export function verificationEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Confirm your email for ProofMe",
    ...layout(
      "Confirm your email",
      "Confirm that this address belongs to you, so you can reset your password if you ever need to.",
      "Confirm my email",
      url,
      "If you did not create a ProofMe account, ignore this email.",
    ),
  };
}

/** The 6-digit code that confirms a new account's email address. */
export function verificationCodeEmail(to: string, code: string): EmailMessage {
  const digits = code.replace(/\D/g, "").slice(0, 8);
  const html = `<!doctype html><html><body style="margin:0;background:#fbf8f3;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d1d2b">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-weight:800;font-size:20px;margin:0 0 24px">ProofMe</p>
<h1 style="font-size:24px;margin:0 0 12px">Confirm your email</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 20px">Enter this code on ProofMe to finish creating your account. It expires in 10 minutes.</p>
<p style="font-size:36px;font-weight:800;letter-spacing:10px;margin:0 0 24px;font-family:Consolas,Menlo,monospace">${digits}</p>
<p style="font-size:14px;line-height:1.5;color:#5b5b6b;margin:0">If you did not create a ProofMe account, ignore this email. ProofMe will never ask for your password, seed phrase or keys.</p>
</div></body></html>`;
  return {
    to,
    subject: `${digits} is your ProofMe code`,
    text: `Confirm your email\n\nYour ProofMe code is ${digits}. It expires in 10 minutes.\n\nIf you did not create a ProofMe account, ignore this email.\n`,
    html,
  };
}
