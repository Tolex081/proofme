import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * An early, optimistic redirect for signed-out visitors to private pages.
 * It only checks that a session cookie exists. The real check, against the
 * database, happens on every private page and in every server action.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding",
    "/organisations/new",
    "/org/:slug/dashboard/:path*",
    "/org/:slug/projects/:path*",
    "/org/:slug/team/:path*",
    "/org/:slug/contributors/:path*",
    "/org/:slug/settings/:path*",
    "/org/:slug/verifications/:path*",
    "/org/:slug/attestations/:path*",
  ],
};
