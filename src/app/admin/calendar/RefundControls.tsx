"use client";

// The refund controls for one booking row. A client component for one reason:
// every one of these buttons moves real money through Stripe and cannot be
// undone, so each asks first — and the question has to name the amount that is
// actually about to move, including whatever is typed in the override box.
// It sizes that amount with resolveRefund(), the same function refundBooking()
// uses on the server, so the confirmation and the refund cannot disagree.

import { useState, type MouseEvent } from "react";
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

  return (
    <div className="flex flex-col gap-1">
      <form action={refundBooking} className="flex flex-col gap-1">
        <input type="hidden" name="id" value={id} />

        <Button
          type="submit"
          variant="danger"
          size="sm"
          disabled={problem !== null}
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
        <form action={refundBooking}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="refundFull" value="1" />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            onClick={askFirst(
              `Refund ${guestName} the full ${formatUSD(totalCents / 100)}, ` +
                `overriding the ${tier.percent}% the policy allows?${stakes}`
            )}
          >
            Refund in full
          </Button>
        </form>
      )}
    </div>
  );
}
