import type { Metadata } from "next";
import Link from "next/link";
import AnswerBlock from "@/components/AnswerBlock";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { PageTitle } from "@/components/ui/Heading";
import { faqAnswer } from "@/lib/answers";
import { describeRefund, REFUND_TIERS } from "@/lib/cancellation";
import { getSiteContent } from "@/lib/content";
import { getPricing } from "@/lib/data";
import { faqEntries, faqSchemaItems, type FaqExtra } from "@/lib/faq";
import { faqPageSchema } from "@/lib/schema";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/faq",
  title: "FAQ",
  description:
    "Frequently asked questions about staying at the Clover Creek Guest House — check-in, pets, pricing and the Rush Valley area.",
});

export const revalidate = 3600;

// The rich content rendered after an answer. The FAQPage markup carries the same
// words as plain text (EXTRA_TEXT in src/lib/faq.ts) — change both together.
function Extra({ kind }: { kind: FaqExtra }) {
  switch (kind) {
    case "pets":
      return (
        <>
          {" "}
          Please read the{" "}
          <Link href="/house-rules#pets" className="text-moss underline">
            pet policy
          </Link>{" "}
          — the property isn&apos;t fenced, and skunks live in the valley, so pets shouldn&apos;t
          be left outside unattended.
        </>
      );
    case "cancellation":
      return (
        <>
          <ul className="mt-3 space-y-2">
            {REFUND_TIERS.map((tier) => (
              <li key={tier.label}>
                • <strong>{tier.label}</strong> before check-in — {describeRefund(tier.percent)}.
              </li>
            ))}
          </ul>
          <p className="mt-3">
            That schedule is the least we&apos;ll refund, not the most. We&apos;re a small family
            place, not a chain — if something serious has happened, tell us, and we can refund more
            than the schedule requires, up to everything you paid.
          </p>
          <p className="mt-3">
            Please contact us as soon as your plans change — reach out via your{" "}
            <Link href="/account" className="text-moss underline">
              booking page
            </Link>{" "}
            or by email and we&apos;ll take care of the refund.
          </p>
        </>
      );
    case "area-guide":
      return (
        <p className="mt-3">
          <Link href="/blog" className="text-moss underline">
            Read the Area Guide
          </Link>
        </p>
      );
  }
}

export default async function FaqPage() {
  const [content, pricing] = await Promise.all([getSiteContent(), getPricing()]);
  const faqs = faqEntries(content, pricing);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd data={faqPageSchema(faqSchemaItems(faqs))} />
      <Breadcrumbs crumbs={[{ name: "Frequently Asked Questions" }]} />
      <PageTitle>Frequently Asked Questions</PageTitle>
      <AnswerBlock text={faqAnswer(pricing)} className="mt-4" />

      <nav aria-label="Questions on this page" className="mt-8">
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {faqs.map((f) => (
            <li key={f.id}>
              <a href={`#${f.id}`} className="text-moss hover:underline">
                {f.question}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 space-y-3">
        {faqs.map((f) => (
          <section key={f.id} className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 id={f.id} className="scroll-mt-24 font-semibold text-stone-800">
              {f.question}
            </h2>
            <div className="mt-2 leading-relaxed text-stone-600">
              {f.answer}
              {f.extra && <Extra kind={f.extra} />}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
