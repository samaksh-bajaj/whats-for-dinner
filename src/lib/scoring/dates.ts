/**
 * Calendar-day arithmetic. Rounds are dated in the household's timezone and
 * stored as plain dates, so everything here works on "YYYY-MM-DD" strings and
 * never touches local time — a round scored at 11pm in Kolkata must not decide
 * it happened tomorrow because the server sits in UTC.
 */

function toUtcDay(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Whole days from `from` to `to`; negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDay(to) - toUtcDay(from)) / 86_400_000);
}

/** Days since a dish was last cooked, or null if it never has been. */
export function daysSince(lastCookedOn: string | null, today: string): number | null {
  return lastCookedOn === null ? null : daysBetween(lastCookedOn, today);
}

/**
 * The calendar day it is *for this household*. A round belongs to the day its
 * kitchen is having, not the day the server is having — the only reason the
 * household stores a timezone at all.
 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
