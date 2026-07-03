import { type NextRequest,NextResponse } from "next/server";

import { createClient } from "../../../../lib/supabase-server";

/**
 * OAuth / magic-link callback. Exchanges the `code` for a cookie session, then
 * redirects: to ?redirectTo if provided, else to "/" (the (app) layout sends
 * un-onboarded users to /onboarding).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
