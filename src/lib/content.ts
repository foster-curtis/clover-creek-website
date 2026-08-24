// Owner-editable site copy. These defaults render until the admin saves an
// override into the `site_content` table (Admin → Site Content). Only the
// slugs listed here are editable — structural text stays in code.

import { SITE } from "./site";

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
  {
    slug: "house_rules_stay",
    label: "House Rules — during your stay",
    hint: "One rule per line. Check-in/out times and max occupancy are shown automatically above these.",
  },
  {
    slug: "house_rules_checkout",
    label: "House Rules — at checkout",
    hint: "One rule per line.",
  },
  {
    slug: "house_rules_pets",
    label: "House Rules — pet policy details",
    hint: "One rule per line. The pet fee and weight limit above are pulled from Pricing automatically.",
  },
  {
    slug: "faq_checkin",
    label: "FAQ — check-in & check-out",
    hint: 'Answer to "What time is check-in and check-out?"',
  },
  {
    slug: "faq_fees",
    label: "FAQ — extra fees",
    hint: 'Answer to "Are there extra fees on top of the nightly rate?"',
  },
  {
    slug: "faq_guests",
    label: "FAQ — how many guests",
    hint: 'Answer to "How many people can stay?"',
  },
  {
    slug: "faq_pets",
    label: "FAQ — pets",
    hint: 'Answer to "Can I bring my pet?" — a link to the pet policy is added automatically after this.',
  },
  {
    slug: "faq_wifi",
    label: "FAQ — Wi-Fi & cell service",
    hint: 'Answer to "Is there Wi-Fi and cell service?"',
  },
  {
    slug: "faq_distance",
    label: "FAQ — distance from Salt Lake City",
    hint: 'Answer to "How far is the house from Salt Lake City?"',
  },
  {
    slug: "faq_grocery",
    label: "FAQ — groceries & gas",
    hint: 'Answer to "Where\'s the nearest grocery store and gas?"',
  },
  {
    slug: "faq_cancel",
    label: "FAQ — cancellations (intro line)",
    hint: "Shown before the refund schedule, which is generated automatically from the cancellation policy.",
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

  house_rules_stay: `No smoking of any kind.
No parties or large gatherings.
No kids standing on the furniture, especially under the TV.
No pets in or on the beds.`,

  house_rules_checkout: `Leave all used beds unmade — please don't pile used bedding on the floor.
Leave used towels in the bathtub.
Perishable food left behind should stay in the refrigerator — it's disposed of Friday morning (garbage day).
Turn off lights, heaters, fans and A/C.
Lock the door as you leave.`,

  house_rules_pets: `You are responsible for the care and safety of your pets — we assume no responsibility.
Be aware there is no fencing to secure your pet. A crate and lanyard are available for your use.
You are responsible for all pet cleanup.
Any inside accidents, or messes left in the yard, will result in an additional cleaning fee of $100 or more.
Skunk warning: do not leave your pets unattended while outside, especially when it's not full daylight — they could get sprayed.
Do not leave your pet loose in the house if you leave — any unattended pets must be crated.
No pets in beds. Crate pets at night.`,

  faq_checkin: `Check-in is generally ${SITE.checkInTime} or later, and check-out is by ${SITE.checkOutTime}. If you need something different, message us and we'll try to arrange it.`,

  faq_fees: `No — the cleaning fee and taxes are already included in the price you see. The only add-ons are extra guests beyond two and the dog fee.`,

  faq_guests: `Up to 6 guests. The master bedroom has a king bed and the loft has two double beds.`,

  faq_pets: `Dogs are welcome — up to 2 dogs at 50 lbs each, $20 per dog per day. Cats aren't allowed.`,

  faq_wifi: `Yes to both. Wi-Fi is available at the guest house — the network name and password are posted inside. Cell service in the area is reliable on essentially every carrier.`,

  faq_distance: `About an hour's drive southwest, on the far side of the Oquirrh Mountains — close enough for a day trip, far enough for real dark skies.`,

  faq_grocery: `Basic supplies are available in nearby Tooele (about 30 minutes). We recommend stocking up before you arrive — that's part of the charm out here.`,

  faq_cancel: `Yes — the refund depends on how far ahead of your check-in date you cancel:`,
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
