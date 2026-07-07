import type { Metadata } from "next";
import { getPricing } from "@/lib/data";
import { formatUSD } from "@/lib/pricing";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "House Rules & Pet Policy",
  description:
    "House rules, checkout checklist and pet policy for the Clover Creek Guest House in Rush Valley, Utah.",
};

export const revalidate = 3600;

export default async function HouseRulesPage() {
  const pricing = await getPricing();

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
          <li>• <strong>No smoking</strong> of any kind.</li>
          <li>• <strong>No parties</strong> or large gatherings.</li>
          <li>• No kids standing on the furniture, especially under the TV.</li>
          <li>• No pets in or on the beds.</li>
          <li>• Maximum occupancy is {pricing.maxGuests} guests.</li>
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-xl font-bold text-stone-800">At checkout</h2>
        <ul className="mt-4 space-y-2 text-stone-600">
          <li>• Leave all used beds <strong>unmade</strong> — please don&apos;t pile used bedding on the floor.</li>
          <li>• Leave used towels in the bathtub.</li>
          <li>• Perishable food left behind should stay in the refrigerator — it&apos;s disposed of Friday morning (garbage day).</li>
          <li>• Turn off lights, heaters, fans and A/C.</li>
          <li>• Lock the door as you leave.</li>
        </ul>
      </section>

      <section id="pets" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-xl font-bold text-stone-800">Pet Policy</h2>
        <p className="mt-2 text-sm text-stone-600">
          Dogs are welcome — {formatUSD(pricing.petFeePerDay)} per dog per day, maximum{" "}
          {pricing.maxPets}, with a {pricing.petWeightLimitLbs} lb limit each. <strong>No cats.</strong>
        </p>
        <ul className="mt-4 space-y-2 text-stone-600">
          <li>• <strong>You are responsible</strong> for the care and safety of your pets — we assume no responsibility.</li>
          <li>• Be aware there is <strong>no fencing</strong> to secure your pet. A crate and lanyard are available for your use.</li>
          <li>• You are responsible for all pet cleanup.</li>
          <li>• Any inside accidents, or messes left in the yard, will result in an additional cleaning fee of <strong>$100 or more</strong>.</li>
          <li>
            • <strong>Skunk warning:</strong> do not leave your pets unattended while outside,
            especially when it&apos;s not full daylight — they could get sprayed.
          </li>
          <li>• Do not leave your pet loose in the house if you leave — any unattended pets must be crated.</li>
          <li>• <strong>No pets in beds.</strong> Crate pets at night.</li>
        </ul>
      </section>
    </div>
  );
}
