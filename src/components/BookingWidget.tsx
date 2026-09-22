"use client";

import { useMemo, useState } from "react";
import StayCalendar from "./StayCalendar";
import {
  formatUSD,
  quoteStay,
  toISODate,
  validateStay,
  type PricingConfig,
  type Quote,
} from "@/lib/pricing";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

interface Props {
  pricing: PricingConfig;
  unavailable: string[]; // unavailable night dates
  holidays: Array<[string, string]>; // serialized holiday map
  prefill?: { name?: string; email?: string };
}

export default function BookingWidget({ pricing, unavailable, holidays, prefill }: Props) {
  const holidayMap = useMemo(() => new Map(holidays), [holidays]);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [pets, setPets] = useState(0);
  const [name, setName] = useState(prefill?.name ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [petPolicyAccepted, setPetPolicyAccepted] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot — real users never fill this
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = toISODate(new Date());

  let quote: Quote | null = null;
  let quoteError: string | null = null;
  if (checkIn && checkOut) {
    const req = { checkIn, checkOut, guests, pets };
    quoteError = validateStay(req, pricing, today);
    if (!quoteError) {
      try {
        quote = quoteStay(req, holidayMap, pricing);
      } catch (e) {
        quoteError = e instanceof Error ? e.message : "Unable to price this stay.";
      }
    }
  }

  const canSubmit =
    Boolean(quote) &&
    name.trim().length > 1 &&
    /.+@.+\..+/.test(email) &&
    rulesAccepted &&
    (pets === 0 || petPolicyAccepted) &&
    !submitting;

  async function reserve() {
    if (!checkIn || !checkOut || !quote) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn,
          checkOut,
          guests,
          pets,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          rulesAccepted,
          petPolicyAccepted,
          website, // honeypot
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong — please try again.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <Card variant="flat" className="!p-4 sm:!p-6">
        <StayCalendar
          unavailable={unavailable}
          holidays={holidayMap}
          checkIn={checkIn}
          checkOut={checkOut}
          onChange={(ci, co) => {
            setCheckIn(ci);
            setCheckOut(co);
          }}
        />
      </Card>

      <div className="space-y-4">
        <Card variant="flat" className="!p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Guests (max ${pricing.maxGuests})`} htmlFor="booking-guests">
              <Select
                id="booking-guests"
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
              >
                {Array.from({ length: pricing.maxGuests }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </Field>
            <Field label={`Dogs (max ${pricing.maxPets})`} htmlFor="booking-pets">
              <Select
                id="booking-pets"
                value={pets}
                onChange={(e) => setPets(Number(e.target.value))}
              >
                {Array.from({ length: pricing.maxPets + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Dogs only (no cats), {pricing.petWeightLimitLbs} lb limit each,{" "}
            {formatUSD(pricing.petFeePerDay)}/dog/day.
          </p>

          {quoteError && checkIn && checkOut && (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{quoteError}</p>
          )}

          {quote && (
            <div className="mt-4 border-t border-stone-200 pt-3 text-sm">
              <ul className="space-y-1">
                {quote.nights.map((n) => (
                  <li key={n.date} className="flex justify-between text-stone-600">
                    <span>
                      {n.date}
                      {n.holiday ? ` · ${n.holiday}` : n.weekendRate ? " · weekend" : ""}
                    </span>
                    <span>{formatUSD(n.subtotal)}</span>
                  </li>
                ))}
                {quote.petFee > 0 && (
                  <li className="flex justify-between text-stone-600">
                    <span>
                      Pet fee ({quote.pets} × {quote.nightCount} night{quote.nightCount > 1 ? "s" : ""})
                    </span>
                    <span>{formatUSD(quote.petFee)}</span>
                  </li>
                )}
              </ul>
              <p className="mt-2 flex justify-between border-t border-stone-200 pt-2 font-semibold text-stone-800">
                <span>Total</span>
                <span>{formatUSD(quote.total)}</span>
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Cleaning fee and taxes included — no hidden fees.
              </p>
            </div>
          )}
        </Card>

        <Card variant="flat" className="!p-5">
          <div className="space-y-3">
            <Field label="Full name" htmlFor="booking-name">
              <Input id="booking-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Email" htmlFor="booking-email">
              <Input id="booking-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Phone (optional)" htmlFor="booking-phone">
              <Input id="booking-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </Field>
            {/* Honeypot field — hidden from real users */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
              name="website"
            />
            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(e) => setRulesAccepted(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to the{" "}
                <a href="/house-rules" target="_blank" className="text-moss underline">
                  house rules
                </a>{" "}
                (check-in {"3 PM"}, check-out {"11 AM"}, no smoking, no parties).
              </span>
            </label>
            {pets > 0 && (
              <label className="flex items-start gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={petPolicyAccepted}
                  onChange={(e) => setPetPolicyAccepted(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I agree to the{" "}
                  <a href="/house-rules#pets" target="_blank" className="text-moss underline">
                    pet policy
                  </a>{" "}
                  — dogs only under {pricing.petWeightLimitLbs} lbs, crated when unattended and at
                  night, never on beds, and I&apos;m responsible for cleanup ($100+ fee for messes).
                </span>
              </label>
            )}
          </div>

          {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!canSubmit}
            loading={submitting}
            onClick={reserve}
            className="mt-4 w-full"
          >
            {submitting
              ? "Redirecting to secure payment…"
              : quote
                ? `Reserve · ${formatUSD(quote.total)}`
                : "Select dates to see your price"}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-muted">
            Secure payment by Stripe. You won&apos;t be charged until you complete payment.
          </p>
        </Card>
      </div>
    </div>
  );
}
