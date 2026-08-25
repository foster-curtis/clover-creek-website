"use client";

import { useState, useTransition } from "react";
import { updateReview } from "../actions";

const inputCls =
  "mt-1 block rounded border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-moss focus:outline-none";
const smallBtnCls =
  "rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:border-moss hover:text-moss";

export default function EditReviewForm({
  review,
}: {
  review: { id: string; author_name: string; rating: number; stayed_on: string | null; body: string };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <details className="group" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={smallBtnCls + " inline-block cursor-pointer list-none"}>Edit</summary>
      <form
        className="mt-3 space-y-3 rounded-lg border border-stone-200 p-3"
        action={(formData) => {
          startTransition(async () => {
            await updateReview(formData);
            setOpen(false);
          });
        }}
      >
        <input type="hidden" name="id" value={review.id} />
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-stone-500">
            Guest name
            <input name="authorName" required defaultValue={review.author_name} className={inputCls} />
          </label>
          <label className="text-xs text-stone-500">
            Rating (1–5)
            <input
              type="number"
              name="rating"
              min={1}
              max={5}
              defaultValue={review.rating}
              required
              className={inputCls + " w-20"}
            />
          </label>
          <label className="text-xs text-stone-500">
            Stay date (optional)
            <input type="date" name="stayedOn" defaultValue={review.stayed_on ?? ""} className={inputCls} />
          </label>
        </div>
        <label className="block text-xs text-stone-500">
          Review text
          <textarea name="body" required rows={3} defaultValue={review.body} className={inputCls + " w-full"} />
        </label>
        <button type="submit" disabled={pending} className={smallBtnCls}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </details>
  );
}
