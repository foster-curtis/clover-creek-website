// JSON-LD builders — the single source of truth for the site's structured data.
// Keeping every schema block here means the name, address and phone (NAP) can
// never drift between pages, which is the whole point of the entity-consistency
// work in SEO_PLAN.md (§6.2, §8).
//
// Three entities are emitted on the home page as one `@graph`:
//   - Organization  — the business behind the listing
//   - LodgingBusiness — the "local business" entity Google resolves site-wide
//   - VacationRental — the rentable unit itself (Rich Results Test target)

import type { Review } from "./data";
import { SITE } from "./site";

const ORG_ID = `${SITE.url}/#organization`;
const BUSINESS_ID = `${SITE.url}/#lodging`;
const RENTAL_ID = `${SITE.url}/#vacation-rental`;

/** The main exterior photo, used wherever a single representative image is wanted. */
export const MAIN_IMAGE_URL = `${SITE.url}/guest-house-main.JPG`;

const TELEPHONE = SITE.phoneDisplay || undefined;

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

export function organizationSchema(opts: { description: string }) {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE.name,
    description: opts.description,
    url: SITE.url,
    // No dedicated logo asset yet — the main exterior photo stands in for both.
    logo: MAIN_IMAGE_URL,
    image: MAIN_IMAGE_URL,
    email: SITE.ownerEmail,
    ...(TELEPHONE ? { telephone: TELEPHONE } : {}),
    address: postalAddress(),
  };
}

export function lodgingBusinessSchema(opts: {
  description: string;
  image: string[];
  priceRange: string;
  aggregateRating?: AggregateRatingInput | null;
}) {
  return {
    "@type": "LodgingBusiness",
    "@id": BUSINESS_ID,
    name: SITE.name,
    description: opts.description,
    url: SITE.url,
    image: opts.image,
    email: SITE.ownerEmail,
    ...(TELEPHONE ? { telephone: TELEPHONE } : {}),
    priceRange: opts.priceRange,
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
    ...(opts.aggregateRating ? { aggregateRating: aggregateRating(opts.aggregateRating) } : {}),
  };
}

export function vacationRentalSchema(opts: {
  description: string;
  image: string[];
  reviews: Review[];
  aggregateRating?: AggregateRatingInput | null;
}) {
  return {
    "@type": "VacationRental",
    "@id": RENTAL_ID,
    name: SITE.name,
    description: opts.description,
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

/** The full `@graph` for the home page: Organization + LodgingBusiness + VacationRental. */
export function homeGraph(opts: {
  description: string;
  images: string[];
  reviews: Review[];
  priceRange: string;
  aggregateRating?: AggregateRatingInput | null;
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema({ description: opts.description }),
      lodgingBusinessSchema({
        description: opts.description,
        image: [MAIN_IMAGE_URL],
        priceRange: opts.priceRange,
        aggregateRating: opts.aggregateRating,
      }),
      vacationRentalSchema({
        description: opts.description,
        image: opts.images,
        reviews: opts.reviews,
        aggregateRating: opts.aggregateRating,
      }),
    ],
  };
}
