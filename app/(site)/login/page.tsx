import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function Login() {
  return (
    <AuthShell
      title="Welcome back."
      footnote="Forgotten your password? Resetting it needs an email service, which this early build does not have yet."
    >
      <LoginForm />
    </AuthShell>
  );
}
