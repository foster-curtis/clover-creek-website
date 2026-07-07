// Review submission. Requires a signed-in user; automatically applies the
// "verified stay" tag when the reviewer has a confirmed/completed past booking.

import { NextResponse, type NextRequest } from "next/server";
import {
  currentUser,
  hasServiceRole,
  supabaseAdmin,
} from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to leave a review." }, { status: 401 });
  }
  if (!hasServiceRole()) {
    return NextResponse.json({ error: "Reviews aren't available yet." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const authorName = String(body.authorName ?? "").trim();
  const text = String(body.body ?? "").trim();
  const rating = Number(body.rating);
  if (authorName.length < 2 || text.length < 10 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Please provide a name, rating and review text." }, { status: 400 });
  }

  const db = supabaseAdmin();

  // One review per user
  const { data: existing } = await db.from("reviews").select("id").eq("user_id", user.id).limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "You've already submitted a review — thank you!" },
      { status: 409 }
    );
  }

  // Verified stay: any confirmed or completed booking tied to this user or email.
  const { data: stays } = await db
    .from("bookings")
    .select("id")
    .in("status", ["confirmed", "completed"])
    .or(`user_id.eq.${user.id},guest_email.eq.${user.email}`)
    .limit(1);
  const verified = Boolean(stays && stays.length > 0);

  const { error } = await db.from("reviews").insert({
    user_id: user.id,
    booking_id: stays?.[0]?.id ?? null,
    author_name: authorName,
    rating,
    body: text,
    verified,
    approved: false, // owner approves before it appears
  });
  if (error) {
    console.error("Review insert failed:", error);
    return NextResponse.json({ error: "Could not save your review." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, verified });
}
