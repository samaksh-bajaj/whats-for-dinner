import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  dayOfMonth,
  karmaReading,
  monthGrid,
  monthLabel,
  monthOf,
  relativeDay,
  shiftMonth,
  WEEKDAY_INITIALS,
} from "@/lib/calendar";
import { cookedInMonth, dayDetail, dishStats, karmaBoard } from "@/lib/history";
import { requireHousehold } from "@/lib/household";
import { householdToday } from "@/lib/rounds";
import { cn } from "@/lib/cn";

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const { household } = await requireHousehold();
  const today = householdToday(household);
  const params = await props.searchParams;

  const month = typeof params.m === "string" && /^\d{4}-\d{2}$/.test(params.m)
    ? params.m
    : monthOf(today);
  const selected = typeof params.d === "string" ? params.d : null;

  const [cooked, karma, dishes, detail] = await Promise.all([
    cookedInMonth(month),
    karmaBoard(today),
    dishStats(),
    selected ? dayDetail(selected) : Promise.resolve(null),
  ]);

  const grid = monthGrid(month);
  const keepDay = (date: string) =>
    `/calendar?m=${month}&d=${date}` as const;

  return (
    <>
      <h1 className="font-display text-[34px] font-semibold text-ink">Calendar</h1>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/calendar?m=${shiftMonth(month, -1)}`}
            aria-label="Previous month"
            className="p-2 text-ink-faint hover:text-ink"
          >
            <ChevronLeft size={20} aria-hidden />
          </Link>
          <h2 className="font-display text-[20px] text-ink">{monthLabel(month)}</h2>
          <Link
            href={`/calendar?m=${shiftMonth(month, 1)}`}
            aria-label="Next month"
            className="p-2 text-ink-faint hover:text-ink"
          >
            <ChevronRight size={20} aria-hidden />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {WEEKDAY_INITIALS.map((initial, position) => (
            <div
              key={position}
              aria-hidden
              className="pb-1 text-center text-[11px] text-ink-faint"
            >
              {initial}
            </div>
          ))}

          {grid.flat().map((date, position) => {
            if (!date) return <div key={`blank-${position}`} />;

            const night = cooked.get(date);
            const isToday = date === today;
            const isSelected = date === selected;

            const cell = (
              <>
                <span className="tnum text-[13px]">{dayOfMonth(date)}</span>
                {/* A dot, not a name: at seven columns on a phone there is no
                    room for "Bhindi and roti". Tapping the day says the rest. */}
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 rounded-full",
                    night ? "bg-paprika" : "bg-transparent",
                  )}
                />
              </>
            );

            const classes = cn(
              "flex aspect-square flex-col items-center justify-center rounded-lg border transition-colors",
              isSelected
                ? "border-ink bg-surface text-ink"
                : night
                  ? "border-line bg-surface text-ink hover:border-ink-faint"
                  : "border-transparent text-ink-faint",
              isToday && !isSelected && "border-line-soft bg-sunk/40",
            );

            return night ? (
              <Link
                key={date}
                href={keepDay(date)}
                aria-label={`${date}: ${night.dishName}`}
                className={classes}
              >
                {cell}
              </Link>
            ) : (
              <div key={date} className={classes} aria-label={date}>
                {cell}
              </div>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="mt-6 rounded-card border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-ink-faint">
                {new Date(`${selected}T00:00:00Z`).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                })}
              </p>
              <p className="mt-1 font-display text-[26px] leading-tight text-ink">
                {detail?.dishName ?? "Nothing cooked"}
              </p>
            </div>
            <Link
              href={`/calendar?m=${month}`}
              aria-label="Close"
              className="shrink-0 p-1 text-ink-faint hover:text-ink"
            >
              <X size={18} aria-hidden />
            </Link>
          </div>

          {detail && (
            <>
              {detail.note && (
                <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                  {detail.note}
                </p>
              )}
              <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
                {detail.voters.length > 0
                  ? `Voted: ${detail.voters.join(", ")}`
                  : "Nobody voted."}
              </p>
              {detail.absentees.length > 0 && (
                <p className="mt-1 text-[13px] text-ink-faint">
                  Sat it out: {detail.absentees.join(", ")}
                </p>
              )}
            </>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          Karma
        </h2>
        <ul className="mt-3 border-t border-line">
          {karma.map((member) => (
            <li
              key={member.memberId}
              className="flex items-center gap-3 border-b border-line-soft py-3"
            >
              <span className="flex-1 font-display text-[18px] text-ink">
                {member.name}
              </span>
              <span className="text-[14px] text-ink-soft">
                {karmaReading(member.value)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
          Lose a night and the app owes you one; win and it evens up. It fades
          over a week or so, so only recent evenings count.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          Dishes
        </h2>
        <ul className="mt-3 border-t border-line">
          {dishes.map((dish) => (
            <li key={dish.id} className="border-b border-line-soft py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate font-display text-[18px] text-ink">
                  {dish.name}
                </span>
                <span className="tnum shrink-0 text-[13px] text-ink-faint">
                  cooked {dish.timesCooked}
                  {dish.timesCooked === 1 ? " time" : " times"}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-ink-faint">
                {dish.baseline === null
                  ? "unrated"
                  : `household rating ${dish.baseline > 0 ? "+" : ""}${dish.baseline.toFixed(1)}`}
                {" · "}
                {relativeDay(dish.lastCookedOn, today)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
