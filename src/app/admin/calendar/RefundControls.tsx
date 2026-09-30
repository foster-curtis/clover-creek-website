"use client";

// The refund controls for one booking row. A client component for one reason:
// every one of these buttons moves real money through Stripe and cannot be
// undone, so each asks first — and the question has to name the amount that is
// actually about to move, including whatever is typed in the override box.
// It sizes that amount with resolveRefund(), the same function refundBooking()
// uses on the server, so the confirmation and the refund cannot disagree.
//
// It is also where the outcome is read. refundBooking() returns its failures
// rather than throwing them, because production redacts a thrown message to a
// digest — including the one saying the money moved and the booking does not
// know. Both forms share one useActionState, so there is one result and one
// pending flag for the whole row.

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import Button from "@/components/ui/Button";
import { resolveRefund, type RefundInstruction } from "@/lib/cancellation";
import { formatUSD } from "@/lib/pricing";
import { refundBooking } from "../actions";

interface RefundControlsProps {
  id: string;
  guestName: string;
  checkIn: string;
  /** Today at the property, resolved on the server — the browser may be elsewhere. */
  today: string;
  totalCents: number;
}

export default function RefundControls({
  id,
  guestName,
  checkIn,
  today,
  totalCents,
}: RefundControlsProps) {
  const [override, setOverride] = useState("");
  const [result, formAction, isPending] = useActionState(refundBooking, null);

  // isPending only flips on the next render, and useActionState queues every
  // dispatch to run after the last — so two submits in the same frame would both
  // run, and a second refund can be a second transfer of money. This flag closes
  // that gap synchronously; it is released once the action has settled.
  const submitting = useRef(false);
  useEffect(() => {
    if (!isPending) submitting.current = false;
  }, [isPending]);

  // After money-moved the retry is exactly the mistake the message warns about,
  // so the buttons stay off for the life of this component, not just while
  // pending. (The booking still reads confirmed then, so the server's status
  // check would not stop a second refund; this does.)
  const moneyMoved = result?.ok === false && result.severity === "money-moved";
  const locked = isPending || moneyMoved;

  // The forms use onSubmit rather than action={…} on purpose. React resets a
  // form after its action completes, and skips a focused number input while it
  // does: a blocked result could then blank the override box while `override`
  // state — and so the button label and the confirm text — still said $123, and
  // the next submit would send override="" and refund the policy amount instead.
  // Without an action prop React never schedules the reset. The window.confirm
  // in each button's onClick still cancels the submit before it gets here.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current || locked) return;
    submitting.current = true;
    const data = new FormData(e.currentTarget);
    // Dispatch synchronously inside the transition: an await before this would
    // leave it outside one, and isPending would silently stop flipping.
    startTransition(() => formAction(data));
  }

  const { policy: tier, refundCents: policyCents } = resolveRefund(
    { kind: "policy" },
    checkIn,
    today,
    totalCents
  );

  // What the policy button would really send: a typed amount wins over the tier
  // there, exactly as refundBooking() resolves it.
  const instruction: RefundInstruction = override.trim()
    ? { kind: "amount", dollars: override }
    : { kind: "policy" };
  let pendingCents = policyCents;
  let problem: string | null = null;
  try {
    pendingCents = resolveRefund(instruction, checkIn, today, totalCents).refundCents;
  } catch (e) {
    problem = e instanceof Error ? e.message : "Invalid refund override";
  }

  function askFirst(message: string) {
    return (e: MouseEvent<HTMLButtonElement>) => {
      if (!window.confirm(message)) e.preventDefault();
    };
  }

  const stakes = "\n\nThis issues a Stripe refund and cannot be undone.";

  // The row re-renders as cancelled on revalidation and unmounts this anyway;
  // until then, say what happened rather than leave live buttons on a done job.
  if (result?.ok) {
    return (
      <p role="status" className="max-w-[18rem] text-sm text-moss-dark">
        {result.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {result && !result.ok && result.severity === "money-moved" && (
        <div
          role="alert"
          className="max-w-[20rem] rounded-lg border-2 border-clay bg-clay/10 p-3 text-sm whitespace-normal text-ink"
        >
          <p className="font-semibold text-clay">Money moved — do not refund again</p>
          <p className="mt-1">{result.message}</p>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-1">
        <input type="hidden" name="id" value={id} />

        <Button
          type="submit"
          variant="danger"
          size="sm"
          disabled={problem !== null || locked}
          onClick={askFirst(
            `Cancel ${guestName}'s booking and refund ${formatUSD(pendingCents / 100)}?${stakes}`
          )}
        >
          Cancel &amp; refund {formatUSD(pendingCents / 100)}
        </Button>
        <span className="text-[11px] text-ink-subtle">
          {override.trim() ? "override" : `${tier.percent}% · ${tier.tier.label} out`}
        </span>

        <input
          type="number"
          name="override"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          step="0.01"
          min={0}
          max={totalCents / 100}
          placeholder="override $"
          title="Refund a different amount instead of the policy amount"
          aria-label={`Refund ${guestName} a different amount, in dollars`}
          className="w-24 rounded border border-line px-1 py-0.5 text-[11px]"
        />
        {problem && <span className="text-[11px] text-clay">{problem}</span>}
      </form>

      {/* A form of its own, carrying the flag as a hidden input. Putting
          name/value on the submit button instead looks tidier and silently does
          not work: the submitter's value never reached the action, so this
          button refunded the policy amount while saying "in full". A hidden
          input is part of the form's data whatever the submitter does.
          Omitted once the tiers already return everything, where it would be a
          second button doing the identical thing. */}
      {policyCents < totalCents && (
        <form onSubmit={submit}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="refundFull" value="1" />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={locked}
            onClick={askFirst(
              `Refund ${guestName} the full ${formatUSD(totalCents / 100)}, ` +
                `overriding the ${tier.percent}% the policy allows?${stakes}`
            )}
          >
            Refund in full
          </Button>
        </form>
      )}

      {/* Nothing happened, so retrying is reasonable — same style as the
          override validation error above, which says the same kind of thing. */}
      {result && !result.ok && result.severity === "blocked" && (
        <p role="alert" className="max-w-[18rem] text-[11px] text-clay">
          {result.message}
        </p>
      )}
    </div>
  );
}
