// Transactional email via Resend. Every send is fire-and-forget: if Resend
// isn't configured (or a send fails) the booking still succeeds and we log
// instead — email must never take down checkout.

import { SITE } from "./site";
import { formatUSD, type Quote } from "./pricing";

const FROM = process.env.EMAIL_FROM ?? `${SITE.name} <onboarding@resend.dev>`;

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email skipped — RESEND_API_KEY not set] to=${to} subject=${subject}`);
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) console.error("Resend error:", error);
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

function layout(body: string): string {
  return `<div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #2d2a26;">
    <h2 style="color:#3f6212;">${SITE.name}</h2>
    ${body}
    <p style="margin-top:32px; font-size: 13px; color: #78716c;">
      ${SITE.name} · ${SITE.location.town}, ${SITE.location.region} ·
      <a href="mailto:${SITE.ownerEmail}">${SITE.ownerEmail}</a>
    </p>
  </div>`;
}

export interface BookingEmailInfo {
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  pets: number;
  quote: Quote;
  arrivalNotes?: string;
}

function quoteTable(quote: Quote): string {
  const rows = quote.nights
    .map(
      (n) =>
        `<tr><td style="padding:4px 12px 4px 0;">${n.date}${n.holiday ? ` (${n.holiday})` : n.weekendRate ? " (weekend)" : ""}</td>
         <td style="text-align:right;">${formatUSD(n.subtotal)}</td></tr>`
    )
    .join("");
  const pets = quote.petFee
    ? `<tr><td style="padding:4px 12px 4px 0;">Pet fee (${quote.pets} × ${quote.nightCount} nights)</td><td style="text-align:right;">${formatUSD(quote.petFee)}</td></tr>`
    : "";
  return `<table style="font-size:14px;">${rows}${pets}
    <tr><td style="padding-top:8px;font-weight:bold;">Total (cleaning &amp; taxes included)</td>
    <td style="padding-top:8px;text-align:right;font-weight:bold;">${formatUSD(quote.total)}</td></tr></table>`;
}

export async function sendBookingConfirmation(info: BookingEmailInfo): Promise<void> {
  const html = layout(`
    <p>Hi ${info.guestName},</p>
    <p>Your stay at ${SITE.name} is confirmed. We're looking forward to hosting you!</p>
    <p><strong>Check-in:</strong> ${info.checkIn} from ${SITE.checkInTime}<br/>
       <strong>Check-out:</strong> ${info.checkOut} by ${SITE.checkOutTime}<br/>
       <strong>Guests:</strong> ${info.guests}${info.pets ? ` · <strong>Dogs:</strong> ${info.pets}` : ""}</p>
    ${quoteTable(info.quote)}
    ${info.arrivalNotes ? `<p>${info.arrivalNotes}</p>` : ""}
    <p>House rules are on the website: <a href="${SITE.url}/house-rules">${SITE.url}/house-rules</a>.
    A quick recap for checkout morning: leave used beds unmade (please don't pile bedding on the
    floor), put used towels in the bathtub, leave perishables in the fridge, turn off lights,
    heaters, fans and A/C, and lock the door as you leave.</p>
    <p>Questions before your stay? Just reply to this email or message us from your
    <a href="${SITE.url}/account">booking page</a>.</p>
  `);
  await sendEmail(info.guestEmail, `Booking confirmed — ${SITE.name}`, html);
}

export async function notifyOwnerNewBooking(info: BookingEmailInfo): Promise<void> {
  const html = layout(`
    <p><strong>New booking!</strong></p>
    <p>${info.guestName} (${info.guestEmail})<br/>
    ${info.checkIn} → ${info.checkOut} · ${info.guests} guests${info.pets ? ` · ${info.pets} dog(s)` : ""}<br/>
    Total paid: <strong>${formatUSD(info.quote.total)}</strong></p>
    <p><a href="${SITE.url}/admin/calendar">Open the booking calendar</a></p>
  `);
  await sendEmail(SITE.ownerEmail, `New booking: ${info.checkIn} (${info.guestName})`, html);
}

export async function notifyOwnerInquiry(name: string, email: string, body: string): Promise<void> {
  const html = layout(`
    <p><strong>New inquiry from the website</strong></p>
    <p><strong>${name}</strong> · <a href="mailto:${email}">${email}</a></p>
    <p style="white-space:pre-wrap;">${body.replace(/</g, "&lt;")}</p>
  `);
  await sendEmail(SITE.ownerEmail, `Website inquiry from ${name}`, html);
}

export async function notifyNewMessage(
  to: string,
  fromName: string,
  preview: string,
  link: string
): Promise<void> {
  const html = layout(`
    <p><strong>${fromName}</strong> sent you a message:</p>
    <blockquote style="border-left:3px solid #d6d3d1;padding-left:12px;color:#57534e;">
      ${preview.slice(0, 300).replace(/</g, "&lt;")}
    </blockquote>
    <p><a href="${link}">Reply on the website</a></p>
  `);
  await sendEmail(to, `New message — ${SITE.name}`, html);
}
