// Transactional email via Resend. Every send is fire-and-forget: if Resend
// isn't configured (or a send fails) the booking still succeeds and we log
// instead — email must never take down checkout.
//
// The branded shell and its building blocks live in ./emailLayout; this file is
// only the messages.

import { SITE } from "./site";
import { formatStayRange, formatUSD, rateLines, type Quote } from "./pricing";
import {
  blockquote,
  button,
  detailRows,
  divider,
  esc,
  escLines,
  heading,
  link,
  panel,
  paragraph,
  renderEmail,
  stackedRows,
  subheading,
  type DetailRow,
  type EmailMessage,
} from "./emailLayout";

const FROM = process.env.EMAIL_FROM ?? `${SITE.name} <onboarding@resend.dev>`;

/**
 * Stand-in address for a manual booking taken over the phone, where the owner
 * has a name and a number but no email. Nothing behind it accepts mail.
 */
export const PLACEHOLDER_GUEST_EMAIL = "manual@booking.local";

/**
 * Whether an address can actually receive mail. Worth asking before a send
 * that a person is waiting on: a guest who can't be emailed has to be phoned
 * instead, and the owner can only know that if we say so.
 */
export function canEmail(address: string | null | undefined): boolean {
  if (!address) return false;
  const trimmed = address.trim().toLowerCase();
  if (trimmed === PLACEHOLDER_GUEST_EMAIL) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed);
}

// `replyTo` matters because the from-address is a send-only alias with no inbox behind
// it: without it, hitting Reply on any of these bounces. Owner notifications reply to the
// guest, guest notifications reply to the owner.
export async function sendEmail(
  to: string,
  subject: string,
  message: EmailMessage,
  replyTo?: string
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email skipped — RESEND_API_KEY not set] to=${to} subject=${subject}`);
    return;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html: message.html,
      // Sending a text part alongside the HTML keeps us out of the filters that
      // score HTML-only mail as bulk.
      text: message.text,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) console.error("Resend error:", error);
  } catch (err) {
    console.error("Email send failed:", err);
  }
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

/** The priced stay, as the booking widget shows it: rate lines, then the total. */
function quoteRows(quote: Quote): DetailRow[] {
  const nights = rateLines(quote.nights).map((line) => ({
    label: `${formatUSD(line.rate)} &times; ${line.nights} night${line.nights > 1 ? "s" : ""}`,
    value: formatUSD(line.total),
  }));
  const pets = quote.petFee
    ? [
        {
          label: `Pet fee (${quote.pets} &times; ${quote.nightCount} night${quote.nightCount > 1 ? "s" : ""})`,
          value: formatUSD(quote.petFee),
        },
      ]
    : [];
  return [
    ...nights,
    ...pets,
    {
      label: "Total <span style=\"font-weight:400;\">(cleaning &amp; taxes included)</span>",
      value: formatUSD(quote.total),
      strong: true,
      rule: true,
    },
  ];
}

export async function sendBookingConfirmation(info: BookingEmailInfo): Promise<void> {
  const guest = esc(info.guestName);
  const message = renderEmail({
    title: `Booking confirmed — ${SITE.name}`,
    preheader: `${formatStayRange(info.quote)} · ${info.quote.nightCount} night${
      info.quote.nightCount > 1 ? "s" : ""
    } · ${formatUSD(info.quote.total)} paid in full.`,
    body: `
      ${heading("Your stay is confirmed")}
      ${paragraph(`Hi ${guest}, we're looking forward to hosting you at ${esc(SITE.name)}.`)}
      ${panel(
        stackedRows([
          { label: "Check-in", value: `${esc(info.checkIn)}<br/>from ${SITE.checkInTime}` },
          { label: "Check-out", value: `${esc(info.checkOut)}<br/>by ${SITE.checkOutTime}` },
          {
            label: "Guests",
            value: `${info.guests} guest${info.guests > 1 ? "s" : ""}${
              info.pets ? ` &middot; ${info.pets} dog${info.pets > 1 ? "s" : ""}` : ""
            }`,
          },
        ])
      )}
      ${subheading("What you paid")}
      ${panel(detailRows(quoteRows(info.quote)))}
      ${info.arrivalNotes ? `${subheading("Before you arrive")}${paragraph(escLines(info.arrivalNotes))}` : ""}
      ${subheading("On checkout morning")}
      ${paragraph(
        `Leave used beds unmade (please don't pile bedding on the floor), put used towels in the
         bathtub, leave perishables in the fridge, turn off lights, heaters, fans and A/C, and lock
         the door as you leave. The full house rules are
         ${link(`${SITE.url}/house-rules`, "on the website")}.`
      )}
      ${divider()}
      ${paragraph("Questions before your stay? Reply to this email, or message us from your booking page.")}
      ${button(`${SITE.url}/account`, "View your booking")}`,
  });
  await sendEmail(info.guestEmail, `Booking confirmed — ${SITE.name}`, message, SITE.ownerEmail);
}

export async function notifyOwnerNewBooking(info: BookingEmailInfo): Promise<void> {
  const message = renderEmail({
    title: `New booking — ${SITE.name}`,
    preheader: `${info.guestName} booked ${info.checkIn} to ${info.checkOut} · ${formatUSD(info.quote.total)}`,
    body: `
      ${heading("New booking")}
      ${panel(
        stackedRows([
          {
            label: "Guest",
            value: `${esc(info.guestName)}<br/>${link(`mailto:${esc(info.guestEmail)}`, esc(info.guestEmail))}`,
          },
          { label: "Stay", value: `${esc(info.checkIn)}<br/>to ${esc(info.checkOut)}` },
          {
            label: "Party",
            value: `${info.guests} guest${info.guests > 1 ? "s" : ""}${
              info.pets ? ` &middot; ${info.pets} dog${info.pets > 1 ? "s" : ""}` : ""
            }`,
          },
        ]) +
          divider() +
          detailRows([{ label: "Total paid", value: formatUSD(info.quote.total), strong: true }])
      )}
      ${button(`${SITE.url}/admin/calendar`, "Open the calendar")}
      ${paragraph("Replying to this email goes straight to the guest.", { muted: true })}`,
  });
  await sendEmail(
    SITE.ownerEmail,
    `New booking: ${info.checkIn} (${info.guestName})`,
    message,
    info.guestEmail
  );
}

export async function notifyOwnerInquiry(name: string, email: string, body: string): Promise<void> {
  const message = renderEmail({
    title: `Website inquiry — ${SITE.name}`,
    preheader: `${name} sent a message from the contact form.`,
    body: `
      ${heading("New inquiry from the website")}
      ${paragraph(
        `<strong>${esc(name)}</strong> &middot;
         ${link(`mailto:${esc(email)}`, esc(email))}`
      )}
      ${blockquote(escLines(body))}
      ${paragraph("Replying to this email goes straight to them.", { muted: true })}`,
  });
  await sendEmail(SITE.ownerEmail, `Website inquiry from ${name}`, message, email);
}

export async function notifyNewMessage(
  to: string,
  fromName: string,
  preview: string,
  link: string,
  replyTo?: string
): Promise<void> {
  const trimmed = preview.slice(0, 300);
  const message = renderEmail({
    title: `New message — ${SITE.name}`,
    preheader: `${fromName}: ${trimmed.slice(0, 140)}`,
    body: `
      ${heading("You have a new message")}
      ${paragraph(`<strong>${esc(fromName)}</strong> wrote:`)}
      ${blockquote(escLines(trimmed) + (preview.length > 300 ? "&hellip;" : ""))}
      ${button(link, "Read and reply")}`,
  });
  await sendEmail(to, `New message — ${SITE.name}`, message, replyTo);
}

export interface CancellationEmailInfo {
  guestName: string;
  guestEmail: string;
  checkIn: string;
  totalCents: number;
  refundCents: number;
  /** null when the owner overrode the policy — we don't quote a tier we didn't apply. */
  percent: number | null;
  tierLabel: string;
  /** The whole payment went back, whether by policy or by the owner's choice. */
  full: boolean;
}

export async function sendCancellationConfirmation(info: CancellationEmailInfo): Promise<void> {
  const refund = formatUSD(info.refundCents / 100);
  const paid = formatUSD(info.totalCents / 100);
  const basis =
    info.percent === null
      ? info.full
        ? // An owner's exception, not the tier the guest booked under — say what
          // was done and don't cite a policy that would have paid them less.
          `We've refunded your payment of <strong>${paid}</strong> in full.`
        : `We've refunded <strong>${refund}</strong> of the ${paid} paid.`
      : info.percent === 0
        ? `Because the cancellation falls within ${info.tierLabel.toLowerCase()} of check-in, our
           cancellation policy does not provide a refund, so no money has been returned.`
        : `Cancelling ${info.tierLabel.toLowerCase()} before check-in earns a
           <strong>${info.percent}% refund</strong> under our cancellation policy, so
           <strong>${refund}</strong> of the ${paid} paid is on its way back to you.`;

  const message = renderEmail({
    title: `Booking cancelled — ${SITE.name}`,
    preheader:
      info.refundCents > 0
        ? `Your ${info.checkIn} stay is cancelled. ${refund} is on its way back to you.`
        : `Your ${info.checkIn} stay is cancelled.`,
    body: `
      ${heading("Your booking has been cancelled")}
      ${paragraph(
        `Hi ${esc(info.guestName)}, your stay at ${esc(SITE.name)} beginning
         ${esc(info.checkIn)} has been cancelled.`
      )}
      ${paragraph(basis)}
      ${
        info.refundCents > 0
          ? panel(
              detailRows([
                { label: "Originally paid", value: paid },
                { label: "Refunded", value: refund, strong: true, rule: true },
              ])
            ) +
            paragraph(
              "Refunds return to your original payment method and usually appear within 5–10 business days, depending on your bank.",
              { muted: true }
            )
          : ""
      }
      ${divider()}
      ${paragraph(
        `The full policy is ${link(`${SITE.url}/faq`, "on our website")}.
         If something here doesn't look right, just reply to this email.`
      )}
      ${paragraph("We're sorry to miss you, and we hope to host you another time.")}`,
  });
  await sendEmail(info.guestEmail, `Booking cancelled — ${SITE.name}`, message, SITE.ownerEmail);
}

export async function notifyOwnerCancellation(info: CancellationEmailInfo): Promise<void> {
  const basis =
    info.percent === null
      ? info.full
        ? "Full refund — override"
        : "Manual override"
      : `${info.percent}% — ${info.tierLabel}`;

  const message = renderEmail({
    title: `Booking cancelled — ${SITE.name}`,
    preheader: `${info.guestName} cancelled ${info.checkIn} · ${formatUSD(info.refundCents / 100)} refunded`,
    body: `
      ${heading("Booking cancelled")}
      ${panel(
        stackedRows([
          {
            label: "Guest",
            value: `${esc(info.guestName)}<br/>${link(`mailto:${esc(info.guestEmail)}`, esc(info.guestEmail))}`,
          },
          { label: "Check-in was", value: esc(info.checkIn) },
          { label: "Basis", value: esc(basis) },
        ]) +
          divider() +
          detailRows([
            { label: "Paid", value: formatUSD(info.totalCents / 100) },
            {
              label: "Refunded",
              value: formatUSD(info.refundCents / 100),
              strong: true,
              rule: true,
            },
          ])
      )}
      ${paragraph("Stripe's processing fee on the original charge is not returned.", { muted: true })}
      ${button(`${SITE.url}/admin/calendar`, "Open the calendar")}`,
  });
  await sendEmail(
    SITE.ownerEmail,
    `Cancelled: ${info.checkIn} (${info.guestName})`,
    message,
    info.guestEmail
  );
}
