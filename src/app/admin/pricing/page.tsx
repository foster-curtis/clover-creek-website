import { getPricing } from "@/lib/data";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import { addHoliday, deleteHoliday, savePricing } from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 block w-32 rounded border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-moss focus:outline-none";

const FIELDS: Array<{ name: string; label: string; key: keyof Awaited<ReturnType<typeof getPricing>> }> = [
  { name: "weekdayBase", label: "Weeknight base (2 guests)", key: "weekdayBase" },
  { name: "weekendBase", label: "Weekend/holiday base (2 guests)", key: "weekendBase" },
  { name: "extraGuestWeekday", label: "Extra guest — weeknight", key: "extraGuestWeekday" },
  { name: "extraGuestWeekend", label: "Extra guest — weekend/holiday", key: "extraGuestWeekend" },
  { name: "petFeePerDay", label: "Pet fee per dog per day", key: "petFeePerDay" },
  { name: "maxGuests", label: "Max guests", key: "maxGuests" },
  { name: "maxPets", label: "Max dogs", key: "maxPets" },
  { name: "petWeightLimitLbs", label: "Dog weight limit (lbs)", key: "petWeightLimitLbs" },
  { name: "minStayNights", label: "Minimum stay (nights)", key: "minStayNights" },
];

export default async function AdminPricingPage() {
  const pricing = await getPricing();
  let holidays: Array<{ day: string; label: string }> = [];
  if (hasServiceRole()) {
    const { data } = await supabaseAdmin().from("holidays").select("day, label").order("day");
    holidays = data ?? [];
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800">Pricing &amp; Holidays</h1>
      <p className="mt-1 text-sm text-stone-500">
        All prices include the cleaning fee and taxes. Changes apply to new bookings immediately.
      </p>

      <form action={savePricing} className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.name} className="text-sm text-stone-700">
              {f.label}
              <input
                type="number"
                name={f.name}
                step="1"
                min="0"
                required
                defaultValue={pricing[f.key] as number}
                className={inputCls}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 text-right">
          <button
            type="submit"
            className="rounded-full bg-moss px-5 py-2 text-sm font-semibold text-white hover:bg-moss-dark"
          >
            Save pricing
          </button>
        </div>
      </form>

      <section className="mt-8 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-bold text-stone-800">Holidays with weekend pricing</h2>
        <p className="mt-1 text-xs text-stone-400">
          US federal holidays are always included automatically. Add local dates here (Pioneer
          Day, Easter weekend, county fair…). The night before a holiday is also priced as a
          weekend, like Friday is for Saturday.
        </p>
        <form action={addHoliday} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-stone-500">
            Date
            <input type="date" name="day" required className={inputCls} />
          </label>
          <label className="text-xs text-stone-500">
            Name
            <input type="text" name="label" required placeholder="Pioneer Day" className={inputCls + " w-48"} />
          </label>
          <button
            type="submit"
            className="rounded-full bg-moss px-4 py-1.5 text-sm font-semibold text-white hover:bg-moss-dark"
          >
            Add
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {holidays.map((h) => (
            <li key={h.day} className="flex items-center justify-between rounded bg-stone-50 px-3 py-2">
              <span>
                {h.day} · {h.label}
              </span>
              <form action={deleteHoliday}>
                <input type="hidden" name="day" value={h.day} />
                <button type="submit" className="text-xs text-red-600 underline">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
