import Link from "next/link";
import { redirect } from "next/navigation";
import { formatUSD } from "@/lib/pricing";
import {
  currentUser,
  hasServiceRole,
  supabaseAdmin,
  supabaseServer,
} from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-moss/10 text-moss-dark",
  pending: "bg-amber-100 text-amber-800",
  completed: "bg-stone-100 text-stone-600",
  cancelled: "bg-red-50 text-red-700",
};

function parseStay(stay: string): { checkIn: string; checkOut: string } {
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  return { checkIn: m?.[1] ?? "", checkOut: m?.[2] ?? "" };
}

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");

  // Link any bookings made as a guest (before signing in) to this account.
  if (hasServiceRole() && user.email) {
    await supabaseAdmin()
      .from("bookings")
      .update({ user_id: user.id })
      .is("user_id", null)
      .eq("guest_email", user.email);
  }

  const supabase = await supabaseServer();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, stay, guests, pets, status, total_cents, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-stone-800">My Stays</h1>
        <SignOutButton />
      </div>
      <p className="mt-1 text-sm text-stone-500">{user.email}</p>

      <div className="mt-8 space-y-4">
        {(bookings ?? []).length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
            <p className="text-stone-600">You don&apos;t have any stays yet.</p>
            <Link
              href="/book"
              className="mt-4 inline-block rounded-full bg-moss px-6 py-2.5 font-semibold text-white hover:bg-moss-dark"
            >
              Book your first stay
            </Link>
          </div>
        )}
        {(bookings ?? []).map((b) => {
          const { checkIn, checkOut } = parseStay(b.stay);
          return (
            <Link
              key={b.id}
              href={`/account/bookings/${b.id}`}
              className="block rounded-xl border border-stone-200 bg-white p-5 hover:border-moss"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-stone-800">
                  {checkIn} → {checkOut}
                </p>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold ${STATUS_STYLES[b.status] ?? ""}`}
                >
                  {b.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                {b.guests} guest{b.guests > 1 ? "s" : ""}
                {b.pets > 0 && ` · ${b.pets} dog${b.pets > 1 ? "s" : ""}`} ·{" "}
                {formatUSD(b.total_cents / 100)}
              </p>
              <p className="mt-2 text-sm text-moss">View details &amp; message the host →</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
