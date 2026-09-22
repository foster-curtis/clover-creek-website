"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { StarIcon } from "@/components/ui/icons";

export default function ReviewForm({ signedIn }: { signedIn: boolean }) {
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <Card variant="flat" className="!p-4 text-sm text-stone-600">
        <a href="/login?next=/reviews" className="font-semibold text-moss underline">
          Sign in
        </a>{" "}
        to leave a review. If you&apos;ve stayed with us before, your review gets a
        &ldquo;verified stay&rdquo; badge automatically.
      </Card>
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

  return (
    <form onSubmit={onSubmit}>
      <Card variant="flat" className="!p-5 space-y-4">
        <div>
          <p className="text-sm text-ink-muted">Your rating</p>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className={n <= rating ? "text-harvest" : "text-line-strong"}
              >
                <StarIcon className="h-6 w-6" />
              </button>
            ))}
          </div>
        </div>
        <Field label="Display name" htmlFor="review-author">
          <Input id="review-author" name="authorName" required minLength={2} />
        </Field>
        <Field label="Your review" htmlFor="review-body">
          <Textarea id="review-body" name="body" required minLength={10} rows={4} />
        </Field>
        {status === "error" && <p className="text-sm text-red-700">{error}</p>}
        <Button type="submit" variant="primary" size="md" loading={status === "sending"}>
          {status === "sending" ? "Submitting…" : "Submit review"}
        </Button>
      </Card>
    </form>
  );
}
