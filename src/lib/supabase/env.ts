/**
 * Validated, trimmed Supabase client credentials, or null when unset or
 * malformed.
 *
 * @supabase/ssr's client constructors validate the URL synchronously, before
 * any network call, throwing "Invalid supabaseUrl" for anything that isn't an
 * absolute http(s) URL — before withDeadline() ever gets a chance to run. A
 * non-blank but malformed NEXT_PUBLIC_SUPABASE_URL (missing "https://", a
 * stray trailing space from a pasted env value, etc.) would otherwise crash
 * every Server Component that touches auth instead of degrading to "Supabase
 * not configured."
 *
 * Kept free of imports so the edge middleware and the browser client can both
 * use it.
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  try {
    if (!["http:", "https:"].includes(new URL(url).protocol)) return null;
  } catch {
    return null;
  }
  return { url, anonKey };
}
