import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_DEADLINE_MS, withDeadline } from "@/lib/supabase/deadline";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh the auth session (required for server components to see it).
  // getClaims() verifies the JWT locally against cached JWKS when the project
  // uses asymmetric signing keys, saving a round-trip; it falls back to a
  // network call for legacy HS256 tokens. The deadline caps what an unreachable
  // Supabase can cost either way — better to bounce to /login than to hang.
  const claims = await withDeadline<{ sub?: string } | null>(
    supabase.auth.getClaims().then(({ data }) => data?.claims ?? null),
    AUTH_DEADLINE_MS,
    null
  );

  if (!claims?.sub) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

// Only the routes that actually gate on auth. This previously matched every
// path, so each Next.js prefetch of a public page paid for its own auth
// round-trip — ruinous when Supabase is slow or down.
export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
