// iCalendar (.ics) feed generation — lets the owner subscribe from Google
// Calendar / Apple Calendar, and lets Airbnb/VRBO import availability so the
// house is never double-booked across platforms.

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
