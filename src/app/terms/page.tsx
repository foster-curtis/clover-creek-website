import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 leading-relaxed text-stone-600">
      <h1 className="text-3xl font-bold text-stone-800">Terms of Service</h1>
      <p className="mt-2 text-sm text-stone-400">Last updated: July 2026</p>

      <h2 className="mt-8 text-xl font-bold text-stone-800">Booking &amp; payment</h2>
      <p className="mt-2">
        A booking is confirmed when payment is completed through Stripe. Rates include the
        cleaning fee and applicable taxes. Maximum occupancy is 6 guests; bookings exceeding the
        stated guest or pet count may be cancelled without refund.
      </p>

      <h2 className="mt-8 text-xl font-bold text-stone-800">Cancellations</h2>
      <p className="mt-2">
        Contact us as early as possible if your plans change. Refunds are issued per the
        cancellation policy communicated at booking. To request a cancellation, use your{" "}
        <Link href="/account" className="text-moss underline">booking page</Link> or email{" "}
        <a href={`mailto:${SITE.ownerEmail}`} className="text-moss underline">{SITE.ownerEmail}</a>.
      </p>

      <h2 className="mt-8 text-xl font-bold text-stone-800">House rules &amp; liability</h2>
      <p className="mt-2">
        Guests agree to the <Link href="/house-rules" className="text-moss underline">house rules
        and pet policy</Link> at booking. Guests are responsible for the care and safety of their
        pets and children; the property owner assumes no responsibility for injury to guests or
        pets, or for loss or damage to guests&apos; belongings, except where required by law.
        Damage to the property beyond normal wear, or extra cleaning caused by pets, may incur
        additional charges (minimum $100 for pet messes) billed to the payment method on file or
        by separate payment request.
      </p>

      <h2 className="mt-8 text-xl font-bold text-stone-800">Quiet, rural property</h2>
      <p className="mt-2">
        The house sits in a working farm setting. Wildlife (including skunks), farm activity,
        limited cell coverage and well water are part of rural life in Rush Valley.
      </p>
    </div>
  );
}
