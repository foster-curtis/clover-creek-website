// US federal holidays, computed per year. Additional local holidays (e.g.
// Pioneer Day) live in the `holidays` table and are merged in by the caller.

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** nth occurrence (1-based) of a weekday (0=Sun..6=Sat) in a month (1-based). */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return iso(year, month, 1 + offset + (n - 1) * 7);
}

/** last occurrence of a weekday in a month (1-based). */
function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(year, month, 0); // last day of month
  const offset = (last.getDay() - weekday + 7) % 7;
  return iso(year, month, last.getDate() - offset);
}

/** Map of ISO date -> holiday name for one year. */
export function federalHolidays(year: number): Map<string, string> {
  return new Map([
    [iso(year, 1, 1), "New Year's Day"],
    [nthWeekday(year, 1, 1, 3), "Martin Luther King Jr. Day"],
    [nthWeekday(year, 2, 1, 3), "Presidents' Day"],
    [lastWeekday(year, 5, 1), "Memorial Day"],
    [iso(year, 6, 19), "Juneteenth"],
    [iso(year, 7, 4), "Independence Day"],
    [nthWeekday(year, 9, 1, 1), "Labor Day"],
    [iso(year, 11, 11), "Veterans Day"],
    [nthWeekday(year, 11, 4, 4), "Thanksgiving"],
    [iso(year, 12, 25), "Christmas Day"],
  ]);
}

/** Federal holidays for a span of years, plus any extra dates provided. */
export function holidayMap(
  fromYear: number,
  toYear: number,
  extras: Array<{ day: string; label: string }> = []
): Map<string, string> {
  const map = new Map<string, string>();
  for (let y = fromYear; y <= toYear; y++) {
    for (const [d, label] of federalHolidays(y)) map.set(d, label);
  }
  for (const { day, label } of extras) map.set(day, label);
  return map;
}
