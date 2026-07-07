import type { Metadata } from "next";
import ReviewForm from "@/components/ReviewForm";
import Stars from "@/components/Stars";
import { getApprovedReviews } from "@/lib/data";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Guest Reviews",
  description: "Reviews from guests who have stayed at the Clover Creek Guest House.",
};

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [reviews, user] = await Promise.all([getApprovedReviews(), currentUser()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-800">Guest Reviews</h1>
      <p className="mt-2 text-stone-600">
        {reviews.length > 0
          ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} from our guests.`
          : "Be the first to review your stay!"}
      </p>

      <div className="mt-8 space-y-4">
        {reviews.map((r) => (
          <article key={r.id} className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <Stars rating={r.rating} />
              <time className="text-xs text-stone-400">
                {new Date(r.stayedOn ?? r.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </div>
            <p className="mt-3 leading-relaxed text-stone-600">{r.body}</p>
            <footer className="mt-3 text-sm font-semibold text-stone-700">
              {r.authorName}
              {r.verified && (
                <span className="ml-2 rounded-full bg-moss/10 px-2 py-0.5 text-xs font-normal text-moss-dark">
                  ✓ Verified stay
                </span>
              )}
            </footer>
          </article>
        ))}
      </div>

      <h2 className="mt-12 text-xl font-bold text-stone-800">Leave a review</h2>
      <div className="mt-4">
        <ReviewForm signedIn={Boolean(user)} />
      </div>
    </div>
  );
}
