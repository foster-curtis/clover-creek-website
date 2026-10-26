// JSON-LD builders — the single source of truth for the site's structured data.
// Keeping every schema block here means the name, address and phone (NAP) can
// never drift between pages, which is the whole point of the entity-consistency
// work in SEO_PLAN.md (§6.2, §8).
//
// The root layout emits the site-wide entity graph on every page (siteGraph):
//   - Organization  — the business behind the listing
//   - LodgingBusiness — the "local business" entity Google resolves site-wide
//   - WebSite — the site itself, published by the Organization
// The home page adds a second graph (homeGraph) with the VacationRental — the
// rentable unit itself (Rich Results Test target) — plus a merge node carrying
// the live price range and rating onto the LodgingBusiness @id.

import { photoForRole } from "@/content/gallery";
import type { Review } from "./data";
import { absoluteUrl } from "./seo";
import { SITE } from "./site";

const ORG_ID = `${SITE.url}/#organization`;
const BUSINESS_ID = `${SITE.url}/#lodging`;
const RENTAL_ID = `${SITE.url}/#vacation-rental`;
const WEBSITE_ID = `${SITE.url}/#website`;

/** The shared @ids, so any page can reference the site-wide entities. */
export const SCHEMA_IDS = {
  org: ORG_ID,
  business: BUSINESS_ID,
  rental: RENTAL_ID,
  website: WEBSITE_ID,
} as const;

/**
 * The main exterior photo, used wherever a single representative image is wanted.
 * It is the gallery's own hero photo rather than a second copy of the same shot, so
 * the URL Google resolves is always one the site actually renders.
 */
export const MAIN_IMAGE_URL = `${SITE.url}${photoForRole("hero").src}`;

/** 1200x630 social share card. Also the Organization logo stand-in until one exists. */
export const OG_IMAGE_URL = `${SITE.url}/og-default.jpg`;

const TELEPHONE = SITE.phoneDisplay || undefined;

// An empty array in JSON-LD is noise, so sameAs only appears once a listing is live.
function sameAs() {
  return SITE.sameAs.length > 0 ? { sameAs: [...SITE.sameAs] } : {};
}

// Byte-identical postal address for every schema block (SEO_PLAN.md §6.2).
function postalAddress() {
  return {
    "@type": "PostalAddress",
    streetAddress: SITE.location.streetAddress,
    addressLocality: SITE.location.town,
    addressRegion: SITE.location.regionCode,
    postalCode: SITE.location.postalCode,
    addressCountry: SITE.location.country,
  };
}

function geoCoordinates() {
  return {
    "@type": "GeoCoordinates",
    latitude: SITE.location.lat,
    longitude: SITE.location.lng,
  };
}

// Curated amenity list (SEO_PLAN.md §8.1) — stable and deliberately short, rather
// than the wordy owner-editable amenity copy shown on the page.
const AMENITIES = [
  "Free WiFi",
  "Full kitchen",
  "Washer and dryer",
  "Heating and air conditioning",
  "Fire pit",
  "Covered patio with grill",
  "Free parking on premises",
  "Pets allowed",
] as const;

function amenityFeature() {
  return AMENITIES.map((name) => ({
    "@type": "LocationFeatureSpecification",
    name,
    value: true,
  }));
}

export interface AggregateRatingInput {
  ratingValue: number;
  reviewCount: number;
}

function aggregateRating(input: AggregateRatingInput) {
  return {
    "@type": "AggregateRating",
    ratingValue: input.ratingValue,
    reviewCount: input.reviewCount,
    bestRating: 5,
    worstRating: 1,
  };
}

function reviewNode(r: Review) {
  return {
    "@type": "Review",
    author: { "@type": "Person", name: r.authorName },
    datePublished: (r.stayedOn ?? r.createdAt).slice(0, 10),
    reviewRating: {
      "@type": "Rating",
      ratingValue: r.rating,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: r.body,
  };
}

// Descriptions default to SITE.description so schema text cannot drift from page
// to page; the parameter is kept only for a deliberate future override.

export function organizationSchema(opts: { description?: string } = {}) {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE.name,
    description: opts.description ?? SITE.description,
    url: SITE.url,
    // No dedicated logo asset yet — the share card reads better in a knowledge panel
    // than a 2000px-wide photo.
    logo: OG_IMAGE_URL,
    image: MAIN_IMAGE_URL,
    email: SITE.ownerEmail,
    ...(TELEPHONE ? { telephone: TELEPHONE } : {}),
    address: postalAddress(),
    ...sameAs(),
  };
}

// The root layout calls this with no arguments, so price range and rating are
// optional — those are live values the home page attaches via businessRatingNode().
export function lodgingBusinessSchema(
  opts: {
    description?: string;
    image?: string[];
    priceRange?: string;
    aggregateRating?: AggregateRatingInput | null;
  } = {}
) {
  return {
    "@type": "LodgingBusiness",
    "@id": BUSINESS_ID,
    name: SITE.name,
    description: opts.description ?? SITE.description,
    url: SITE.url,
    image: opts.image ?? [MAIN_IMAGE_URL],
    email: SITE.ownerEmail,
    ...(TELEPHONE ? { telephone: TELEPHONE } : {}),
    ...(opts.priceRange ? { priceRange: opts.priceRange } : {}),
    currenciesAccepted: "USD",
    paymentAccepted: "Credit Card",
    address: postalAddress(),
    geo: geoCoordinates(),
    checkinTime: "15:00",
    checkoutTime: "11:00",
    petsAllowed: true,
    smokingAllowed: false,
    numberOfRooms: 2,
    maximumAttendeeCapacity: 6,
    amenityFeature: amenityFeature(),
    parentOrganization: { "@id": ORG_ID },
    ...sameAs(),
    ...(opts.aggregateRating ? { aggregateRating: aggregateRating(opts.aggregateRating) } : {}),
  };
}

// No SearchAction: the site has no search page, and a SearchAction pointing nowhere
// is markup that lies about the site. Add one if and when a /search route exists.
export function webSiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    publisher: { "@id": ORG_ID },
    inLanguage: "en-US",
  };
}

export function vacationRentalSchema(opts: {
  description?: string;
  image: string[];
  reviews: Review[];
  aggregateRating?: AggregateRatingInput | null;
}) {
  return {
    "@type": "VacationRental",
    "@id": RENTAL_ID,
    name: SITE.name,
    description: opts.description ?? SITE.description,
    url: SITE.url,
    image: opts.image,
    additionalType: "EntirePlace",
    // Stable, unique listing id. propertyID names the scheme; value never changes.
    identifier: {
      "@type": "PropertyValue",
      propertyID: "clovercreekguesthouse.com",
      value: "clover-creek-guest-house-rush-valley-ut",
    },
    brand: { "@id": ORG_ID },
    address: postalAddress(),
    geo: geoCoordinates(),
    latitude: SITE.location.lat,
    longitude: SITE.location.lng,
    numberOfBedrooms: 1,
    numberOfBathroomsTotal: 1,
    occupancy: { "@type": "QuantitativeValue", value: 6 },
    petsAllowed: true,
    checkinTime: "15:00",
    checkoutTime: "11:00",
    amenityFeature: amenityFeature(),
    tourBookingPage: `${SITE.url}/book`,
    containsPlace: {
      "@type": "Accommodation",
      additionalType: "EntirePlace",
      name: "Entire farmhouse cottage",
      numberOfBedrooms: 1,
      numberOfBathroomsTotal: 1,
      occupancy: { "@type": "QuantitativeValue", value: 6 },
      bed: [
        { "@type": "BedDetails", numberOfBeds: 1, typeOfBed: "King" },
        { "@type": "BedDetails", numberOfBeds: 2, typeOfBed: "Double" },
      ],
      amenityFeature: amenityFeature(),
    },
    ...(opts.reviews.length ? { review: opts.reviews.slice(0, 12).map(reviewNode) } : {}),
    ...(opts.aggregateRating ? { aggregateRating: aggregateRating(opts.aggregateRating) } : {}),
  };
}

/**
 * FAQPage for /faq (SEO_PLAN.md §8.3). Answers must be plain text — never JSX or HTML.
 * Google retired FAQ rich results in May 2026, so this earns no SERP feature; it is
 * here because AI answer engines parse explicit Q&A pairs well.
 */
export function faqPageSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

/**
 * The entity graph rendered on every page (SEO_PLAN.md §8.1). Static constants only —
 * this runs in the root layout, so it must never touch the database.
 */
export function siteGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationSchema(), lodgingBusinessSchema(), webSiteSchema()],
  };
}

/**
 * A partial LodgingBusiness carrying only live values. Consumers merge nodes that
 * share an @id within a page, so this attaches the current rating and price range to
 * the site-wide business entity without repeating it.
 */
export function businessRatingNode(opts: {
  priceRange?: string;
  aggregateRating?: AggregateRatingInput | null;
}) {
  return {
    "@type": "LodgingBusiness",
    "@id": BUSINESS_ID,
    ...(opts.priceRange ? { priceRange: opts.priceRange } : {}),
    ...(opts.aggregateRating ? { aggregateRating: aggregateRating(opts.aggregateRating) } : {}),
  };
}

/**
 * The home page's own `@graph`: the VacationRental plus the live-values merge node.
 * Organization and LodgingBusiness come from the root layout's siteGraph().
 */
export function homeGraph(opts: {
  images: string[];
  reviews: Review[];
  priceRange: string;
  aggregateRating?: AggregateRatingInput | null;
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      businessRatingNode({ priceRange: opts.priceRange, aggregateRating: opts.aggregateRating }),
      vacationRentalSchema({
        image: opts.images,
        reviews: opts.reviews,
        aggregateRating: opts.aggregateRating,
      }),
    ],
  };
}

export interface Crumb {
  name: string;
  /** Site-relative path. Omit on the final crumb — the current page. */
  path?: string;
}

/**
 * BreadcrumbList for a page (SEO_PLAN.md §10.3). "Home" is prepended automatically,
 * so callers pass only the trail below it. The last item has no `item` URL — Google's
 * documented pattern for the current page.
 */
export function breadcrumbListSchema(crumbs: Crumb[]) {
  const all: Crumb[] = [{ name: "Home", path: "/" }, ...crumbs];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: absoluteUrl(c.path) } : {}),
    })),
  };
}
