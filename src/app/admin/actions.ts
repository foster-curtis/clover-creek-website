"use server";

// Admin server actions. Every action re-verifies the admin role server-side
// before touching data with the service-role client.

import { revalidatePath } from "next/cache";
import { getHolidays, getPricing } from "@/lib/data";
import { quoteStay, validateStay } from "@/lib/pricing";
import { isAdminUser, supabaseAdmin } from "@/lib/supabase/server";

async function requireAdmin() {
  if (!(await isAdminUser())) throw new Error("Not authorized");
  return supabaseAdmin();
}

function revalidatePublic() {
  for (const path of ["/", "/gallery", "/book", "/reviews", "/blog", "/house-rules"]) {
    revalidatePath(path);
  }
}

// --- site content ---------------------------------------------------------

export async function saveContent(formData: FormData) {
  const db = await requireAdmin();
  const slug = String(formData.get("slug"));
  const content = String(formData.get("content") ?? "").trim();
  await db
    .from("site_content")
    .upsert({ slug, content, updated_at: new Date().toISOString() });
  revalidatePublic();
  revalidatePath("/admin/content");
}

// --- pricing & holidays ---------------------------------------------------

export async function savePricing(formData: FormData) {
  const db = await requireAdmin();
  const num = (name: string) => Number(formData.get(name));
  await db
    .from("pricing_config")
    .update({
      weekday_base: num("weekdayBase"),
      weekend_base: num("weekendBase"),
      extra_guest_weekday: num("extraGuestWeekday"),
      extra_guest_weekend: num("extraGuestWeekend"),
      pet_fee_per_day: num("petFeePerDay"),
      max_guests: num("maxGuests"),
      max_pets: num("maxPets"),
      pet_weight_limit_lbs: num("petWeightLimitLbs"),
      min_stay_nights: num("minStayNights"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  revalidatePublic();
  revalidatePath("/admin/pricing");
}

export async function addHoliday(formData: FormData) {
  const db = await requireAdmin();
  const day = String(formData.get("day"));
  const label = String(formData.get("label") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(day) && label) {
    await db.from("holidays").upsert({ day, label });
  }
  revalidatePath("/admin/pricing");
  revalidatePath("/book");
}

export async function deleteHoliday(formData: FormData) {
  const db = await requireAdmin();
  await db.from("holidays").delete().eq("day", String(formData.get("day")));
  revalidatePath("/admin/pricing");
  revalidatePath("/book");
}

// --- calendar: blocks, manual bookings, status changes ---------------------

export async function blockDates(formData: FormData) {
  const db = await requireAdmin();
  const from = String(formData.get("from"));
  const to = String(formData.get("to"));
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from < to) {
    await db.from("blocked_dates").insert({ span: `[${from},${to})`, reason });
  }
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

export async function unblockDates(formData: FormData) {
  const db = await requireAdmin();
  await db.from("blocked_dates").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

export async function createManualBooking(formData: FormData) {
  const db = await requireAdmin();
  const checkIn = String(formData.get("from"));
  const checkOut = String(formData.get("to"));
  const guests = Number(formData.get("guests") ?? 2);
  const pets = Number(formData.get("pets") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || "manual@booking.local";

  const pricing = await getPricing();
  const stay = { checkIn, checkOut, guests, pets };
  if (!name || validateStay(stay, pricing)) return;

  const holidays = await getHolidays();
  const quote = quoteStay(stay, holidays, pricing);
  await db.from("bookings").insert({
    guest_name: name,
    guest_email: email,
    stay: `[${checkIn},${checkOut})`,
    guests,
    pets,
    quote,
    total_cents: quote.totalCents,
    status: "confirmed",
    notes: "manual booking (phone/walk-in)",
  });
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

export async function setBookingStatus(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (["pending", "confirmed", "completed", "cancelled"].includes(status)) {
    await db.from("bookings").update({ status }).eq("id", id);
  }
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

export async function refundBooking(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("id"));
  const { data: booking } = await db
    .from("bookings")
    .select("stripe_payment_intent")
    .eq("id", id)
    .single();

  if (booking?.stripe_payment_intent && process.env.STRIPE_SECRET_KEY) {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent });
  }
  await db
    .from("bookings")
    .update({ status: "cancelled", notes: "cancelled & refunded" })
    .eq("id", id);
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

// --- gallery ---------------------------------------------------------------

export async function updateGalleryImage(formData: FormData) {
  const db = await requireAdmin();
  await db
    .from("gallery_images")
    .update({
      caption: String(formData.get("caption") ?? "").trim() || null,
      alt: String(formData.get("alt") ?? "").trim() || null,
      sort_order: Number(formData.get("sortOrder") ?? 0),
    })
    .eq("id", String(formData.get("id")));
  revalidatePublic();
  revalidatePath("/admin/gallery");
}

export async function deleteGalleryImage(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("id"));
  const path = String(formData.get("storagePath"));
  await db.storage.from("gallery").remove([path]);
  await db.from("gallery_images").delete().eq("id", id);
  revalidatePublic();
  revalidatePath("/admin/gallery");
}

// --- reviews ----------------------------------------------------------------

export async function setReviewApproval(formData: FormData) {
  const db = await requireAdmin();
  await db
    .from("reviews")
    .update({ approved: formData.get("approved") === "true" })
    .eq("id", String(formData.get("id")));
  revalidatePublic();
  revalidatePath("/admin/reviews");
}

export async function deleteReview(formData: FormData) {
  const db = await requireAdmin();
  await db.from("reviews").delete().eq("id", String(formData.get("id")));
  revalidatePublic();
  revalidatePath("/admin/reviews");
}

export async function importReview(formData: FormData) {
  const db = await requireAdmin();
  const authorName = String(formData.get("authorName") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const stayedOn = String(formData.get("stayedOn") ?? "");
  if (!authorName || !body || !Number.isInteger(rating) || rating < 1 || rating > 5) return;
  await db.from("reviews").insert({
    author_name: authorName,
    body,
    rating,
    stayed_on: /^\d{4}-\d{2}-\d{2}$/.test(stayedOn) ? stayedOn : null,
    verified: false,
    approved: true, // imported by the owner, so pre-approved
  });
  revalidatePublic();
  revalidatePath("/admin/reviews");
}

// --- blog --------------------------------------------------------------------

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export async function savePost(formData: FormData) {
  const db = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim() || null;
  const published = formData.get("published") === "on";
  if (!title || !body) return;

  const slug = String(formData.get("slug") ?? "").trim() || slugify(title);
  const row = {
    title,
    slug,
    excerpt,
    body,
    published,
    published_at: published ? new Date().toISOString() : null,
  };
  if (id) {
    await db.from("blog_posts").update(row).eq("id", id);
  } else {
    await db.from("blog_posts").insert(row);
  }
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/admin/blog");
}

export async function deletePost(formData: FormData) {
  const db = await requireAdmin();
  await db.from("blog_posts").delete().eq("id", String(formData.get("id")));
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
}

// --- messages & inquiries -----------------------------------------------------

export async function markMessagesRead(bookingId: string) {
  const db = await requireAdmin();
  await db
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .eq("from_admin", false)
    .is("read_at", null);
}

export async function archiveInquiry(formData: FormData) {
  const db = await requireAdmin();
  await db.from("inquiries").update({ archived: true }).eq("id", String(formData.get("id")));
  revalidatePath("/admin/messages");
}
