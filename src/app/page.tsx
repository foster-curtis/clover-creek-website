import Image from "next/image";
import Link from "next/link";
import LocationMap from "@/components/LocationMap";
import RatingSummary from "@/components/RatingSummary";
import Stars from "@/components/Stars";
import Card from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { ArrowRightIcon, CheckIcon } from "@/components/ui/icons";
import { getSiteContent } from "@/lib/content";
import { getApprovedReviews, getGallery, getPricing } from "@/lib/data";
import { formatUSD } from "@/lib/pricing";
import { homeGraph, MAIN_IMAGE_URL } from "@/lib/schema";
import { SITE } from "@/lib/site";

export const revalidate = 300; // re-render at most every 5 minutes

export default async function HomePage() {
  const [content, pricing, gallery, reviews] = await Promise.all([
    getSiteContent(),
    getPricing(),
    getGallery(),
    getApprovedReviews(),
  ]);

  const amenities = content.amenities.split("\n").map((a) => a.trim()).filter(Boolean);
  const topReviews = reviews.slice(0, 3);
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  // Schema images: the main exterior photo first, then every gallery photo
  // (absolute URLs — Google requires 8+ for a vacation rental listing).
  const schemaImages = [
    MAIN_IMAGE_URL,
    ...gallery.map((g) => (g.src.startsWith("http") ? g.src : `${SITE.url}${g.src}`)),
  ].filter((url, i, all) => all.indexOf(url) === i);

  const jsonLd = homeGraph({
    description: content.home_intro.split("\n")[0],
    images: schemaImages,
    reviews,
    priceRange: `$${pricing.weekdayBase}-$${pricing.weekendBase}`,
    aggregateRating: avgRating ? { ratingValue: avgRating, reviewCount: reviews.length } : null,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="relative">
        <div className="relative h-[52vh] min-h-[320px] w-full sm:h-[64vh]">
          <Image
            src={gallery[0].src}
            alt={gallery[0].alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-moss-deep/85 via-moss-deep/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-10 sm:px-8 lg:px-16">
            <div className="mx-auto max-w-[var(--w-wide)]">
              <PageTitle className="!text-5xl !text-white drop-shadow">{SITE.name}</PageTitle>
              <p className="mt-2 max-w-xl font-serif text-lg italic text-white/90 drop-shadow sm:text-xl">
                {SITE.tagline}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link href="/book" className={buttonClasses("primary", "lg")}>
                  Check availability
                </Link>
                <span className="rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur">
                  From {formatUSD(pricing.weekdayBase)}/night · taxes &amp; cleaning included
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intro — editorial pairing, image bleeding to the viewport edge */}
      <section className="grid lg:grid-cols-[6fr_5fr]">
        <div className="relative order-2 h-72 lg:order-1 lg:h-auto lg:min-h-[420px]">
          <Image
            src={gallery[Math.min(1, gallery.length - 1)].src}
            alt={gallery[Math.min(1, gallery.length - 1)].alt}
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="order-1 flex items-center bg-surface lg:order-2">
          <div className="px-4 py-12 sm:px-8 lg:px-12">
            <SectionTitle rule>A cozy retreat on a working farm</SectionTitle>
            {content.home_intro.split("\n\n").map((para, i) => (
              <p key={i} className="mt-4 leading-relaxed text-stone-600">
                {para}
              </p>
            ))}
            <ul className="mt-6 flex flex-wrap gap-2 text-sm">
              {["Sleeps 6", "1 bath", "King bed + loft", "Dog friendly", "Full kitchen", "Washer & dryer"].map(
                (chip) => (
                  <li key={chip} className="rounded-full bg-moss/10 px-3 py-1 text-moss-dark">
                    {chip}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="bg-surface-sunken py-12">
        <div className="mx-auto max-w-5xl px-4">
          <SectionTitle rule>Everything you need</SectionTitle>
          <ul className="mt-6 grid gap-x-8 gap-y-2 text-stone-600 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((a) => (
              <li key={a} className="flex items-start gap-2">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-moss" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <SectionTitle rule>Simple, honest pricing</SectionTitle>
        <p className="mt-2 text-stone-600">
          Cleaning fee and taxes are already included — the price you see is the price you pay.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card variant="raised" className="relative overflow-hidden pt-8">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-moss" />
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Weeknights · Sun–Thu
            </p>
            <p className="mt-2 font-serif text-5xl font-bold text-moss-deep">
              {formatUSD(pricing.weekdayBase)}
              <span className="text-base font-normal text-ink-muted"> /night for 2 guests</span>
            </p>
            <p className="mt-3 text-sm text-stone-600">
              +{formatUSD(pricing.extraGuestWeekday)} per additional guest (up to {pricing.maxGuests})
            </p>
          </Card>
          <Card variant="raised" className="relative overflow-hidden pt-8">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-clay" />
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Weekends &amp; holidays · Fri–Sat
            </p>
            <p className="mt-2 font-serif text-5xl font-bold text-clay">
              {formatUSD(pricing.weekendBase)}
              <span className="text-base font-normal text-ink-muted"> /night for 2 guests</span>
            </p>
            <p className="mt-3 text-sm text-stone-600">
              +{formatUSD(pricing.extraGuestWeekend)} per additional guest (up to {pricing.maxGuests})
            </p>
          </Card>
        </div>
        <p className="mt-4 text-sm text-stone-600">
          Bringing a dog? {formatUSD(pricing.petFeePerDay)}/day each, up to {pricing.maxPets} dogs (
          {pricing.petWeightLimitLbs} lb limit, no cats). See the{" "}
          <Link href="/house-rules" className="text-moss underline">
            house rules &amp; pet policy
          </Link>
          .
        </p>
      </section>

      {/* Reviews teaser */}
      {topReviews.length > 0 && (
        <section className="bg-surface-sunken py-12">
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>What guests say</SectionTitle>
              {avgRating !== null && <RatingSummary average={avgRating} count={reviews.length} />}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {topReviews.map((r) => (
                <Card key={r.id} variant="flat" className="!p-5">
                  <Stars rating={r.rating} />
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">
                    {r.body.length > 200 ? r.body.slice(0, 200) + "…" : r.body}
                  </p>
                  <footer className="mt-3 text-sm font-semibold text-stone-700">
                    {r.authorName}
                    {r.verified && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-moss/10 px-2 py-0.5 text-xs font-normal text-moss-dark">
                        <CheckIcon className="h-3 w-3" /> Verified stay
                      </span>
                    )}
                  </footer>
                </Card>
              ))}
            </div>
            <Link href="/reviews" className="mt-6 inline-flex items-center gap-1 text-moss underline">
              Read all reviews <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* Area — editorial pairing, alternating side from the intro section */}
      <section className="grid lg:grid-cols-[5fr_6fr]">
        <div className="flex items-center bg-surface">
          <div className="px-4 py-12 sm:px-8 lg:px-12">
            <SectionTitle rule>Out here, the stars still shine</SectionTitle>
            <p className="mt-4 leading-relaxed text-stone-600">{content.area}</p>
            <div className="mt-6">
              <LocationMap />
            </div>
          </div>
        </div>
        <div className="relative h-72 lg:h-auto lg:min-h-[420px]">
          <Image
            src={gallery[Math.min(3, gallery.length - 1)].src}
            alt={gallery[Math.min(3, gallery.length - 1)].alt}
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-4 text-center">
        <div className="rounded-2xl bg-moss px-6 py-12 text-white">
          <SectionTitle className="!text-white sm:!text-3xl">Ready for some quiet?</SectionTitle>
          <p className="mx-auto mt-2 max-w-md text-white/85">
            Book direct and skip the platform fees — cleaning and taxes are always included.
          </p>
          <Link
            href="/book"
            className={buttonClasses("primary", "lg", "mt-6 !bg-white !text-moss hover:!bg-cream")}
          >
            Check availability
          </Link>
        </div>
      </section>
    </>
  );
}
