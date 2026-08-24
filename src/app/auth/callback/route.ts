import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, supabaseServer } from "@/lib/supabase/server";

// The magic-link redirect URL must match an entry in Supabase's redirect
// allow-list exactly — it does not ignore query strings, so "next" can't ride
// along as ?next= on emailRedirectTo without every possible value being
// separately allow-listed. Instead the login page stashes it in this cookie
// before calling signInWithOtp, and we read it back here.
const NEXT_COOKIE = "sb-auth-next";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? request.cookies.get(NEXT_COOKIE)?.value ?? "/account";

  if (code && hasSupabase()) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(
        `${origin}${next.startsWith("/") ? next : "/account"}`
      );
      response.cookies.delete(NEXT_COOKIE);
      return response;
    }
    console.error("auth/callback: exchangeCodeForSession failed:", error.message);
  } else if (!code) {
    console.error("auth/callback: no ?code param on request URL:", request.url);
  }
  return NextResponse.redirect(`${origin}/login`);
}
