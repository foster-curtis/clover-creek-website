"use client";

import { useMemo, useState } from "react";
import type { Review } from "@/lib/data";
import Stars from "@/components/Stars";

export default function ReviewsBrowser({ reviews }: { reviews: Review[] }) {
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0];
    for (const r of reviews) c[r.rating] = (c[r.rating] ?? 0) + 1;
    return c;
  }, [reviews]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (ratingFilter !== null && r.rating !== ratingFilter) return false;
      if (term && !r.body.toLowerCase().includes(term) && !r.authorName.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [reviews, search, ratingFilter]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reviews…"
          aria-label="Search reviews"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRatingFilter(null)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              ratingFilter === null
                ? "bg-moss text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            All ({reviews.length})
          </button>
          {[5, 4, 3, 2, 1].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRatingFilter(n)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                ratingFilter === n
                  ? "bg-moss text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {n}★ ({counts[n]})
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {filtered.length === 0 && (
          <p className="rounded-lg border border-stone-200 bg-white p-5 text-sm text-stone-500">
            No reviews match your search.
          </p>
        )}
        {filtered.map((r) => (
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
    </div>
  );
}
