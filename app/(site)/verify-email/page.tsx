import type { Metadata } from "next";
import Link from "next/link";

import { VerifyEmailForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default function VerifyEmail() {
  return (
    <AuthShell
      title="Check your email."
      intro="We sent a 6-digit code to your address. Enter it here to finish creating your account. Check your spam folder if it is not in your inbox."
      footnote={
        <>
          Wrong address?{" "}
          <Link href="/register" className="text-link">
            Start again
          </Link>
        </>
      }
    >
      <VerifyEmailForm />
    </AuthShell>
  );
}
