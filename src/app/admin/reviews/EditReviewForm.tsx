"use client";

import { useState, useTransition } from "react";
import Button, { buttonClasses } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { updateReview } from "../actions";

export default function EditReviewForm({
  review,
}: {
  review: { id: string; author_name: string; rating: number; stayed_on: string | null; body: string };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <details className="group" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={buttonClasses("secondary", "sm", "inline-block cursor-pointer list-none")}>
        Edit
      </summary>
      <Card variant="flat" className="mt-3 p-3">
        <form
          className="space-y-3"
          action={(formData) => {
            startTransition(async () => {
              await updateReview(formData);
              setOpen(false);
            });
          }}
        >
          <input type="hidden" name="id" value={review.id} />
          <div className="flex flex-wrap gap-3">
            <Field label="Guest name" htmlFor="edit-authorName">
              <Input id="edit-authorName" name="authorName" required defaultValue={review.author_name} />
            </Field>
            <Field label="Rating (1–5)" htmlFor="edit-rating">
              <Input
                id="edit-rating"
                type="number"
                name="rating"
                min={1}
                max={5}
                defaultValue={review.rating}
                required
                className="w-20"
              />
            </Field>
            <Field label="Stay date (optional)" htmlFor="edit-stayedOn">
              <Input id="edit-stayedOn" type="date" name="stayedOn" defaultValue={review.stayed_on ?? ""} />
            </Field>
          </div>
          <Field label="Review text" htmlFor="edit-body">
            <Textarea id="edit-body" name="body" required rows={3} defaultValue={review.body} className="w-full" />
          </Field>
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            Save changes
          </Button>
        </form>
      </Card>
    </details>
  );
}
