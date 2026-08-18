import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { AUTH_DEADLINE_MS, withDeadline } from "./deadline";

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function hasServiceRole(): boolean {
  return hasSupabase() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Request-scoped client that acts as the signed-in user (RLS enforced). */
export async function supabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles session refresh.
          }
        },
      },
    }
  );
}

/** Service-role client for trusted server-side operations (bypasses RLS). */
export function supabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * The signed-in user, or null (also null when Supabase isn't configured, or is
 * unreachable within the deadline).
 *
 * Cached for the duration of the request so the header, the layout and the page
 * share a single round-trip instead of each paying for its own.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  if (!hasSupabase()) return null;
  const supabase = await supabaseServer();
  return withDeadline<User | null>(
    supabase.auth.getUser().then(({ data }) => data.user),
    AUTH_DEADLINE_MS,
    null
  );
});

/**
 * True when the signed-in user has the admin role. Pass an already-resolved
 * user to skip the auth round-trip entirely.
 */
export async function isAdminUser(user?: User | null): Promise<boolean> {
  if (!hasSupabase()) return false;
  const resolved = user === undefined ? await currentUser() : user;
  if (!resolved) return false;
  const supabase = await supabaseServer();
  const role = await withDeadline<string | null>(
    (async () => {
      // PostgREST query builders are PromiseLike, not Promise — adapt one here.
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", resolved.id)
        .single();
      return data?.role ?? null;
    })(),
    AUTH_DEADLINE_MS,
    null
  );
  return role === "admin";
}
