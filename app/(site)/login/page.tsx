import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeReturnPath } from "@/lib/auth/return-path";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function Login({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell
      title="Welcome back."
      footnote="Forgotten your password? Resetting it needs an email service, which this early build does not have yet."
    >
      <Suspense fallback={<LoginForm next={null} />}>
        <LoginWithReturn searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginWithReturn({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={safeReturnPath(next)} />;
}
