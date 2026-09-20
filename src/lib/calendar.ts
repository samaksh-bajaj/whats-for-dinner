import { daysBetween } from "@/lib/scoring/dates";

/**
 * Month grids, built in UTC from plain "YYYY-MM-DD" strings. Everything the
 * calendar shows is a calendar day in the household's timezone, so local time
 * must never get a vote — a Date built from local time slides a cell into the
 * wrong week depending on where the server is standing.
 */

export type Month = string; // "YYYY-MM"

export function monthOf(date: string): Month {
  return date.slice(0, 7);
}

export function shiftMonth(month: Month, delta: number): Month {
  const [year, index] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: Month): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthBounds(month: Month) {
  const [year, index] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, "0")}` };
}

/** Monday-first weeks, padded with nulls so every row has seven cells. */
export function monthGrid(month: Month): (string | null)[][] {
  const [year, index] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, index - 1, 1)).getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return Array.from({ length: cells.length / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7),
  );
}

export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

/** "Tonight", "yesterday", "3 days ago", "never". */
export function relativeDay(date: string | null, today: string): string {
  if (!date) return "never";
  const days = daysBetween(date, today);
  if (days <= 0) return "tonight";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 31) return `${Math.round(days / 7)} weeks ago`;
  return "over a month ago";
}

/**
 * Karma in words. The number is a means, not the point — nobody should have to
 * read "1.87" to find out whether it's their turn.
 */
export function karmaReading(value: number): string {
  if (value >= 1.5) return "owed a win";
  if (value >= 0.5) return "due something";
  if (value > -0.5) return "square";
  if (value > -1.5) return "got their way lately";
  return "on a good run";
}
