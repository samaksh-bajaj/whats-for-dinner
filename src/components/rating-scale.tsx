import { Angry, Frown, Laugh, Meh, Smile } from "lucide-react";
import { cn } from "@/lib/cn";
import { rateDish } from "@/lib/dish-actions";

// Faces, not emoji — lucide icons with words under them, so the scale reads
// the same to someone using a screen reader as it does to everyone else.
export const RATINGS = [
  { value: -2, label: "Never again", Icon: Angry, tone: "text-paprika" },
  { value: -1, label: "Not for me", Icon: Frown, tone: "text-paprika" },
  { value: 0, label: "Fine", Icon: Meh, tone: "text-ink-soft" },
  { value: 1, label: "Like it", Icon: Smile, tone: "text-olive" },
  { value: 2, label: "Love it", Icon: Laugh, tone: "text-olive" },
] as const;

export function ratingFor(value: number | undefined) {
  return RATINGS.find((rating) => rating.value === value);
}

export function RatingScale({
  dishId,
  current,
}: {
  dishId: string;
  current?: number;
}) {
  return (
    <form action={rateDish} className="flex gap-1.5">
      <input type="hidden" name="dish_id" value={dishId} />
      {RATINGS.map(({ value, label, Icon, tone }) => {
        const chosen = current === value;
        return (
          <button
            key={value}
            type="submit"
            name="value"
            value={value}
            aria-label={label}
            aria-pressed={chosen}
            className={cn(
              "flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-1 py-3 transition-colors",
              chosen
                ? "border-ink bg-surface"
                : "border-line bg-surface hover:border-ink-faint",
            )}
          >
            <Icon
              size={24}
              strokeWidth={chosen ? 2.25 : 1.75}
              className={chosen ? tone : "text-ink-faint"}
              aria-hidden
            />
            <span
              className={cn(
                "text-[10px] leading-tight",
                chosen ? "text-ink" : "text-ink-faint",
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </form>
  );
}
