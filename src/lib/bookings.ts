import type { User } from "@supabase/supabase-js";
import { hasServiceRole, supabaseAdmin } from "./supabase/server";

/**
 * Attach bookings made as a guest — no account at checkout, so `user_id` is
 * null — to the account that just signed in with the same address.
 *
 * Runs on sign-in and on the booking page itself, not only on /account: a
 * "new message" email links straight to the stay, and that page looks the
 * booking up by `user_id`, so an unclaimed booking would 404 the guest out of
 * the conversation they were invited into.
 */
export async function claimGuestBookings(user: User | null): Promise<void> {
  if (!user?.email || !hasServiceRole()) return;
  await supabaseAdmin()
    .from("bookings")
    .update({ user_id: user.id })
    .is("user_id", null)
    .eq("guest_email", user.email);
}
