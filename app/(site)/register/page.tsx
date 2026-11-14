import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Start your record",
  description: "Create a Atesta account. No wallet needed.",
};

export default function Register() {
  return (
    <AuthShell
      title="Start your record."
      intro="It takes a minute. You can add the details later."
      footnote="We email you a 6-digit code to confirm your address before the account can be used. Your email is never shown on your profile or put on NEAR."
    >
      <RegisterForm />
    </AuthShell>
  );
}
