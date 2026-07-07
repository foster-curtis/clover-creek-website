import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about staying at the Clover Creek Guest House — check-in, pets, pricing and the Rush Valley area.",
};

const FAQS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "What time is check-in and check-out?",
    a: `Check-in is generally ${SITE.checkInTime} or later, and check-out is by ${SITE.checkOutTime}. If you need something different, message us and we'll try to arrange it.`,
  },
  {
    q: "Are there extra fees on top of the nightly rate?",
    a: "No — the cleaning fee and taxes are already included in the price you see. The only add-ons are extra guests beyond two and the dog fee.",
  },
  {
    q: "How many people can stay?",
    a: "Up to 6 guests. The master bedroom has a king bed and the loft has two double beds.",
  },
  {
    q: "Can I bring my pet?",
    a: (
      <>
        Dogs are welcome — up to 2 dogs at 50 lbs each, $20 per dog per day. Cats aren&apos;t
        allowed. Please read the{" "}
        <Link href="/house-rules#pets" className="text-moss underline">
          pet policy
        </Link>{" "}
        — the property isn&apos;t fenced, and skunks live in the valley, so pets shouldn&apos;t be
        left outside unattended.
      </>
    ),
  },
  {
    q: "Is there Wi-Fi and cell service?",
    a: "Rush Valley is rural, so coverage varies by carrier. Ask us about current Wi-Fi availability when you book.",
  },
  {
    q: "How far is the house from Salt Lake City?",
    a: "About an hour's drive southwest, on the far side of the Oquirrh Mountains — close enough for a day trip, far enough for real dark skies.",
  },
  {
    q: "Where's the nearest grocery store and gas?",
    a: "Basic supplies are available in nearby Tooele (about 30 minutes). We recommend stocking up before you arrive — that's part of the charm out here.",
  },
  {
    q: "Can I cancel my booking?",
    a: (
      <>
        Contact us as soon as your plans change — reach out via your{" "}
        <Link href="/account" className="text-moss underline">
          booking page
        </Link>{" "}
        or email and we&apos;ll work with you on a refund per our cancellation policy.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-800">Frequently Asked Questions</h1>
      <div className="mt-8 space-y-3">
        {FAQS.map(({ q, a }) => (
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
