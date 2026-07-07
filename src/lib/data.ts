// Server-side data access. Every function degrades gracefully when Supabase
// isn't configured yet, so the site builds and previews before any accounts
// are set up.

import { holidayMap } from "./holidays";
import { DEFAULT_PRICING, type PricingConfig, addDays } from "./pricing";
import { hasServiceRole, hasSupabase, supabaseAdmin, supabaseServer } from "./supabase/server";

export interface GalleryImage {
  id: string;
  src: string;
  caption: string | null;
  alt: string;
  sortOrder: number;
}

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  verified: boolean;
  stayedOn: string | null;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  publishedAt: string | null;
}

export interface DateRange {
  from: string; // inclusive
  to: string; // exclusive
}

// --- pricing ------------------------------------------------------------

export async function getPricing(): Promise<PricingConfig> {
  if (!hasSupabase()) return DEFAULT_PRICING;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("pricing_config").select("*").eq("id", 1).single();
    if (!data) return DEFAULT_PRICING;
    return {
      weekdayBase: Number(data.weekday_base),
      weekendBase: Number(data.weekend_base),
      extraGuestWeekday: Number(data.extra_guest_weekday),
      extraGuestWeekend: Number(data.extra_guest_weekend),
      petFeePerDay: Number(data.pet_fee_per_day),
      maxGuests: data.max_guests,
      maxPets: data.max_pets,
      petWeightLimitLbs: data.pet_weight_limit_lbs,
      minStayNights: data.min_stay_nights,
    };
  } catch {
    return DEFAULT_PRICING;
  }
}

/** Federal holidays for this year and the next two, plus DB extras. */
export async function getHolidays(): Promise<Map<string, string>> {
  const year = new Date().getFullYear();
  let extras: Array<{ day: string; label: string }> = [];
  if (hasSupabase()) {
    try {
      const supabase = await supabaseServer();
      const { data } = await supabase.from("holidays").select("day, label");
      extras = data ?? [];
    } catch {
      // federal only
    }
  }
  return holidayMap(year, year + 2, extras);
}

// --- gallery ------------------------------------------------------------

const PLACEHOLDER_GALLERY: GalleryImage[] = [
  { id: "p1", src: "/placeholders/farmhouse.svg", caption: "The guest house", alt: "Clover Creek Guest House exterior", sortOrder: 0 },
  { id: "p2", src: "/placeholders/bedroom.svg", caption: "Master bedroom with king bed", alt: "Master bedroom", sortOrder: 1 },
  { id: "p3", src: "/placeholders/kitchen.svg", caption: "Full kitchen with coffee & tea bar", alt: "Kitchen", sortOrder: 2 },
  { id: "p4", src: "/placeholders/firepit.svg", caption: "Fire pit under the night sky", alt: "Fire pit", sortOrder: 3 },
];

export function galleryPublicUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/gallery/${storagePath}`;
}

export async function getGallery(): Promise<GalleryImage[]> {
  if (!hasSupabase()) return PLACEHOLDER_GALLERY;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("gallery_images")
      .select("id, storage_path, caption, alt, sort_order")
      .order("sort_order");
    if (!data || data.length === 0) return PLACEHOLDER_GALLERY;
    return data.map((row) => ({
      id: row.id,
      src: galleryPublicUrl(row.storage_path),
      caption: row.caption,
      alt: row.alt ?? row.caption ?? "Clover Creek Guest House",
      sortOrder: row.sort_order,
    }));
  } catch {
    return PLACEHOLDER_GALLERY;
  }
}

// --- availability -------------------------------------------------------

function parseDateRange(range: string): DateRange | null {
  // Postgres daterange text form: [2026-07-01,2026-07-04)
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(range);
  if (!m) return null;
  let from = m[1];
  let to = m[2];
  if (range.startsWith("(")) from = addDays(from, 1);
  if (range.endsWith("]")) to = addDays(to, 1);
  return { from, to };
}

/** Date ranges (half-open) that cannot be booked: active bookings + blocks. */
export async function getUnavailableRanges(): Promise<DateRange[]> {
  if (!hasSupabase()) return [];
  try {
    // Release expired pending holds first so their dates reopen.
    if (hasServiceRole()) {
      await supabaseAdmin().rpc("expire_stale_holds");
    }
    const supabase = await supabaseServer();
    const client = hasServiceRole() ? supabaseAdmin() : supabase;
    const [{ data: bookings }, { data: blocks }] = await Promise.all([
      client.from("bookings").select("stay, status").in("status", ["pending", "confirmed"]),
      client.from("blocked_dates").select("span"),
    ]);
    const ranges: DateRange[] = [];
    for (const b of bookings ?? []) {
      const r = parseDateRange(b.stay);
      if (r) ranges.push(r);
    }
    for (const b of blocks ?? []) {
      const r = parseDateRange(b.span);
      if (r) ranges.push(r);
    }
    return ranges;
  } catch {
    return [];
  }
}

/** Expand half-open ranges into a set of unavailable night dates. */
export function expandRanges(ranges: DateRange[]): Set<string> {
  const nights = new Set<string>();
  for (const { from, to } of ranges) {
    for (let d = from; d < to; d = addDays(d, 1)) nights.add(d);
  }
  return nights;
}

// --- reviews ------------------------------------------------------------

const SAMPLE_REVIEWS: Review[] = [
  {
    id: "s1",
    authorName: "Past guest",
    rating: 5,
    body: "Reviews from previous stays will appear here once imported.",
    verified: false,
    stayedOn: null,
    createdAt: new Date().toISOString(),
  },
];

export async function getApprovedReviews(): Promise<Review[]> {
  if (!hasSupabase()) return SAMPLE_REVIEWS;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("reviews")
      .select("id, author_name, rating, body, verified, stayed_on, created_at")
      .eq("approved", true)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => ({
      id: r.id,
      authorName: r.author_name,
      rating: r.rating,
      body: r.body,
      verified: r.verified,
      stayedOn: r.stayed_on,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

// --- blog ---------------------------------------------------------------

export async function getPublishedPosts(): Promise<BlogPost[]> {
  if (!hasSupabase()) return [];
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, body, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false });
    return (data ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      body: p.body,
      publishedAt: p.published_at,
    }));
  } catch {
    return [];
  }
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  if (!hasSupabase()) return null;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, body, published_at")
      .eq("slug", slug)
      .eq("published", true)
      .single();
    if (!data) return null;
    return {
      id: data.id,
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt,
      body: data.body,
      publishedAt: data.published_at,
    };
  } catch {
    return null;
  }
}
