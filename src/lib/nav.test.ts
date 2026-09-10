import { describe, expect, it } from "vitest";
import { activeNavHref, isActivePath } from "./nav";

const HEADER = ["/", "/gallery", "/book", "/reviews", "/blog", "/faq", "/contact"];
const ADMIN = ["/admin", "/admin/calendar", "/admin/messages", "/admin/blog"];

describe("isActivePath", () => {
  it("matches the page itself", () => {
    expect(isActivePath("/gallery", "/gallery")).toBe(true);
    expect(isActivePath("/gallery", "/faq")).toBe(false);
  });

  it("matches pages nested under the link", () => {
    expect(isActivePath("/blog/rush-valley-hikes", "/blog")).toBe(true);
    expect(isActivePath("/admin/messages/42", "/admin/messages")).toBe(true);
  });

  it("does not match a link that is only a string prefix", () => {
    expect(isActivePath("/blogger", "/blog")).toBe(false);
  });

  it("keeps the home link to the home page", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/faq", "/")).toBe(false);
  });

  it("ignores trailing slashes, query strings and hashes", () => {
    expect(isActivePath("/faq/", "/faq")).toBe(true);
    expect(isActivePath("/book?checkIn=2026-09-01", "/book")).toBe(true);
    expect(isActivePath("/faq#refunds", "/faq")).toBe(true);
  });
});

describe("activeNavHref", () => {
  it("picks the link for the current page", () => {
    expect(activeNavHref("/reviews", HEADER)).toBe("/reviews");
    expect(activeNavHref("/", HEADER)).toBe("/");
  });

  it("picks the section link for a nested page", () => {
    expect(activeNavHref("/blog/rush-valley-hikes", HEADER)).toBe("/blog");
  });

  it("prefers the most specific link when several match", () => {
    expect(activeNavHref("/admin/blog/7", ADMIN)).toBe("/admin/blog");
    expect(activeNavHref("/admin", ADMIN)).toBe("/admin");
  });

  it("returns null when the page is not in the nav", () => {
    expect(activeNavHref("/terms", HEADER.slice(1))).toBeNull();
  });
});
