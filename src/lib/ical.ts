// iCalendar (.ics) feeds, both directions.
//
// Out: buildIcs() publishes this site's busy dates so the owner can subscribe
// from Google/Apple Calendar and Airbnb/VRBO can block them.
// In: parseIcs() reads those platforms' own feeds, so a stay booked elsewhere
// blocks these dates too. See @/lib/icalSync for what happens to the result.

interface IcsEvent {
  uid: string;
  start: string; // YYYY-MM-DD (all-day)
  end: string; // YYYY-MM-DD exclusive
  summary: string;
  description?: string;
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function dateStamp(d: string): string {
  return d.replace(/-/g, "");
}

export function buildIcs(events: IcsEvent[], calendarName: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clover Creek Guest House//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}@clovercreekguesthouse.com`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dateStamp(ev.start)}`,
      `DTEND;VALUE=DATE:${dateStamp(ev.end)}`,
      `SUMMARY:${escapeText(ev.summary)}`,
      ...(ev.description ? [`DESCRIPTION:${escapeText(ev.description)}`] : []),
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

// --- parsing ----------------------------------------------------------------
//
// Deliberately hand-rolled rather than pulled from npm. What has to be
// understood here is a narrow slice of RFC 5545 — VEVENT, two date properties,
// a UID — and that slice is stable. A parser small enough to read in one
// sitting is worth more than one that also handles the recurrence rules the
// booking feeds never emit.

export interface ParsedEvent {
  /** The source event's UID, or a stable fallback when the feed omits one. */
  uid: string;
  start: string; // YYYY-MM-DD, first blocked night
  end: string; // YYYY-MM-DD, exclusive — the day the house reopens
  summary: string | null;
}

/**
 * Undo RFC 5545 line folding: a line beginning with a space or tab continues
 * the one before it. Feeds fold at 75 octets, so a long SUMMARY or UID arrives
 * split across lines and would otherwise parse as garbage.
 */
function unfold(text: string): string[] {
  const lines: string[] = [];
  // Accept CRLF (the spec) and bare LF (plenty of real feeds).
  for (const raw of text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
    } else {
      lines.push(raw);
    }
  }
  return lines;
}

interface ContentLine {
  name: string;
  params: Map<string, string>;
  value: string;
}

/**
 * The first `char` outside a quoted parameter value. `TZID="Foo:Bar"` is legal,
 * and splitting on its inner colon would sever the property from its value.
 */
function indexOfUnquoted(line: string, char: string): number {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === char && !quoted) return i;
  }
  return -1;
}

/** Split `DTSTART;VALUE=DATE:20260817` into name, parameters and value. */
function parseLine(line: string): ContentLine | null {
  const colon = indexOfUnquoted(line, ":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(";");
  const params = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      params.set(part.slice(0, eq).toUpperCase(), part.slice(eq + 1).replace(/^"|"$/g, ""));
    }
  }
  return { name: parts[0].toUpperCase(), params, value };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * How far `zone` is behind UTC around `utcMs`, in milliseconds — so adding it
 * to a wall time expressed in `zone` yields the UTC instant.
 *
 * Approximated in one step: the offset is looked up at the wall time rather
 * than at the instant, which can be an hour out for the couple of hours a year
 * a DST transition straddles. The result only decides a date, and an hour's
 * error moves that date only for an event landing within an hour of midnight in
 * a zone shifting at that moment. Feeds carrying whole nights don't.
 */
function offsetMs(tzid: string, utcMs: number): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcMs));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    );
    return utcMs - asUtc;
  } catch {
    // An unknown or malformed TZID. Intl throws rather than guessing, and so do
    // we not: fall back to reading the wall time as a floating one.
    return 0;
  }
}

function formatInZone(instant: Date, timezone: string): string {
  // en-CA formats as YYYY-MM-DD, the shape the rest of the app speaks.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * A date property as a calendar day at the property.
 *
 * Three forms turn up. `VALUE=DATE` (20260817) is what Airbnb and VRBO send and
 * is already a calendar day. A UTC timestamp (20260817T060000Z) and a zoned one
 * (TZID=America/New_York:20260817T020000) are what Google Calendar sends, and
 * both have to be resolved to a day *here*: a 6am-UTC checkout is still the
 * 16th in Utah, and taking the timestamp's own date would hold a night that is
 * actually free.
 */
function parseDateValue(line: ContentLine, timezone: string): string | null {
  const v = line.value.trim();

  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;

  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!dateTime) return null;
  const [, y, mo, d, h, mi, s, zulu] = dateTime;

  // A floating time (no Z, no TZID) is defined to be local wherever it is read,
  // and "local" for this calendar is the property — its date is already the day.
  const tzid = line.params.get("TZID");
  if (!zulu && !tzid) return `${y}-${mo}-${d}`;

  const utcMs = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  // A zoned time is that wall time in `tzid`; shift it to the real instant
  // before asking what day it is at the property.
  const instant = new Date(zulu ? utcMs : utcMs + offsetMs(tzid as string, utcMs));
  if (Number.isNaN(instant.getTime())) return null;
  return formatInZone(instant, timezone);
}

/** Add whole days to a YYYY-MM-DD string, in UTC so no DST can shift it. */
function shiftDay(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole days in an RFC 5545 DURATION, rounding a partial day up to one. */
function durationDays(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value.trim().toUpperCase()
  );
  if (!m) return null;
  const [, sign, weeks, days, hours, minutes, seconds] = m;
  const total =
    (Number(weeks ?? 0) * 7 + Number(days ?? 0)) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  if (total === 0) return null;
  return (sign === "-" ? -1 : 1) * Math.ceil(total / 86400);
}

function toEvent(
  props: Map<string, ContentLine>,
  timezone: string,
  index: number
): ParsedEvent | null {
  if (props.get("STATUS")?.value.trim().toUpperCase() === "CANCELLED") return null;
  // The publisher saying "this doesn't make me busy" — a reminder, not a stay.
  if (props.get("TRANSP")?.value.trim().toUpperCase() === "TRANSPARENT") return null;

  const dtstart = props.get("DTSTART");
  if (!dtstart) return null;
  const start = parseDateValue(dtstart, timezone);
  if (!start) return null;

  const dtend = props.get("DTEND");
  let end = dtend ? parseDateValue(dtend, timezone) : null;

  if (!end) {
    const duration = props.get("DURATION");
    const days = duration ? durationDays(duration.value) : null;
    // No DTEND and no DURATION is a one-day event (RFC 5545 §3.6.1 for a DATE
    // start), which here means a single blocked night.
    end = shiftDay(start, days && days > 0 ? days : 1);
  }

  // A timed event beginning and ending the same local day — a midday cleaning
  // slot, say — still costs that night. An empty or inverted range is a
  // Postgres error rather than a block, so normalise instead of dropping it.
  if (end <= start) end = shiftDay(start, 1);

  const uid = props.get("UID")?.value.trim();
  const summary = props.get("SUMMARY");
  return {
    // A UID is required by the spec and real feeds do send one. The fallback
    // keeps a non-compliant feed importable: it is stable across syncs as long
    // as the feed's event order is, and a reordered feed just re-imports the
    // same nights under new keys.
    uid: uid && uid.length > 0 ? uid : `no-uid-${index}-${start}-${end}`,
    start,
    end,
    summary: summary ? unescapeText(summary.value).trim() || null : null,
  };
}

/**
 * Every busy date range in an iCalendar document, as half-open [start, end)
 * spans of calendar days at the property — the same shape as `bookings.stay`
 * and `blocked_dates.span`.
 *
 * Skipped: cancelled events, transparent ones, and anything without a usable
 * start. Recurrence is not expanded; the booking feeds don't use it, and a
 * half-implemented RRULE would block the wrong nights rather than none.
 */
export function parseIcs(text: string, timezone: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  let current: Map<string, ContentLine> | null = null;
  let index = 0;

  for (const raw of unfold(text)) {
    const line = parseLine(raw);
    if (!line) continue;

    if (line.name === "BEGIN" && line.value.trim().toUpperCase() === "VEVENT") {
      current = new Map();
      continue;
    }
    if (!current) continue;

    if (line.name === "END" && line.value.trim().toUpperCase() === "VEVENT") {
      const event = toEvent(current, timezone, index++);
      if (event) events.push(event);
      current = null;
      continue;
    }
    // First occurrence wins, so a nested VALARM's own DURATION can't displace
    // the event's. (BEGIN:VALARM isn't VEVENT, so we never reset on it either.)
    if (!current.has(line.name)) current.set(line.name, line);
  }

  return events;
}
