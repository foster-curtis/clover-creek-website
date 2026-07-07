import Image from "next/image";
import Link from "next/link";
import LocationMap from "@/components/LocationMap";
import Stars from "@/components/Stars";
import { getSiteContent } from "@/lib/content";
import { getApprovedReviews, getGallery, getPricing } from "@/lib/data";
import { formatUSD } from "@/lib/pricing";
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: SITE.name,
    description: content.home_intro.split("\n")[0],
    url: SITE.url,
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.location.town,
      addressRegion: SITE.location.region,
      postalCode: SITE.location.postalCode,
      addressCountry: SITE.location.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: SITE.location.lat, longitude: SITE.location.lng },
    checkinTime: "15:00",
    checkoutTime: "11:00",
    petsAllowed: true,
    ...(avgRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: avgRating,
            reviewCount: reviews.length,
          },
        }
      : {}),
  };

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
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-10 text-white">
            <h1 className="font-serif text-3xl font-bold drop-shadow sm:text-5xl">{SITE.name}</h1>
            <p className="mt-2 max-w-xl text-sm drop-shadow sm:text-lg">{SITE.tagline}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/book"
                className="rounded-full bg-moss px-6 py-3 font-semibold text-white shadow hover:bg-moss-dark"
              >
                Check availability
              </Link>
              <span className="rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur">
                From {formatUSD(pricing.weekdayBase)}/night · taxes &amp; cleaning included
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="text-2xl font-bold text-stone-800">A cozy retreat on a working farm</h2>
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
      </section>

      {/* Amenities */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-bold text-stone-800">Everything you need</h2>
          <ul className="mt-6 grid gap-x-8 gap-y-2 text-stone-600 sm:grid-cols-2 lg:grid-cols-3">
            {amenities.map((a) => (
              <li key={a} className="flex items-start gap-2">
                <span className="mt-1 text-moss">✓</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold text-stone-800">Simple, honest pricing</h2>
        <p className="mt-2 text-stone-600">
          Cleaning fee and taxes are already included — the price you see is the price you pay.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Weeknights · Sun–Thu
            </p>
            <p className="mt-2 font-serif text-4xl font-bold text-moss">
              {formatUSD(pricing.weekdayBase)}
              <span className="text-base font-normal text-stone-500"> /night for 2 guests</span>
            </p>
            <p className="mt-2 text-sm text-stone-600">
              +{formatUSD(pricing.extraGuestWeekday)} per additional guest (up to {pricing.maxGuests})
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Weekends &amp; holidays · Fri–Sat
            </p>
            <p className="mt-2 font-serif text-4xl font-bold text-moss">
              {formatUSD(pricing.weekendBase)}
              <span className="text-base font-normal text-stone-500"> /night for 2 guests</span>
            </p>
            <p className="mt-2 text-sm text-stone-600">
              +{formatUSD(pricing.extraGuestWeekend)} per additional guest (up to {pricing.maxGuests})
            </p>
          </div>
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
        <section className="bg-white py-12">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-bold text-stone-800">What guests say</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {topReviews.map((r) => (
                <blockquote key={r.id} className="rounded-xl border border-stone-200 p-5">
                  <Stars rating={r.rating} />
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">
                    {r.body.length > 200 ? r.body.slice(0, 200) + "…" : r.body}
                  </p>
                  <footer className="mt-3 text-sm font-semibold text-stone-700">
                    {r.authorName}
                    {r.verified && (
                      <span className="ml-2 rounded-full bg-moss/10 px-2 py-0.5 text-xs font-normal text-moss-dark">
                        ✓ Verified stay
                      </span>
                    )}
                  </footer>
                </blockquote>
              ))}
            </div>
            <Link href="/reviews" className="mt-6 inline-block text-moss underline">
              Read all reviews →
            </Link>
          </div>
        </section>
      )}

      {/* Area + map */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold text-stone-800">Out here, the stars still shine</h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-stone-600">{content.area}</p>
        <div className="mt-6">
          <LocationMap />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-4 text-center">
        <div className="rounded-2xl bg-moss px-6 py-12 text-white">
          <h2 className="font-serif text-2xl font-bold sm:text-3xl">Ready for some quiet?</h2>
          <p className="mx-auto mt-2 max-w-md text-white/85">
            Book direct and skip the platform fees — cleaning and taxes are always included.
          </p>
          <Link
            href="/book"
            className="mt-6 inline-block rounded-full bg-white px-8 py-3 font-semibold text-moss hover:bg-cream"
          >
            Check availability
          </Link>
        </div>
      </section>
    </>
  );
}
