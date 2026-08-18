/**
 * How long a single Supabase auth round-trip may take before we give up and
 * treat the caller as signed out.
 */
export const AUTH_DEADLINE_MS = 3000;

/**
 * Resolve to `fallback` if `work` has not settled within `ms`.
 *
 * auth-js retries a failed token refresh with exponential backoff (200ms,
 * doubling) until the next interval would overflow its 30s auto-refresh tick —
 * about 25s of blocking per call. Its own `REFRESH_FAILURE_COOLDOWN_MS` guard is
 * instance state, which never helps here because every request builds a fresh
 * client. Without a deadline an unreachable or slow Supabase stalls every render
 * for that whole window.
 *
 * Rejections resolve to `fallback` too, so a late failure can't surface as an
 * unhandled rejection after the deadline has already passed.
 *
 * Kept free of imports so the edge middleware can use it.
 */
export async function withDeadline<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
