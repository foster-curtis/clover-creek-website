import { describe, expect, it } from "vitest";
import type { PostMeta } from "../content/blog/types";
import type { Review } from "./data";
import { DEFAULT_PRICING } from "./pricing";
import {
  OG_IMAGE_URL,
  SCHEMA_IDS,
  aboutBusinessPageSchema,
  blogIndexSchema,
  blogPostingSchema,
  bookingOfferSchema,
  imageGallerySchema,
  reviewsPageGraph,
} from "./schema";
import { SITE } from "./site";

const post: PostMeta = {
  slug: "tooele-utah-guide",
  title: "Tooele, Utah",
  excerpt: "Groceries and gas.",
  publishedAt: "2026-08-24",
};

const review = (n: number): Review => ({
  id: `r${n}`,
  authorName: `Guest ${n}`,
  rating: 5,
  body: "Lovely stay.",
  verified: true,
  featured: false,
  stayedOn: null,
  createdAt: "2026-05-01T12:00:00Z",
});

// The whole point of the per-page blocks: they point at the site-wide entities and
// never restate them. A `name` or `address` here would be a second business.
function expectReferenceOnly(node: Record<string, unknown>) {
  expect(node).not.toHaveProperty("name");
  expect(node).not.toHaveProperty("address");
}

describe("per-page schema (SEO_PLAN.md §8.3)", () => {
  it("reviews page emits every review, attached to the business @id", () => {
    const reviews = Array.from({ length: 19 }, (_, i) => review(i));
    const graph = reviewsPageGraph({
      reviews,
      aggregateRating: { ratingValue: 5, reviewCount: 19 },
    });
    const [business] = graph["@graph"];
    expect(business["@id"]).toBe(SCHEMA_IDS.business);
    expect(business.review).toHaveLength(19);
    expect(business.aggregateRating?.reviewCount).toBe(19);
    expectReferenceOnly(business);
  });

  it("gallery emits absolute image URLs and drops empty text", () => {
    const schema = imageGallerySchema([
      { src: "/gallery/a.jpg", alt: "The porch", caption: "Porch" },
      { src: "/gallery/b.jpg", alt: "", caption: "" },
    ]);
    const [a, b] = schema.associatedMedia;
    expect(a.contentUrl).toBe(`${SITE.url}/gallery/a.jpg`);
    expect(a).toMatchObject({ caption: "Porch", description: "The porch" });
    expect(b).not.toHaveProperty("caption");
    expect(b).not.toHaveProperty("description");
    expect(schema.about).toEqual({ "@id": SCHEMA_IDS.business });
  });

  it("about-business page points at the business and the site", () => {
    const page = aboutBusinessPageSchema({ path: "/house-rules", name: "Rules", description: "d" });
    expect(page["@id"]).toBe(`${SITE.url}/house-rules#webpage`);
    expect(page.about).toEqual({ "@id": SCHEMA_IDS.business });
    expect(page.isPartOf).toEqual({ "@id": SCHEMA_IDS.website });
  });

  it("booking offer reads the two-guest base rates from pricing", () => {
    const offer = bookingOfferSchema({ ...DEFAULT_PRICING, weekdayBase: 90, weekendBase: 130 });
    expect(offer).toMatchObject({ lowPrice: 90, highPrice: 130, priceCurrency: "USD" });
    expect(offer.itemOffered).toEqual({ "@id": SCHEMA_IDS.rental });
    expect(offer).not.toHaveProperty("priceValidUntil");
  });

  it("blog index entries share @ids with the post pages", () => {
    const blog = blogIndexSchema([post]);
    expect(blog.blogPost[0]["@id"]).toBe(blogPostingSchema(post)["@id"]);
    expect(blogPostingSchema(post).isPartOf).toEqual({ "@id": blog["@id"] });
  });

  it("an unbylined, uncovered, unrevised post gets honest fallbacks", () => {
    const schema = blogPostingSchema(post);
    expect(schema.author).toEqual({ "@id": SCHEMA_IDS.org });
    expect(schema.image).toBe(OG_IMAGE_URL);
    expect(schema.dateModified).toBe(schema.datePublished);
  });

  it("dates posts as midnight at the property, with the offset for that date", () => {
    expect(blogPostingSchema(post).datePublished).toBe("2026-08-24T00:00:00-06:00");
    expect(blogPostingSchema({ ...post, publishedAt: "2026-12-01" }).datePublished).toBe(
      "2026-12-01T00:00:00-07:00",
    );
    expect(blogIndexSchema([post]).blogPost[0].datePublished).toBe("2026-08-24T00:00:00-06:00");
  });

  it("a byline naming the business resolves to the Organization", () => {
    expect(blogPostingSchema({ ...post, author: SITE.name }).author).toEqual({ "@id": SCHEMA_IDS.org });
  });

  it("a bylined, covered, revised post uses its own data", () => {
    const schema = blogPostingSchema({
      ...post,
      author: "Jane Doe",
      updatedAt: "2026-10-01",
      cover: { src: { src: "/_next/static/media/c.jpg", width: 1, height: 1 }, alt: "" },
    });
    expect(schema.author).toEqual({ "@type": "Person", name: "Jane Doe" });
    expect(schema.image).toBe(`${SITE.url}/_next/static/media/c.jpg`);
    expect(schema.dateModified).toBe("2026-10-01T00:00:00-06:00");
  });

  it("caps the headline at 110 characters", () => {
    expect(blogPostingSchema({ ...post, title: "x".repeat(200) }).headline).toHaveLength(110);
  });
});
