import { getPricing } from "@/lib/data";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabase/server";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageTitle, SectionTitle } from "@/components/ui/Heading";
import { addHoliday, deleteHoliday, savePricing } from "../actions";

export const dynamic = "force-dynamic";

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
      <PageTitle>Pricing &amp; Holidays</PageTitle>
      <p className="mt-1 text-sm text-ink-muted">
        All prices include the cleaning fee and taxes. Changes apply to new bookings immediately.
      </p>

      <Card variant="flat" className="mt-6 p-5">
        <form action={savePricing}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <Field key={f.name} label={f.label} htmlFor={f.name}>
                <Input
                  type="number"
                  id={f.name}
                  name={f.name}
                  step="1"
                  min="0"
                  required
                  defaultValue={pricing[f.key] as number}
                  className="w-32"
                />
              </Field>
            ))}
          </div>
          <div className="mt-4 text-right">
            <Button type="submit">Save pricing</Button>
          </div>
        </form>
      </Card>

      <Card variant="flat" className="mt-8 p-5">
        <SectionTitle as="h2" className="text-lg">
          Holidays with weekend pricing
        </SectionTitle>
        <p className="mt-1 text-xs text-ink-subtle">
          US federal holidays are always included automatically. Add local dates here (Pioneer
          Day, Easter weekend, county fair…). The night before a holiday is also priced as a
          weekend, like Friday is for Saturday.
        </p>
        <form action={addHoliday} className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Date" htmlFor="day">
            <Input type="date" id="day" name="day" required className="w-32" />
          </Field>
          <Field label="Name" htmlFor="label">
            <Input type="text" id="label" name="label" required placeholder="Pioneer Day" className="w-48" />
          </Field>
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {holidays.map((h) => (
            <li key={h.day} className="flex items-center justify-between rounded-md bg-surface-sunken px-3 py-2">
              <span>
                {h.day} · {h.label}
              </span>
              <form action={deleteHoliday}>
                <input type="hidden" name="day" value={h.day} />
                <Button type="submit" variant="danger" size="sm">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
