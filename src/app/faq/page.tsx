import type { Metadata } from "next";
import Link from "next/link";
import { describeRefund, REFUND_TIERS } from "@/lib/cancellation";
import { getSiteContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about staying at the Clover Creek Guest House — check-in, pets, pricing and the Rush Valley area.",
};

export const revalidate = 3600;

export default async function FaqPage() {
  const content = await getSiteContent();

  const faqs: Array<{ q: string; a: React.ReactNode }> = [
    { q: "What time is check-in and check-out?", a: content.faq_checkin },
    { q: "Are there extra fees on top of the nightly rate?", a: content.faq_fees },
    { q: "How many people can stay?", a: content.faq_guests },
    {
      q: "Can I bring my pet?",
      a: (
        <>
          {content.faq_pets} Please read the{" "}
          <Link href="/house-rules#pets" className="text-moss underline">
            pet policy
          </Link>{" "}
          — the property isn&apos;t fenced, and skunks live in the valley, so pets shouldn&apos;t
          be left outside unattended.
        </>
      ),
    },
    { q: "Is there Wi-Fi and cell service?", a: content.faq_wifi },
    { q: "How far is the house from Salt Lake City?", a: content.faq_distance },
    { q: "Where's the nearest grocery store and gas?", a: content.faq_grocery },
    {
      q: "Can I cancel my booking?",
      a: (
        <>
          {content.faq_cancel}
          <ul className="mt-3 space-y-2">
            {REFUND_TIERS.map((tier) => (
              <li key={tier.label}>
                • <strong>{tier.label}</strong> before check-in — {describeRefund(tier.percent)}.
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Please contact us as soon as your plans change — reach out via your{" "}
            <Link href="/account" className="text-moss underline">
              booking page
            </Link>{" "}
            or by email and we&apos;ll take care of the refund.
          </p>
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-800">Frequently Asked Questions</h1>
      <div className="mt-8 space-y-3">
        {faqs.map(({ q, a }) => (
          <details key={q} className="group rounded-xl border border-stone-200 bg-white p-5">
            <summary className="cursor-pointer font-semibold text-stone-800 marker:text-moss">
              {q}
            </summary>
            <div className="mt-2 leading-relaxed text-stone-600">{a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
