import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Start your record",
  description: "Create a ProofMe account. No wallet needed.",
};

export default function Register() {
  return (
    <AuthShell
      title="Start your record."
      intro="It takes a minute. You can add the details later."
      footnote="Email verification and password reset need an email service, which this early build does not have yet. Keep your password somewhere safe."
    >
      <RegisterForm />
    </AuthShell>
  );
}
