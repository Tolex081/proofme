"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormMessage, TextField } from "@/components/forms/fields";
import { useHydrated } from "@/components/forms/use-hydrated";
import { authClient } from "@/lib/auth/client";
import { safeReturnPath } from "@/lib/auth/return-path";

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
      {pending ? pendingLabel : label}
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
    const { error: failure } = await authClient.signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password,
    });
    if (failure) {
      setPending(false);
      setError(describeAuthError(failure.code, failure.status));
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
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
          New to ProofMe?{" "}
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
