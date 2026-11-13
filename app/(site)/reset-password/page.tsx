import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPassword() {
  return (
    <AuthShell
      title="Choose a new password."
      intro="Every other signed-in session on your account ends when you save it."
      footnote={
        <>
          Link expired?{" "}
          <Link href="/forgot-password" className="text-link">
            Ask for a new one
          </Link>
        </>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
