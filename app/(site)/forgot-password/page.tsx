import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPassword() {
  return (
    <AuthShell
      title="Reset your password."
      intro="Enter the email you signed up with and we will send a link to choose a new password."
      footnote={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-link">
            Sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
