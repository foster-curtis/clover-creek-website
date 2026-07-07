"use client";

import { useState } from "react";

export default function ReviewForm({ signedIn }: { signedIn: boolean }) {
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
        <a href="/login?next=/reviews" className="font-semibold text-moss underline">
          Sign in
        </a>{" "}
        to leave a review. If you&apos;ve stayed with us before, your review gets a
        &ldquo;verified stay&rdquo; badge automatically.
      </p>
    );
  }

  if (status === "sent") {
    return (
      <p className="rounded-lg bg-moss/10 px-4 py-6 text-center text-moss-dark">
        Thank you! Your review has been submitted and will appear once it&apos;s approved.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setStatus("sending");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, rating }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to submit review.");
      }
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review.");
      setStatus("error");
    }
  }

  const inputCls =
    "w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-moss focus:outline-none";

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <div>
        <p className="text-sm text-stone-700">Your rating</p>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className={`text-2xl ${n <= rating ? "text-amber-500" : "text-stone-300"}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <label className="block text-sm text-stone-700">
        Display name
        <input name="authorName" required minLength={2} className={inputCls + " mt-1"} />
      </label>
      <label className="block text-sm text-stone-700">
        Your review
        <textarea name="body" required minLength={10} rows={4} className={inputCls + " mt-1"} />
      </label>
      {status === "error" && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-full bg-moss px-6 py-2.5 font-semibold text-white hover:bg-moss-dark disabled:bg-stone-300"
      >
        {status === "sending" ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
