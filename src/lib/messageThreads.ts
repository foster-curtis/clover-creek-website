// The admin Messages list. It holds more than the conversations that exist:
// a guest who has never written still has a stay the owner may need to reach,
// so every current and upcoming booking gets a row whether or not a message
// has ever been sent on it. Threads on past or cancelled stays stay listed as
// long as they have history.

import { parseStay } from "./pricing";

export interface ThreadMessage {
  booking_id: string;
  body: string;
  from_admin: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ThreadBooking {
  id: string;
  guest_name: string;
  stay: string;
  status: string;
}

export interface Thread {
  bookingId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  /** null when nothing has been sent on this booking yet. */
  last: string | null;
  lastAt: string | null;
  unread: number;
}

const ACTIVE_STATUSES = ["pending", "confirmed"];

/**
 * A stay the owner might still need to talk about: on the books, and not yet
 * checked out. The stay range is half-open, so `checkOut` is the morning they
 * leave — they're still here on that date.
 */
export function isActiveStay(booking: ThreadBooking, today: string): boolean {
  return ACTIVE_STATUSES.includes(booking.status) && parseStay(booking.stay).checkOut >= today;
}

/**
 * Merge message history onto bookings. `bookings` may hold duplicates and may
 * cover more than the active stays — anything with neither history nor an
 * active stay is dropped.
 */
export function buildThreads(
  messages: ThreadMessage[],
  bookings: ThreadBooking[],
  today: string
): Thread[] {
  const stats = new Map<string, { last: string; lastAt: string; unread: number }>();
  for (const m of messages) {
    const s = stats.get(m.booking_id) ?? { last: "", lastAt: "", unread: 0 };
    // Newest wins whatever order the rows arrived in.
    if (m.created_at >= s.lastAt) {
      s.last = m.body;
      s.lastAt = m.created_at;
    }
    if (!m.from_admin && !m.read_at) s.unread++;
    stats.set(m.booking_id, s);
  }

  const seen = new Set<string>();
  const threads: Thread[] = [];
  for (const b of bookings) {
    if (seen.has(b.id)) continue;
    const s = stats.get(b.id);
    if (!s && !isActiveStay(b, today)) continue;
    seen.add(b.id);
    const { checkIn, checkOut } = parseStay(b.stay);
    threads.push({
      bookingId: b.id,
      guestName: b.guest_name,
      checkIn,
      checkOut,
      status: b.status,
      last: s?.last ?? null,
      lastAt: s?.lastAt ?? null,
      unread: s?.unread ?? 0,
    });
  }

  // Live conversations first, newest reply on top; then the stays nobody has
  // written on yet, soonest check-in first.
  return threads.sort((a, b) => {
    if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1;
    if (a.lastAt) return -1;
    if (b.lastAt) return 1;
    if (a.checkIn !== b.checkIn) return a.checkIn < b.checkIn ? -1 : 1;
    return a.guestName.localeCompare(b.guestName);
  });
}
