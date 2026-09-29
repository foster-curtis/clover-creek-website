import { describe, expect, it } from "vitest";
import { blockquote, esc, escLines, htmlToText, paragraph, renderEmail } from "./emailLayout";

describe("esc", () => {
  it("neutralizes markup a guest could type into a name or a message", () => {
    expect(esc('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
    expect(esc("Ben & Jerry's")).toBe("Ben &amp; Jerry&#39;s");
  });

  it("escapes the ampersand before the entities it would otherwise double-encode", () => {
    expect(esc("a & <b>")).toBe("a &amp; &lt;b&gt;");
  });
});

describe("escLines", () => {
  it("keeps the line breaks an owner or guest typed", () => {
    expect(escLines("one\ntwo")).toBe("one<br/>two");
  });

  it("still escapes markup", () => {
    expect(escLines("<b>hi</b>\nthere")).toBe("&lt;b&gt;hi&lt;/b&gt;<br/>there");
  });
});

describe("htmlToText", () => {
  it("renders links as label plus url", () => {
    expect(htmlToText('<p>See <a href="https://x.test/faq">the policy</a>.</p>')).toBe(
      "See the policy (https://x.test/faq)."
    );
  });

  it("drops the mailto: scheme so the address reads plainly", () => {
    expect(htmlToText('<p><a href="mailto:a@b.test">a@b.test</a></p>')).toBe("a@b.test");
  });

  it("collapses the source formatting of a wrapped template literal", () => {
    const html = paragraph(`one
       two
       three`);
    expect(htmlToText(html)).toBe("one two three");
  });

  it("keeps breaks the author asked for", () => {
    expect(htmlToText(blockquote("one<br/>two"))).toBe("one\ntwo");
  });

  it("joins a label/value row with a colon", () => {
    expect(htmlToText("<table><tr><td>Total</td><td>$485</td></tr></table>")).toBe("Total: $485");
  });

  it("decodes entities without leaving a stray &amp;", () => {
    expect(htmlToText("<p>Ben &amp; Jerry&#39;s &times; 2</p>")).toBe("Ben & Jerry's × 2");
  });
});

describe("renderEmail", () => {
  const message = renderEmail({
    title: "Booking confirmed",
    preheader: "Three nights in October.",
    body: paragraph("Hi <strong>Dana</strong>, you are booked."),
  });

  it("carries the preheader for the inbox preview", () => {
    expect(message.html).toContain("Three nights in October.");
  });

  it("keeps the preheader out of the text part, where it would read twice", () => {
    expect(message.text).not.toContain("Three nights in October.");
    expect(message.text.startsWith("Hi Dana, you are booked.")).toBe(true);
  });

  it("ships a text part alongside the html", () => {
    expect(message.html).toContain("<!DOCTYPE html");
    expect(message.text).not.toContain("<");
  });
});
