"use client";

// Two-month date-range picker. Unavailable nights are greyed out; selecting a
// range that would span one resets the selection to a new check-in.

import { useMemo, useState } from "react";
import { addDays, isWeekendNight, parseISODate, stayNights, toISODate } from "@/lib/pricing";

interface Props {
  unavailable: string[]; // night dates that cannot be booked
  holidays: Map<string, string>; // ISO date -> holiday name
  checkIn: string | null;
  checkOut: string | null;
  onChange: (checkIn: string | null, checkOut: string | null) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function StayCalendar({ unavailable, holidays, checkIn, checkOut, onChange }: Props) {
  const today = toISODate(new Date());
  const unavailableSet = useMemo(() => new Set(unavailable), [unavailable]);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function selectDay(date: string) {
    if (!checkIn || (checkIn && checkOut)) {
      // start a new selection
      onChange(date, null);
      return;
    }
    if (date <= checkIn) {
      onChange(date, null);
      return;
    }
    // completing a range: every night [checkIn, date) must be open
    const blocked = stayNights(checkIn, date).some((n) => unavailableSet.has(n));
    if (blocked) {
      onChange(date, null);
      return;
    }
    onChange(checkIn, date);
  }

  function renderMonth(year: number, month: number) {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<string | null> = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month, d)));

    return (
      <div key={`${year}-${month}`} className="w-full">
        <p className="mb-2 text-center font-serif font-semibold text-stone-800">
          {monthLabel(year, month)}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-500">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 font-medium">{w}</div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} />;
            const isPast = date < today;
            // A date is selectable as check-out even if its own night is
            // unavailable (the guest leaves that morning).
            const nightUnavailable = unavailableSet.has(date);
            const selectingCheckout = Boolean(checkIn && !checkOut);
            const disabled = isPast || (nightUnavailable && !selectingCheckout);
            const inRange =
              checkIn && checkOut ? date >= checkIn && date < checkOut : false;
            const isStart = date === checkIn;
            const isEnd = checkOut ? date === checkOut : false;
            const selected = isStart || isEnd;

            // Weekend/holiday nights are priced higher; flag them so the price
            // shown later never surprises the guest. Mirrors the pricing engine.
            const { weekend, holiday } = isWeekendNight(date, holidays);
            const rateLabel = holiday ? `${holiday} · holiday rate` : weekend ? "Weekend rate" : null;
            const showRate = Boolean(rateLabel) && !disabled;

            return (
              <button
                key={date}
                type="button"
                disabled={disabled}
                onClick={() => selectDay(date)}
                title={rateLabel ?? undefined}
                aria-label={rateLabel ? `${date}, ${rateLabel}` : date}
                className={[
                  "relative rounded py-1.5 text-sm",
                  disabled
                    ? "cursor-not-allowed text-stone-300 line-through"
                    : "hover:bg-moss/20",
                  selected ? "bg-moss font-bold text-white hover:bg-moss" : "",
                  inRange && !isStart ? "bg-moss/15 text-moss-dark" : "",
                ].join(" ")}
              >
                {Number(date.slice(8))}
                {showRate && (
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                      selected ? "bg-white/80" : "bg-amber-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const next = new Date(viewYear, viewMonth + 1, 1);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded px-3 py-1 text-stone-600 hover:bg-stone-100"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="text-sm text-stone-500">
          {checkIn && checkOut
            ? `${checkIn} → ${checkOut}`
            : checkIn
              ? `Check-in ${checkIn} — now pick check-out`
              : "Select your check-in date"}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded px-3 py-1 text-stone-600 hover:bg-stone-100"
          aria-label="Next month"
        >
          →
        </button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {renderMonth(viewYear, viewMonth)}
        {renderMonth(next.getFullYear(), next.getMonth())}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
        Weekend &amp; holiday nights are priced a little higher — hover a date to see which.
      </p>
      {checkIn && (
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="mt-2 text-xs text-stone-500 underline hover:text-moss"
        >
          Clear dates
        </button>
      )}
    </div>
  );
}

export { addDays, parseISODate };
