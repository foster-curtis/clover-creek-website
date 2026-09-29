import type { Metadata } from "next";
import { after } from "next/server";
import BookingWidget from "@/components/BookingWidget";
import { PageTitle } from "@/components/ui/Heading";
import { expandRanges, getHolidays, getPricing, getUnavailableRanges } from "@/lib/data";
import { syncAllFeeds } from "@/lib/icalSync";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { currentUser, hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = pageMetadata({
  path: "/book",
  title: "Book a Stay",
  description:
    "Check availability and book the Clover Creek Guest House directly. Cleaning fee and taxes included in every rate.",
});

export const dynamic = "force-dynamic"; // availability must always be fresh

export default async function BookPage() {
  // Refresh the other sites' calendars after this page has been sent, not
  // before: availability that is minutes stale is fine to show, and a slow
  // Airbnb must never be something a guest waits on. The next visitor sees the
  // result, and /api/checkout refreshes again — blocking, briefly — before any
  // money moves. `after` runs once the response is flushed, so nothing here is
  // on the render path.
  if (hasServiceRole()) {
    after(async () => {
      try {
        await syncAllFeeds(supabaseAdmin(), { onlyStale: true });
      } catch (e) {
        // Nobody is waiting on this; a throw here would only litter the logs
        // with an unhandled rejection. syncFeed already records each failure.
        console.error("Background calendar sync failed:", e);
      }
    });
  }

  const [pricing, holidays, ranges, user] = await Promise.all([
    getPricing(),
    getHolidays(),
    getUnavailableRanges(),
    currentUser(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageTitle>Book your stay</PageTitle>
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
