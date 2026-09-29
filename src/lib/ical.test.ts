import { describe, expect, it } from "vitest";
import { buildIcs, parseIcs } from "./ical";

const TZ = "America/Denver";

/** Wrap VEVENT bodies in a calendar, with CRLF line endings as the spec has it. */
function calendar(...events: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Test//EN",
    ...events.flatMap((e) => ["BEGIN:VEVENT", ...e.trim().split("\n"), "END:VEVENT"]),
    "END:VCALENDAR",
  ].join("\r\n");
}

describe("parseIcs", () => {
  it("reads an all-day booking, the form Airbnb and VRBO send", () => {
    const events = parseIcs(
      calendar(`
UID:abc123@airbnb.com
DTSTART;VALUE=DATE:20260817
DTEND;VALUE=DATE:20260820
SUMMARY:Reserved
`),
      TZ
    );
    expect(events).toEqual([
      { uid: "abc123@airbnb.com", start: "2026-08-17", end: "2026-08-20", summary: "Reserved" },
    ]);
  });

  it("keeps check-out exclusive, so back-to-back stays don't fight over a night", () => {
    const events = parseIcs(
      calendar(
        "UID:a\nDTSTART;VALUE=DATE:20260817\nDTEND;VALUE=DATE:20260820",
        "UID:b\nDTSTART;VALUE=DATE:20260820\nDTEND;VALUE=DATE:20260822"
      ),
      TZ
    );
    expect(events[0].end).toBe("2026-08-20");
    expect(events[1].start).toBe("2026-08-20");
  });

  it("resolves a UTC timestamp to the day it is at the property", () => {
    // 2026-08-18T05:00Z is 11pm on the 17th in Denver (UTC-6 in August).
    const events = parseIcs(
      calendar("UID:g\nDTSTART:20260818T050000Z\nDTEND:20260821T050000Z"),
      TZ
    );
    expect(events[0]).toMatchObject({ start: "2026-08-17", end: "2026-08-20" });
  });

  it("resolves a zoned timestamp through its own TZID first", () => {
    // 2am Eastern on the 17th is midnight Mountain on the 17th.
    const events = parseIcs(
      calendar(
        "UID:z\nDTSTART;TZID=America/New_York:20260817T020000\nDTEND;TZID=America/New_York:20260820T020000"
      ),
      TZ
    );
    expect(events[0]).toMatchObject({ start: "2026-08-17", end: "2026-08-20" });
  });

  it("treats a floating time as already local", () => {
    const events = parseIcs(
      calendar("UID:f\nDTSTART:20260817T150000\nDTEND:20260820T110000"),
      TZ
    );
    expect(events[0]).toMatchObject({ start: "2026-08-17", end: "2026-08-20" });
  });

  it("falls back to the floating reading when the TZID is not a real zone", () => {
    const events = parseIcs(
      calendar("UID:bad\nDTSTART;TZID=Mars/Olympus:20260817T120000\nDTEND;TZID=Mars/Olympus:20260819T120000"),
      TZ
    );
    expect(events[0]).toMatchObject({ start: "2026-08-17", end: "2026-08-19" });
  });

  it("unfolds a UID split across lines", () => {
    const events = parseIcs(
      calendar(
        "UID:verylonguid-0123456789-0123456789-0123456789-0123456789-0123456\n 789-tail@airbnb.com\nDTSTART;VALUE=DATE:20260817\nDTEND;VALUE=DATE:20260818"
      ),
      TZ
    );
    expect(events[0].uid).toBe(
      "verylonguid-0123456789-0123456789-0123456789-0123456789-0123456789-tail@airbnb.com"
    );
  });

  it("accepts bare LF line endings", () => {
    const text =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:lf\nDTSTART;VALUE=DATE:20260817\nDTEND;VALUE=DATE:20260818\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseIcs(text, TZ)).toHaveLength(1);
  });

  it("skips cancelled and transparent events", () => {
    const events = parseIcs(
      calendar(
        "UID:x\nDTSTART;VALUE=DATE:20260817\nDTEND;VALUE=DATE:20260818\nSTATUS:CANCELLED",
        "UID:y\nDTSTART;VALUE=DATE:20260819\nDTEND;VALUE=DATE:20260820\nTRANSP:TRANSPARENT",
        "UID:z\nDTSTART;VALUE=DATE:20260821\nDTEND;VALUE=DATE:20260822"
      ),
      TZ
    );
    expect(events.map((e) => e.uid)).toEqual(["z"]);
  });

  it("blocks one night when DTEND is missing", () => {
    const events = parseIcs(calendar("UID:n\nDTSTART;VALUE=DATE:20260817"), TZ);
    expect(events[0]).toMatchObject({ start: "2026-08-17", end: "2026-08-18" });
  });

  it("uses DURATION when there is no DTEND, rounding a part-day up", () => {
    const events = parseIcs(
      calendar(
        "UID:d\nDTSTART;VALUE=DATE:20260817\nDURATION:P3D",
        "UID:e\nDTSTART;VALUE=DATE:20260901\nDURATION:PT30H"
      ),
      TZ
    );
    expect(events[0].end).toBe("2026-08-20");
    expect(events[1].end).toBe("2026-09-03");
  });

  it("never yields an empty or inverted range", () => {
    const events = parseIcs(
      calendar(
        "UID:same\nDTSTART:20260817T100000\nDTEND:20260817T140000",
        "UID:back\nDTSTART;VALUE=DATE:20260820\nDTEND;VALUE=DATE:20260818"
      ),
      TZ
    );
    expect(events[0]).toMatchObject({ start: "2026-08-17", end: "2026-08-18" });
    expect(events[1]).toMatchObject({ start: "2026-08-20", end: "2026-08-21" });
  });

  it("does not let a VALARM's properties displace the event's", () => {
    const events = parseIcs(
      calendar(
        "UID:alarmed\nDTSTART;VALUE=DATE:20260817\nDTEND;VALUE=DATE:20260820\nBEGIN:VALARM\nTRIGGER:-PT1H\nDURATION:PT15M\nACTION:DISPLAY\nEND:VALARM"
      ),
      TZ
    );
    expect(events[0].end).toBe("2026-08-20");
  });

  it("unescapes the summary and keeps a quoted TZID intact", () => {
    const events = parseIcs(
      calendar(
        'UID:s\nDTSTART;TZID="America/Denver":20260817T120000\nDTEND;TZID="America/Denver":20260818T120000\nSUMMARY:Smith\\, John\\; 2 guests'
      ),
      TZ
    );
    expect(events[0].summary).toBe("Smith, John; 2 guests");
    expect(events[0].start).toBe("2026-08-17");
  });

  it("gives an event with no UID a stable key rather than dropping it", () => {
    const events = parseIcs(calendar("DTSTART;VALUE=DATE:20260817\nDTEND;VALUE=DATE:20260818"), TZ);
    expect(events[0].uid).toBe("no-uid-0-2026-08-17-2026-08-18");
  });

  it("returns nothing for junk, an empty calendar, or an event with no start", () => {
    expect(parseIcs("", TZ)).toEqual([]);
    expect(parseIcs("<html>Sign in</html>", TZ)).toEqual([]);
    expect(parseIcs(calendar("UID:nostart\nSUMMARY:Reserved"), TZ)).toEqual([]);
  });

  it("round-trips what buildIcs writes", () => {
    const ics = buildIcs(
      [{ uid: "booking-1", start: "2026-08-17", end: "2026-08-20", summary: "Booked" }],
      "Clover Creek"
    );
    expect(parseIcs(ics, TZ)).toEqual([
      {
        uid: "booking-1@clovercreekguesthouse.com",
        start: "2026-08-17",
        end: "2026-08-20",
        summary: "Booked",
      },
    ]);
  });
});
