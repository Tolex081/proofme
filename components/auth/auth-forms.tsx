"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormMessage, TextField } from "@/components/forms/fields";
import { useHydrated } from "@/components/forms/use-hydrated";
import { authClient } from "@/lib/auth/client";
import { safeReturnPath } from "@/lib/auth/return-path";
import { Spinner } from "@/components/ui/busy";

const PASSWORD_MIN_LENGTH = 10;

/** Plain-language messages for the authentication library's error codes. */
function describeAuthError(code: string | undefined, status: number | undefined): string {
  switch (code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with that email already exists. Sign in instead.";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password do not match an account. Check both and try again.";
    case "INVALID_EMAIL":
      return "Enter a complete email address, like name@example.com.";
    case "PASSWORD_TOO_SHORT":
      return `Use a password of at least ${PASSWORD_MIN_LENGTH} characters.`;
    case "PASSWORD_TOO_LONG":
      return "Use a password of at most 128 characters.";
  }
  if (status === 429) return "Too many attempts. Wait a minute, then try again.";
  return "Something went wrong on our side. Try again in a moment.";
}

function Submit({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  const hydrated = useHydrated();
  const disabled = pending || !hydrated;
  return (
    <button
      type="submit"
      className="action action-primary"
      disabled={disabled}
      aria-disabled={disabled}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use a password of at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    setPending(true);
    setError(null);
    const email = String(form.get("email") ?? "").trim();
    const { data, error: failure } = await authClient.signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email,
      password,
    });
    if (failure) {
      setPending(false);
      setError(describeAuthError(failure.code, failure.status));
      return;
    }
    if (!data?.token) {
      // The account exists but its email must be confirmed with a code first.
      rememberEmailToConfirm(email);
      router.replace("/verify-email");
      return;
    }
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={submit} method="post" action="/register" className="form-stack">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <TextField name="name" label="Your name" required autoComplete="name" maxLength={80} />
      <TextField
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        hint="Used to sign in. Never shown on your profile."
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        required
        autoComplete="new-password"
        maxLength={128}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Submit pending={pending} label="Create account" pendingLabel="Creating your account…" />
        <p className="text-muted">
          Already have one?{" "}
          <Link href="/login" className="text-link">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useHydrated();
  // After a password reset, the sign-in page says so.
  const notice =
    hydrated && new URLSearchParams(window.location.search).get("reset") === "1"
      ? "Password changed. Sign in with the new one."
      : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const email = String(form.get("email") ?? "").trim();
    const { error: failure } = await authClient.signIn.email({
      email,
      password: String(form.get("password") ?? ""),
    });
    if (failure?.code === "EMAIL_NOT_VERIFIED") {
      // A fresh code has just been emailed.
      rememberEmailToConfirm(email);
      router.replace("/verify-email");
      return;
    }
    if (failure) {
      setPending(false);
      setError(describeAuthError(failure.code, failure.status));
      return;
    }
    // Read at submit time, so the page needs no request-time rendering.
    const next = safeReturnPath(
      new URLSearchParams(window.location.search).get("next") ?? undefined,
    );
    router.replace(next ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} method="post" action="/login" className="form-stack">
      {notice && !error ? <FormMessage tone="success">{notice}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <TextField
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        required
        autoComplete="current-password"
        maxLength={128}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Submit pending={pending} label="Sign in" pendingLabel="Signing in…" />
        <p className="text-muted">
          New to Atesta?{" "}
          <Link href="/register" className="text-link">
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} disabled={pending} className={className}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

/** Asks for a reset link. Always answers the same way, so it never reveals whether an account exists. */
export function ForgotPasswordForm() {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const { error: failure } = await authClient.requestPasswordReset({
      email: String(form.get("email") ?? "").trim(),
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (failure && failure.status === 429) {
      setError("Too many requests. Wait a while, then try again.");
      return;
    }
    if (failure && failure.status !== 200 && failure.status !== 400) {
      setError("Password reset is not available on this site right now.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <FormMessage tone="success">
        If an account uses that email, a reset link is on its way. It works once and expires in one
        hour. Check your spam folder too.
      </FormMessage>
    );
  }
  return (
    <form onSubmit={submit} method="post" className="form-stack">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <TextField name="email" label="Email" type="email" required autoComplete="email" />
      <div>
        <Submit pending={pending || !hydrated} label="Send reset link" pendingLabel="Sending…" />
      </div>
    </form>
  );
}

/** Sets a new password from the link in the reset email. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token || params.get("error")) {
      setError("This reset link is invalid or has expired. Ask for a new one.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The two passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.resetPassword({ newPassword: password, token });
    if (failure) {
      setPending(false);
      setError(
        failure.code === "INVALID_TOKEN"
          ? "This reset link is invalid or has expired. Ask for a new one."
          : describeAuthError(failure.code, failure.status),
      );
      return;
    }
    router.replace("/login?reset=1");
  }

  return (
    <form onSubmit={submit} method="post" className="form-stack">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <TextField
        name="password"
        label="New password"
        type="password"
        required
        autoComplete="new-password"
        maxLength={128}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
      />
      <TextField
        name="confirm"
        label="New password again"
        type="password"
        required
        autoComplete="new-password"
        maxLength={128}
      />
      <div>
        <Submit pending={pending} label="Save new password" pendingLabel="Saving…" />
      </div>
    </form>
  );
}

// The address being confirmed is kept for this tab only, never in the URL.
const CONFIRM_KEY = "proofme-confirm-email";

function rememberEmailToConfirm(email: string) {
  try {
    sessionStorage.setItem(CONFIRM_KEY, email);
  } catch {
    // Private mode: the page asks for the address instead.
  }
}

function emailToConfirm(): string {
  try {
    return sessionStorage.getItem(CONFIRM_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Enter the 6-digit code from the confirmation email. */
export function VerifyEmailForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const remembered = hydrated ? emailToConfirm() : "";
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const otp = String(form.get("code") ?? "").replace(/\D/g, "");
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.emailOtp.verifyEmail({ email, otp });
    if (failure) {
      setPending(false);
      setError(
        failure.status === 429
          ? "Too many attempts. Wait a few minutes, then ask for a new code."
          : failure.code === "OTP_EXPIRED"
            ? "That code has expired. Ask for a new one."
            : failure.code === "TOO_MANY_ATTEMPTS"
              ? "Too many wrong codes. Ask for a new one."
              : "That code is not right. Check the latest email and try again.",
      );
      return;
    }
    try {
      sessionStorage.removeItem(CONFIRM_KEY);
    } catch {
      // Nothing to clean up.
    }
    router.replace("/onboarding");
    router.refresh();
  }

  async function resend(email: string) {
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setResending(true);
    setError(null);
    const { error: failure } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    setResending(false);
    if (failure) {
      setError(
        failure.status === 429
          ? "Too many codes requested. Wait a while, then try again."
          : "Could not send a new code right now.",
      );
      return;
    }
    setNotice("A new code is on its way. Only the newest code works.");
  }

  return (
    <form onSubmit={submit} method="post" className="form-stack" key={remembered}>
      {notice && !error ? <FormMessage tone="success">{notice}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <TextField
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        defaultValue={remembered}
      />
      <TextField
        name="code"
        label="6-digit code"
        required
        autoComplete="one-time-code"
        inputMode="text"
        maxLength={7}
        spellCheck={false}
        hint="From the email we just sent. It expires in 10 minutes."
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Submit pending={pending || !hydrated} label="Confirm email" pendingLabel="Checking…" />
        <button
          type="button"
          className="text-link"
          disabled={resending || !hydrated}
          onClick={(event) => {
            const field = event.currentTarget.form?.elements.namedItem("email");
            void resend(field instanceof HTMLInputElement ? field.value.trim() : remembered);
          }}
        >
          {resending ? "Sending…" : "Send a new code"}
        </button>
      </div>
    </form>
  );
}
