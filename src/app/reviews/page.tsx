import type { Metadata } from "next";
import ReviewForm from "@/components/ReviewForm";
import ReviewsBrowser from "@/components/ReviewsBrowser";
import RatingSummary from "@/components/RatingSummary";
import { buttonClasses } from "@/components/ui/Button";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { getApprovedReviews } from "@/lib/data";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Guest Reviews",
  description: "Reviews from guests who have stayed at the Clover Creek Guest House.",
};

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [reviews, user] = await Promise.all([getApprovedReviews(), currentUser()]);

  const avgRating =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageTitle>Guest Reviews</PageTitle>
          {avgRating !== null ? (
            <div className="mt-2">
              <RatingSummary average={avgRating} count={reviews.length} />
            </div>
          ) : (
            <p className="mt-2 text-stone-600">Be the first to review your stay!</p>
          )}
        </div>
        <a href="#leave-review" className={buttonClasses("primary", "md")}>
          Leave a Review
        </a>
      </div>

      <div className="mt-8">
        <ReviewsBrowser reviews={reviews} />
      </div>

      <SectionTitle as="h2" id="leave-review" className="mt-12 scroll-mt-24 !text-xl">
        Leave a review
      </SectionTitle>
      <div className="mt-4">
        <ReviewForm signedIn={Boolean(user)} />
      </div>
    </div>
  );
}
