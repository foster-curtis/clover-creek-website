import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content";
import { getPricing } from "@/lib/data";
import { formatUSD } from "@/lib/pricing";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "House Rules & Pet Policy",
  description:
    "House rules, checkout checklist and pet policy for the Clover Creek Guest House in Rush Valley, Utah.",
};

export const revalidate = 3600;

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default async function HouseRulesPage() {
  const [pricing, content] = await Promise.all([getPricing(), getSiteContent()]);
  const stayRules = lines(content.house_rules_stay);
  const checkoutRules = lines(content.house_rules_checkout);
  const petRules = lines(content.house_rules_pets);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-stone-800">House Rules</h1>
      <p className="mt-2 text-stone-600">
        A few simple rules keep the house comfortable for every guest. You&apos;ll be asked to
        accept these when you book.
      </p>

      <section className="mt-8 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-xl font-bold text-stone-800">During your stay</h2>
        <ul className="mt-4 space-y-2 text-stone-600">
          <li>• Check-in is generally <strong>{SITE.checkInTime} or later</strong> unless special arrangements are made.</li>
          <li>• Check-out is by <strong>{SITE.checkOutTime}</strong> unless a later time is pre-approved.</li>
          <li>• Maximum occupancy is {pricing.maxGuests} guests.</li>
          {stayRules.map((rule) => (
            <li key={rule}>• {rule}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-xl font-bold text-stone-800">At checkout</h2>
        <ul className="mt-4 space-y-2 text-stone-600">
          {checkoutRules.map((rule) => (
            <li key={rule}>• {rule}</li>
          ))}
        </ul>
      </section>

      <section id="pets" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-xl font-bold text-stone-800">Pet Policy</h2>
        <p className="mt-2 text-sm text-stone-600">
          Dogs are welcome — {formatUSD(pricing.petFeePerDay)} per dog per day, maximum{" "}
          {pricing.maxPets}, with a {pricing.petWeightLimitLbs} lb limit each. <strong>No cats.</strong>
        </p>
        <ul className="mt-4 space-y-2 text-stone-600">
          {petRules.map((rule) => (
            <li key={rule}>• {rule}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
