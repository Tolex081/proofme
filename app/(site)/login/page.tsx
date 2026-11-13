import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function Login() {
  return (
    <AuthShell
      title="Welcome back."
      footnote={
        <>
          Forgotten your password?{" "}
          <Link href="/forgot-password" className="text-link">
            Reset it by email
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
