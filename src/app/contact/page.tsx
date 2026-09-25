import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { PageTitle } from "@/components/ui/Heading";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/contact",
  title: "Contact",
  description: "Questions about the Clover Creek Guest House? Send us a message.",
});

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageTitle>Contact us</PageTitle>
      <p className="mt-2 text-stone-600">
        Questions about the house, your dates, or bringing your dog? Send a note and we&apos;ll get
        back to you. You can also email{" "}
        <a href={`mailto:${SITE.ownerEmail}`} className="text-moss underline">
          {SITE.ownerEmail}
        </a>
        {SITE.phoneDisplay && (
          <>
            {" "}or call{" "}
            <a href={`tel:${SITE.phoneHref}`} className="text-moss underline">
              {SITE.phoneDisplay}
            </a>
          </>
        )}
        .
      </p>
      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  );
}
