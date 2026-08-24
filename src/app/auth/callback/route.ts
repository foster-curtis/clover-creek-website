import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

  if (code && hasSupabase()) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/account"}`);
    }
    console.error("auth/callback: exchangeCodeForSession failed:", error.message);
  } else if (!code) {
    console.error("auth/callback: no ?code param on request URL:", request.url);
  }
  return NextResponse.redirect(`${origin}/login`);
}
