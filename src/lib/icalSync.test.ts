import { describe, expect, it } from "vitest";
import type { ParsedEvent } from "./ical";
import { normalizeFeedUrl, toBlockRows } from "./icalSync";

function ok(input: string): string {
  const result = normalizeFeedUrl(input);
  if ("error" in result) throw new Error(`expected ${input} to be accepted: ${result.error}`);
  return result.url;
}

function rejected(input: string): string {
  const result = normalizeFeedUrl(input);
  if (!("error" in result)) throw new Error(`expected ${input} to be rejected`);
  return result.error;
}

describe("normalizeFeedUrl", () => {
  it("accepts the links the listing sites hand out", () => {
    expect(ok("https://www.airbnb.com/calendar/ical/12345.ics?s=abc")).toBe(
      "https://www.airbnb.com/calendar/ical/12345.ics?s=abc"
    );
    expect(ok("  https://www.vrbo.com/icalendar/xyz.ics  ")).toBe(
      "https://www.vrbo.com/icalendar/xyz.ics"
    );
  });

  it("rewrites webcal:// to https://, since that is what a fetch speaks", () => {
    expect(ok("webcal://www.airbnb.com/calendar/ical/1.ics")).toBe(
      "https://www.airbnb.com/calendar/ical/1.ics"
    );
    expect(ok("WEBCAL://www.airbnb.com/calendar/ical/1.ics")).toBe(
      "https://www.airbnb.com/calendar/ical/1.ics"
    );
  });

  it("refuses anything that isn't https", () => {
    expect(rejected("http://www.airbnb.com/calendar/ical/1.ics")).toMatch(/https/);
    expect(rejected("file:///etc/passwd")).toMatch(/https/);
    expect(rejected("ftp://example.com/cal.ics")).toMatch(/https/);
  });

  it("refuses an empty or unparseable link", () => {
    expect(rejected("")).toMatch(/Paste the calendar link/);
    expect(rejected("   ")).toMatch(/Paste the calendar link/);
    expect(rejected("not a url")).toMatch(/doesn't look like a link/);
  });

  // The server does the fetching, so a link naming an internal address would
  // have it reach somewhere the internet cannot and report back what it found.
  it("refuses private, loopback and metadata addresses", () => {
    for (const host of [
      "localhost",
      "foo.localhost",
      "api.internal",
      "127.0.0.1",
      "0.0.0.0",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // the cloud metadata endpoint
      "100.64.0.1",
      "224.0.0.1",
      "[::1]",
      "[fd00::1]",
      "[fe80::1]",
      "[::ffff:10.0.0.1]",
    ]) {
      expect(rejected(`https://${host}/cal.ics`)).toMatch(/private address/);
    }
  });

  it("still allows public addresses that merely look adjacent", () => {
    expect(ok("https://172.32.0.1/cal.ics")).toContain("172.32.0.1");
    expect(ok("https://11.0.0.1/cal.ics")).toContain("11.0.0.1");
    expect(ok("https://localhost.example.com/cal.ics")).toContain("localhost.example.com");
  });

  it("refuses a non-standard port", () => {
    expect(rejected("https://example.com:8080/cal.ics")).toMatch(/port/);
    expect(ok("https://example.com:443/cal.ics")).toBe("https://example.com/cal.ics");
  });
});

describe("toBlockRows", () => {
  const feed = { id: "feed-1", label: "Airbnb", url: "https://example.com/cal.ics" };

  function event(over: Partial<ParsedEvent> = {}): ParsedEvent {
    return { uid: "u1", start: "2026-08-17", end: "2026-08-20", summary: "Reserved", ...over };
  }

  it("writes a half-open daterange literal, matching blocked_dates.span", () => {
    expect(toBlockRows(feed, [event()])).toEqual([
      {
        feed_id: "feed-1",
        external_uid: "u1",
        span: "[2026-08-17,2026-08-20)",
        reason: "Airbnb · Reserved",
      },
    ]);
  });

  it("names the source even when the event has no summary", () => {
    expect(toBlockRows(feed, [event({ summary: null })])[0].reason).toBe("Airbnb");
  });

  // The unique index would reject the second row and fail the whole batch.
  it("collapses a repeated UID to one row, keeping the last", () => {
    const rows = toBlockRows(feed, [event(), event({ end: "2026-08-22" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].span).toBe("[2026-08-17,2026-08-22)");
  });

  it("returns nothing for an empty feed", () => {
    expect(toBlockRows(feed, [])).toEqual([]);
  });
});
