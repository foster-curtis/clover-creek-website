import type { Metadata } from "next";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ path: "/privacy", title: "Privacy Policy" });

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[var(--w-prose)] px-4 py-10 leading-relaxed text-stone-600">
      <PageTitle>Privacy Policy</PageTitle>
      <p className="mt-2 text-sm text-ink-subtle">Last updated: July 2026</p>

      <SectionTitle as="h2" className="mt-8 !text-xl">What we collect</SectionTitle>
      <p className="mt-2">
        When you book a stay or contact us we collect your name, email address, phone number
        (optional), and the details of your stay (dates, guest count, pets). If you create an
        account, we store your sign-in email. We use privacy-friendly analytics to understand how
        the site is used (pages visited, approximate location); this data is aggregated and not
        used to identify you.
      </p>

      <SectionTitle as="h2" className="mt-8 !text-xl">Payments</SectionTitle>
      <p className="mt-2">
        Payments are processed by Stripe. We never see or store your card number. Stripe&apos;s
        privacy policy is available at stripe.com/privacy.
      </p>

      <SectionTitle as="h2" className="mt-8 !text-xl">How we use your information</SectionTitle>
      <p className="mt-2">
        We use your information only to manage your booking: confirmations, arrival details,
        messages between you and the host, and a post-stay review invitation. We don&apos;t sell
        your information or use it for third-party advertising.
      </p>

      <SectionTitle as="h2" className="mt-8 !text-xl">Your choices</SectionTitle>
      <p className="mt-2">
        To view, correct, or delete your information, email{" "}
        <a href={`mailto:${SITE.ownerEmail}`} className="text-moss underline">
          {SITE.ownerEmail}
        </a>
        . We&apos;ll keep booking records as needed for accounting and tax purposes.
      </p>
    </div>
  );
}
