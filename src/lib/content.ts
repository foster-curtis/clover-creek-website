// Owner-editable site copy. These defaults render until the admin saves an
// override into the `site_content` table (Admin → Site Content). Only the
// slugs listed here are editable — structural text stays in code.

export const CONTENT_SLUGS = [
  {
    slug: "home_intro",
    label: "Home page — main description",
    hint: "The welcome paragraph shown at the top of the home page.",
  },
  {
    slug: "amenities",
    label: "Amenity list",
    hint: "One amenity per line. Shown as a grid on the home page.",
  },
  {
    slug: "area",
    label: "The area",
    hint: "A paragraph about Rush Valley and nearby adventures.",
  },
  {
    slug: "arrival_notes",
    label: "Arrival notes",
    hint: "Shown to guests in their booking confirmation (directions, access details).",
  },
] as const;

export type ContentSlug = (typeof CONTENT_SLUGS)[number]["slug"];

export const DEFAULT_CONTENT: Record<ContentSlug, string> = {
  home_intro: `Nestled in Rush Valley, Utah, this adorable farmhouse offers a cozy retreat for guests seeking comfort and charm. The master bedroom features a king size bed, and the loft area has 2 double beds, all with premium linens, extra pillows and blankets for your comfort. The full bathroom has a tub/shower combo with complimentary shampoo, conditioner and body wash, plus extra towels, washcloths and a hairdryer.

A full laundry is included with detergent and fabric softener. The kitchen is full service with cookware, a coffee and tea bar, and all the extras. The home is climate controlled year round with heat and AC for your comfort.

Enjoy the patio with grill, swing and picnic table, or gather around the fire pit to take in the brilliant night sky. Adventures await nearby for a stay you'll really enjoy!`,

  amenities: `King bed in the master bedroom
Loft with 2 double beds
Premium linens, extra pillows & blankets
Full bathroom with tub/shower combo
Complimentary shampoo, conditioner & body wash
Full kitchen with cookware
Coffee & tea bar
Washer & dryer with detergent
Heat & air conditioning
Patio with grill, swing & picnic table
Fire pit under dark night skies
Free parking on premises
Dog friendly (2 max, 50 lb limit)`,

  area: `Rush Valley is a quiet ranching valley on the west side of the Oquirrh Mountains, about an hour from Salt Lake City. Days here are slow and the nights are genuinely dark — perfect for stargazing around the fire pit. Nearby you'll find hiking and horseback trails, ATV riding, hunting and rockhounding, the historic Pony Express Trail, and Bonneville Salt Flats day trips. Or just watch the farm go by from the porch swing.`,

  arrival_notes: `Check-in is at 3:00 PM or later unless we've made special arrangements — reply to this email if you need something different. We'll send directions and access details before your stay.`,
};

import { hasSupabase, supabaseServer } from "./supabase/server";

/** All site copy, with DB overrides applied when available. */
export async function getSiteContent(): Promise<Record<ContentSlug, string>> {
  const content = { ...DEFAULT_CONTENT };
  if (!hasSupabase()) return content;
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("site_content").select("slug, content");
    for (const row of data ?? []) {
      if (row.slug in content) content[row.slug as ContentSlug] = row.content;
    }
  } catch {
    // fall back to defaults
  }
  return content;
}
