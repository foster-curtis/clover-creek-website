import type { Metadata } from "next";
import BookingWidget from "@/components/BookingWidget";
import { expandRanges, getHolidays, getPricing, getUnavailableRanges } from "@/lib/data";
import { SITE } from "@/lib/site";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Book a Stay",
  description:
    "Check availability and book the Clover Creek Guest House directly. Cleaning fee and taxes included in every rate.",
};

export const dynamic = "force-dynamic"; // availability must always be fresh

export default async function BookPage() {
  const [pricing, holidays, ranges, user] = await Promise.all([
    getPricing(),
    getHolidays(),
    getUnavailableRanges(),
    currentUser(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-800">Book your stay</h1>
      <p className="mt-2 max-w-2xl text-stone-600">
        Pick your dates to see the exact price — cleaning fee and taxes are always included.
        Check-in from {SITE.checkInTime}, check-out by {SITE.checkOutTime}.
      </p>
      <div className="mt-8">
        <BookingWidget
          pricing={pricing}
          unavailable={[...expandRanges(ranges)]}
          holidays={[...getHolidayEntries(holidays)]}
          prefill={{
            email: user?.email ?? undefined,
            name: (user?.user_metadata?.name as string | undefined) ?? undefined,
          }}
        />
      </div>
    </div>
  );
}

function getHolidayEntries(map: Map<string, string>): Array<[string, string]> {
  return [...map.entries()];
}
