// The pricing engine. One pure module used by the booking widget (live quote),
// the checkout API (authoritative server-side price), and confirmation emails —
// so they can never disagree.

export interface PricingConfig {
  weekdayBase: number; // per night, 2 guests, Sun–Thu nights
  weekendBase: number; // per night, 2 guests, Fri/Sat + holiday nights
  extraGuestWeekday: number; // per extra guest per weekday night
  extraGuestWeekend: number; // per extra guest per weekend/holiday night
  petFeePerDay: number; // per pet per night
  maxGuests: number;
  maxPets: number;
  petWeightLimitLbs: number;
  minStayNights: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  weekdayBase: 75,
  weekendBase: 105,
  extraGuestWeekday: 20,
  extraGuestWeekend: 25,
  petFeePerDay: 20,
  maxGuests: 6,
  maxPets: 2,
  petWeightLimitLbs: 50,
  minStayNights: 1,
};

export interface StayRequest {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD (exclusive — the morning the guest leaves)
  guests: number;
  pets: number;
}

export interface NightQuote {
  date: string;
  weekendRate: boolean;
  holiday: string | null;
  base: number;
  extraGuestFee: number;
  subtotal: number;
}

export interface Quote {
  nights: NightQuote[];
  nightCount: number;
  guests: number;
  pets: number;
  lodgingSubtotal: number;
  petFee: number;
  total: number;
  totalCents: number;
  tax: TaxBreakdown;
}

// --- lodging tax -----------------------------------------------------------
// Every published rate is tax-inclusive ("the price you see is the price you
// pay"), so tax is backed *out* of the total rather than added to it. This
// changes neither what the guest pays nor what we receive — it exists so the
// owner has a per-booking tax figure for filing.
//
// Applied to the whole stay total, pet fee included: Utah levies these on the
// full charge for the accommodation, not just the room line.
//
// Sales tax and TRT go on separate returns, so the breakdown keeps them apart
// and reports a TRT subtotal alongside the combined figure.

/** Decimal rates on lodging. No municipal TRT applies in Rush Valley. */
export const TAX_RATES = {
  salesTax: 0.066, // Utah statewide sales tax on accommodations
  stateTrt: 0.0107, // Utah state transient room tax
  countyTrt: 0.045, // Tooele County transient room tax
} as const;

/**
 * Combined rate: 12.17%. Stated as a literal so the headline rate is greppable;
 * a test asserts it stays equal to the sum of the three components above.
 */
export const TAX_RATE = 0.1217;

export interface TaxBreakdown {
  /** What the guest paid, tax included. Unchanged by this split. */
  grossCents: number;
  /** The gross less tax — the taxable receipt to report. */
  taxableBaseCents: number;
  salesTaxCents: number;
  stateTrtCents: number;
  countyTrtCents: number;
  /** State + county TRT. Filed separately from sales tax. */
  trtTotalCents: number;
  totalTaxCents: number;
  /** The combined rate used, so historical records stay readable if it changes. */
  rate: number;
}

/**
 * Backs the lodging tax out of a tax-inclusive total.
 *
 * Works from any gross amount, so it can be applied to bookings taken before
 * the tax was recorded on the quote — pass `total_cents` straight from the row.
 *
 * Rounding is arranged so the parts always reconcile exactly:
 * `taxableBase + totalTax === gross`, and the three components sum to
 * `totalTax` with no cent lost to drift.
 */
export function computeLodgingTax(grossCents: number): TaxBreakdown {
  const gross = Math.max(0, Math.round(grossCents));
  const taxableBaseCents = Math.round(gross / (1 + TAX_RATE));
  const totalTaxCents = gross - taxableBaseCents;
  // Two shares are rounded and the county takes the remainder, so the three
  // always sum to the total rather than drifting a cent apart.
  const salesTaxCents = Math.round(taxableBaseCents * TAX_RATES.salesTax);
  const stateTrtCents = Math.round(taxableBaseCents * TAX_RATES.stateTrt);
  const countyTrtCents = totalTaxCents - salesTaxCents - stateTrtCents;

  return {
    grossCents: gross,
    taxableBaseCents,
    salesTaxCents,
    stateTrtCents,
    countyTrtCents,
    trtTotalCents: stateTrtCents + countyTrtCents,
    totalTaxCents,
    rate: TAX_RATE,
  };
}

// --- date helpers (local-time safe: dates are plain YYYY-MM-DD strings) ---

export function parseISODate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid date: ${s}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function addDays(isoDate: string, days: number): string {
  const d = parseISODate(isoDate);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * Parse a Postgres daterange literal ("[2026-08-17,2026-08-20)") into its two
 * endpoints — the shape `bookings.stay` and `blocked_dates.span` come back in.
 * Check-out is exclusive, matching the half-open range stored in the database.
 */
export function parseStay(stay: string): { checkIn: string; checkOut: string } {
  const m = /^[\[(]([\d-]+),([\d-]+)[)\]]$/.exec(stay);
  return { checkIn: m?.[1] ?? "", checkOut: m?.[2] ?? "" };
}

/** Every night of a stay: [checkIn, checkOut) */
export function stayNights(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) nights.push(d);
  return nights;
}

// --- validation ---

/** Returns an error message, or null if the stay is bookable. */
export function validateStay(
  req: StayRequest,
  config: PricingConfig = DEFAULT_PRICING,
  today?: string
): string | null {
  try {
    parseISODate(req.checkIn);
    parseISODate(req.checkOut);
  } catch {
    return "Please choose valid dates.";
  }
  if (req.checkOut <= req.checkIn) return "Check-out must be after check-in.";
  if (today) {
    if (req.checkIn < today) return "Check-in can't be in the past.";
    if (req.checkIn === today) return "Check-in must be at least one day in advance.";
    const t = parseISODate(today);
    // Bookable through the end of the month one year from now.
    const maxDate = toISODate(new Date(t.getFullYear() + 1, t.getMonth() + 1, 0));
    if (req.checkOut > maxDate) return "Bookings can only be made up to one year in advance.";
  }
  const nights = stayNights(req.checkIn, req.checkOut).length;
  if (nights < config.minStayNights)
    return `Minimum stay is ${config.minStayNights} night${config.minStayNights > 1 ? "s" : ""}.`;
  if (nights > 30) return "For stays longer than 30 nights, please contact us.";
  if (!Number.isInteger(req.guests) || req.guests < 1) return "At least one guest is required.";
  if (req.guests > config.maxGuests) return `Maximum occupancy is ${config.maxGuests} guests.`;
  if (!Number.isInteger(req.pets) || req.pets < 0) return "Invalid pet count.";
  if (req.pets > config.maxPets)
    return `A maximum of ${config.maxPets} pets is allowed (dogs only, ${config.petWeightLimitLbs} lb limit each).`;
  return null;
}

// --- quoting ---

/**
 * A night gets the weekend rate if it starts on Friday or Saturday, or if the
 * night itself or the following morning is a holiday (so holiday eves are
 * priced like the holiday, matching how weekend nights work).
 */
export function isWeekendNight(date: string, holidays: Map<string, string>): {
  weekend: boolean;
  holiday: string | null;
} {
  const day = parseISODate(date).getDay();
  const holiday = holidays.get(date) ?? holidays.get(addDays(date, 1)) ?? null;
  return { weekend: day === 5 || day === 6 || holiday !== null, holiday };
}

export function quoteStay(
  req: StayRequest,
  holidays: Map<string, string>,
  config: PricingConfig = DEFAULT_PRICING
): Quote {
  const error = validateStay(req, config);
  if (error) throw new Error(error);

  const extraGuests = Math.max(0, req.guests - 2);
  const nights: NightQuote[] = stayNights(req.checkIn, req.checkOut).map((date) => {
    const { weekend, holiday } = isWeekendNight(date, holidays);
    const base = weekend ? config.weekendBase : config.weekdayBase;
    const extraGuestFee =
      extraGuests * (weekend ? config.extraGuestWeekend : config.extraGuestWeekday);
    return { date, weekendRate: weekend, holiday, base, extraGuestFee, subtotal: base + extraGuestFee };
  });

  const lodgingSubtotal = nights.reduce((sum, n) => sum + n.subtotal, 0);
  const petFee = req.pets * config.petFeePerDay * nights.length;
  const total = lodgingSubtotal + petFee;
  const totalCents = Math.round(total * 100);

  return {
    nights,
    nightCount: nights.length,
    guests: req.guests,
    pets: req.pets,
    lodgingSubtotal,
    petFee,
    total,
    totalCents,
    tax: computeLodgingTax(totalCents),
  };
}

export function formatUSD(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
}
