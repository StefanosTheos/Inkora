import { type NextRequest,NextResponse } from "next/server";

import { updateSession } from "./src/lib/supabase-middleware";

/** Role-gated path prefixes (DB role names). RLS remains the real boundary. */
const ROLE_GATES: { prefix: string; role: string }[] = [
  { prefix: "/artist-dashboard", role: "artist" },
  { prefix: "/studio-dashboard", role: "studio_admin" },
  { prefix: "/admin", role: "moderator" },
];

/** Paths that require authentication (browse/SEO pages stay public). */
const AUTH_REQUIRED = ["/artist-dashboard", "/studio-dashboard", "/admin", "/messages", "/onboarding", "/rewards"];

export async function middleware(request: NextRequest) {
  const { user, roles, response } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login" || path === "/signup";

  if (!user) {
    if (AUTH_REQUIRED.some((p) => path.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", path);
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Authenticated: enforce role gates.
  for (const gate of ROLE_GATES) {
    if (path.startsWith(gate.prefix) && !roles.includes(gate.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Already signed in → keep users out of auth pages.
  if (isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // NOTE: onboarding gate is enforced in the (app) layout (needs a profile read),
  // mirroring the mobile useProtectedRoute logic at the appropriate layer.
  return response;
}

export const config = {
  // Run on everything except static assets and the OAuth callback route.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
