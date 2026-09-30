// When two sets of dates collide — bookings with bookings, bookings with blocks.
// The database is what enforces it (the exclusion constraint in 0001, the
// triggers in 0008), and this holds the error codes it answers with, which the
// checkout route and the admin actions read. rangesOverlap() is the same rule
// written out in code; nothing in the app calls it, since the database does the
// checking, but tests that stand in for the database do.

/**
 * SQLSTATE raised by the 0008 triggers when a booking and a block overlap. A
 * class of this project's own; supabase/migrations/0008_bookings_respect_blocks.sql
 * says why this one. Change both together — a test checks every migration.
 */
export const BLOCKED_DATES_CONFLICT = "CC001";

/** SQLSTATE of an exclusion-constraint violation: two active bookings overlap. */
export const BOOKING_OVERLAP = "23P01";

/**
 * Whether a database error means "those dates are taken", by a booking or a
 * block alike. Read from the code, never the message: a guest gets the same
 * answer either way, and message wording is free to change.
 */
export function isDatesTaken(code: string | undefined | null): boolean {
  return code === BOOKING_OVERLAP || code === BLOCKED_DATES_CONFLICT;
}

/**
 * Whether two stays share a night. Half-open, like every range in the
 * database: check-out is the morning the guest leaves, so [Mar 1, Mar 8) and
 * [Mar 8, Mar 12) do not clash — one party leaves the day the next arrives.
 * An empty range overlaps nothing, as with Postgres's `&&`.
 *
 * Plain string comparison is correct for YYYY-MM-DD.
 */
export function rangesOverlap(
  a: { checkIn: string; checkOut: string },
  b: { checkIn: string; checkOut: string }
): boolean {
  return (
    a.checkIn < a.checkOut &&
    b.checkIn < b.checkOut &&
    a.checkIn < b.checkOut &&
    b.checkIn < a.checkOut
  );
}
