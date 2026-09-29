// The email design system: one branded shell plus the handful of building
// blocks every message is assembled from.
//
// Email clients are a decade behind browsers, so nothing here can be shared
// with globals.css. The rules that shape this file:
//   - Tables for layout. Outlook renders with Word, which has no flexbox, no
//     grid, and no reliable max-width on a <div>.
//   - Styles inline. Gmail strips <style> from forwarded and clipped messages,
//     so the <style> block below carries only progressive enhancement (mobile
//     padding); the design is complete without it.
//   - Literal hex, never var(). Custom properties don't resolve in Outlook.
//     The values are copied from the brand palette in globals.css.
//   - Every message ships a plain-text part too. HTML-only mail is a
//     deliverability penalty, and some clients still prefer text.

import { SITE } from "./site";

// Brand palette — kept in sync with @theme in src/app/globals.css.
const C = {
  parchment: "#f4efe4",
  cream: "#faf7f0",
  white: "#ffffff",
  moss: "#4d7c0f",
  mossDark: "#3f6212",
  mossDeep: "#35520f",
  clay: "#9c4f2f",
  hay: "#d9c58a",
  ink: "#292524",
  inkMuted: "#57534e",
  inkSubtle: "#6d6862",
  line: "#e2ddd2",
} as const;

// Lora and Inter can't be relied on — Gmail and Outlook ignore webfonts — so the
// stacks fall back to the same serif/sans pairing the site uses.
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** HTML-escape anything that came from a guest, an owner, or the database. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped text with its line breaks preserved — for owner-written copy. */
export function escLines(value: string): string {
  return esc(value.trim()).replace(/\r?\n/g, "<br/>");
}

// --- building blocks -------------------------------------------------------

/** The message's opening line. One per email, directly under the logo. */
export function heading(text: string): string {
  return `<h1 class="cc-h1" style="margin:0 0 18px;font-family:${SERIF};font-size:25px;line-height:1.3;font-weight:normal;color:${C.mossDeep};">${text}</h1>`;
}

/** A section label inside a longer message. */
export function subheading(text: string): string {
  return `<p style="margin:26px 0 10px;font-family:${SANS};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:${C.moss};">${text}</p>`;
}

export function paragraph(html: string, options: { muted?: boolean } = {}): string {
  const color = options.muted ? C.inkMuted : C.ink;
  const size = options.muted ? "14px" : "16px";
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:${size};line-height:1.6;color:${color};">${html}</p>`;
}

/** A parchment card — sets stay details and totals apart from the prose. */
export function panel(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;margin:0 0 20px;">
    <tr><td bgcolor="${C.cream}" style="padding:20px 22px;background-color:${C.cream};border:1px solid ${C.line};border-radius:10px;">${inner}</td></tr>
  </table>`;
}

export interface DetailRow {
  label: string;
  value: string;
  /** Renders at the weight of a total. */
  strong?: boolean;
  /** Draws a rule above the row — use it to separate a total from its lines. */
  rule?: boolean;
}

/**
 * Label above, value below. Long values — dates, addresses, email addresses —
 * belong here: a two-column row would have to hold them on one line, and at
 * phone width that pushes the whole message sideways.
 */
export function stackedRows(rows: Array<{ label: string; value: string }>): string {
  return rows
    .map(
      ({ label, value }, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;${i ? "margin-top:14px;" : ""}">
      <tr><td style="padding:0 0 3px;font-family:${SANS};font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.inkSubtle};">${label}</td></tr>
      <tr><td style="padding:0;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.ink};">${value}</td></tr>
    </table>`
    )
    .join("");
}

/**
 * Label-left, value-right rows — for money, where the amounts are short enough
 * to hold a column and lining them up is the whole point.
 */
export function detailRows(rows: DetailRow[]): string {
  const cells = rows
    .map(({ label, value, strong, rule }) => {
      const weight = strong ? "700" : "400";
      const pad = rule ? "12px 0 2px" : "4px 0";
      const top = rule ? `border-top:1px solid ${C.line};` : "";
      return `<tr>
        <td style="padding:${pad};${top}font-family:${SANS};font-size:14px;line-height:1.5;color:${strong ? C.ink : C.inkMuted};font-weight:${weight};">${label}</td>
        <td align="right" style="padding:${pad};${top}font-family:${SANS};font-size:14px;line-height:1.5;color:${C.ink};font-weight:${weight};white-space:nowrap;">${value}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${cells}</table>`;
}

/** The primary call to action. Table-wrapped so Outlook fills the whole button. */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:6px 0 20px;">
    <tr><td bgcolor="${C.mossDark}" style="border-radius:8px;background-color:${C.mossDark};">
      <a href="${href}" style="display:inline-block;padding:13px 30px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:${C.white};text-decoration:none;border-radius:8px;">${label}</a>
    </td></tr>
  </table>`;
}

/**
 * An inline link. Clients drop the <style> block often enough that link colour
 * has to be inline on every anchor, so it goes through here rather than being
 * spelled out at each call site.
 */
export function link(href: string, label: string): string {
  return `<a href="${href}" style="color:${C.moss};text-decoration:underline;">${label}</a>`;
}

/** Someone else's words — a chat message or an inquiry. */
export function blockquote(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">
    <tr><td style="padding:2px 0 2px 18px;border-left:3px solid ${C.hay};font-family:${SANS};font-size:15px;line-height:1.6;color:${C.inkMuted};">${html}</td></tr>
  </table>`;
}

export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:22px 0;">
    <tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:${C.line};">&nbsp;</td></tr>
  </table>`;
}

// --- the shell -------------------------------------------------------------

export interface EmailMessage {
  html: string;
  text: string;
}

function footerHtml(): string {
  const { streetAddress, town, region, postalCode } = SITE.location;
  const phone = SITE.phoneDisplay
    ? ` &middot; <a href="tel:${SITE.phoneHref}" style="color:${C.inkMuted};text-decoration:none;">${SITE.phoneDisplay}</a>`
    : "";
  return `<p style="margin:0 0 5px;font-family:${SERIF};font-size:15px;line-height:1.4;color:${C.mossDeep};">${SITE.name}</p>
    <p style="margin:0 0 14px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.inkSubtle};">${SITE.tagline}</p>
    <p style="margin:0 0 4px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.inkMuted};">${streetAddress}, ${town}, ${region} ${postalCode}</p>
    <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.inkMuted};">
      <a href="mailto:${SITE.ownerEmail}" style="color:${C.inkMuted};text-decoration:none;">${SITE.ownerEmail}</a>${phone} &middot;
      <a href="${SITE.url}" style="color:${C.moss};text-decoration:none;">Visit the website</a>
    </p>`;
}

function footerText(): string {
  const { streetAddress, town, region, postalCode } = SITE.location;
  const phone = SITE.phoneDisplay ? ` · ${SITE.phoneDisplay}` : "";
  return `${SITE.name} — ${SITE.tagline}
${streetAddress}, ${town}, ${region} ${postalCode}
${SITE.ownerEmail}${phone} · ${SITE.url}`;
}

/**
 * Wrap a body in the branded shell and derive its plain-text twin.
 *
 * `preheader` is the line inboxes show beside the subject. Left unset, Gmail
 * scrapes the first thing it finds — usually the footer address, which reads
 * like spam.
 */
export function renderEmail({
  title,
  preheader,
  body,
}: {
  title: string;
  preheader: string;
  body: string;
}): EmailMessage {
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<!-- The palette is warm and light by design; opting out of automatic dark mode
     keeps clients from inverting cream into mud. -->
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(title)}</title>
<style type="text/css">
  /* Progressive enhancement only — every rule here has an inline fallback. */
  @media only screen and (max-width: 620px) {
    .cc-pad { padding-left: 22px !important; padding-right: 22px !important; }
    .cc-logo { width: 176px !important; }
    .cc-h1 { font-size: 22px !important; }
  }
  /* Stop iOS and Outlook.com auto-linking dates and addresses in stray blue. */
  a[x-apple-data-detectors] {
    color: inherit !important; text-decoration: none !important;
    font-size: inherit !important; font-weight: inherit !important;
  }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${C.parchment};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.parchment};opacity:0;">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.parchment}" style="width:100%;border-collapse:collapse;background-color:${C.parchment};">
  <tr><td align="center" style="padding:28px 12px 36px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;">

      <tr><td height="4" bgcolor="${C.mossDark}" style="height:4px;line-height:4px;font-size:0;background-color:${C.mossDark};border-radius:12px 12px 0 0;">&nbsp;</td></tr>

      <tr><td align="center" bgcolor="${C.white}" class="cc-pad" style="padding:30px 40px 24px;background-color:${C.white};">
        <a href="${SITE.url}" style="text-decoration:none;"><img src="${SITE.url}/logo.png" width="200" alt="${esc(SITE.name)}" class="cc-logo" style="display:block;width:200px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" /></a>
      </td></tr>

      <tr><td bgcolor="${C.white}" class="cc-pad" style="padding:4px 40px 34px;background-color:${C.white};">${body}</td></tr>

      <tr><td bgcolor="${C.cream}" class="cc-pad" style="padding:24px 40px 28px;background-color:${C.cream};border-top:1px solid ${C.line};border-radius:0 0 12px 12px;">${footerHtml()}</td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { html, text: `${htmlToText(body)}\n\n---\n${footerText()}` };
}

// --- plain-text fallback ---------------------------------------------------

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&middot;": "·",
  "&times;": "×",
  "&rarr;": "→",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
};

/**
 * Derive the text part from the HTML body, so the two can never drift. Links
 * become "label (url)", table rows keep their columns, blocks become
 * paragraphs.
 */
export function htmlToText(html: string): string {
  return (
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      // Collapse whitespace the way a browser would, before any of it can be
      // mistaken for a line break the author intended. Real breaks are <br/> by
      // this point — escLines() has already converted the ones guests typed.
      .replace(/\s+/g, " ")
      .replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_m, href: string, label: string) => {
        const text = label.replace(/<[^>]+>/g, "").trim();
        const url = href.replace(/^mailto:/, "");
        return !text || text === url ? url : `${text} (${url})`;
      })
      .replace(/<br\s*\/?>/gi, "\n")
      // Every table in these emails is a label/value summary, so a colon reads
      // better than the column gap it stands in for.
      .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, ": ")
      .replace(/<\/tr>\s*/gi, "\n")
      .replace(/<\/(p|h1|h2|h3|h4|div|blockquote|table|li)>\s*/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/&#(\d+);/g, (_m, code: string) => {
        const n = Number(code);
        // Invisible spacers (the preheader padding, zero-width joiners) drop out.
        return n < 32 || (n >= 8192 && n <= 8303) || n === 65279 || n === 847
          ? ""
          : String.fromCharCode(n);
      })
      .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
      .replace(/&amp;/g, "&")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
