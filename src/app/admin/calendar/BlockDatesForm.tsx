"use client";

// The block-dates form. A client component so the outcome can be read: the
// database refuses a block over a live booking, and blockDates() returns which
// booking is in the way rather than throwing it past production's redaction.
//
// onSubmit rather than action={…}, as in RefundControls: React resets a form
// after its action completes, which would blank the dates the moment they were
// refused — exactly when the owner wants to adjust them and try again. The
// fields are cleared by hand once a block has gone in instead.

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { blockDates } from "../actions";

export default function BlockDatesForm() {
  const [result, formAction, isPending] = useActionState(blockDates, null);
  const form = useRef<HTMLFormElement>(null);

  // isPending only flips on the next render, so a double-click could queue the
  // same block twice. Nothing breaks, but the list would show it twice.
  const submitting = useRef(false);
  useEffect(() => {
    if (!isPending) submitting.current = false;
  }, [isPending]);

  useEffect(() => {
    if (result?.ok) form.current?.reset();
  }, [result]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const data = new FormData(e.currentTarget);
    // Dispatched synchronously inside the transition, or isPending never flips.
    startTransition(() => formAction(data));
  }

  return (
    <>
      <form ref={form} onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="First night" htmlFor="block-from" className="w-40">
          <Input id="block-from" type="date" name="from" required />
        </Field>
        <Field label="Reopen on (checkout day)" htmlFor="block-to" className="w-40">
          <Input id="block-to" type="date" name="to" required />
        </Field>
        <Field label="Reason (optional)" htmlFor="block-reason" className="w-48">
          <Input id="block-reason" type="text" name="reason" placeholder="Family visit" />
        </Field>
        <Button type="submit" size="sm" disabled={isPending}>
          Block
        </Button>
      </form>
      {result && !result.ok && (
        <p role="alert" className="mt-2 text-sm text-clay">
          {result.message}
        </p>
      )}
      {result?.ok && result.message && (
        <p role="status" className="mt-2 text-sm text-moss-dark">
          {result.message}
        </p>
      )}
    </>
  );
}
