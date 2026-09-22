"use client";

import { useMemo, useState } from "react";
import type { Review } from "@/lib/data";
import Stars from "@/components/Stars";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { CheckIcon } from "@/components/ui/icons";

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
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reviews…"
          aria-label="Search reviews"
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={ratingFilter === null ? "primary" : "ghost"}
            onClick={() => setRatingFilter(null)}
          >
            All ({reviews.length})
          </Button>
          {[5, 4, 3, 2, 1].map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={ratingFilter === n ? "primary" : "ghost"}
              onClick={() => setRatingFilter(n)}
            >
              {n}★ ({counts[n]})
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {filtered.length === 0 && (
          <Card variant="flat" className="!p-5 text-sm text-ink-muted">
            No reviews match your search.
          </Card>
        )}
        {filtered.map((r) => (
          <Card variant="flat" key={r.id} className="!p-5" role="article">
            <div className="flex items-center justify-between">
              <Stars rating={r.rating} />
              <time className="text-xs text-ink-subtle">
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
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-moss/10 px-2 py-0.5 text-xs font-normal text-moss-dark">
                  <CheckIcon className="h-3 w-3" /> Verified stay
                </span>
              )}
            </footer>
          </Card>
        ))}
      </div>
    </div>
  );
}
