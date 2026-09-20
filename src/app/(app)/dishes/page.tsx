import Link from "next/link";
import { ChevronRight, CircleDashed } from "lucide-react";
import { ratingFor } from "@/components/rating-scale";
import { requireHousehold } from "@/lib/household";
import { listActiveDishes, myRatings } from "@/lib/dishes";
import { AddDishForm } from "./add-dish-form";

export default async function DishesPage() {
  const { user } = await requireHousehold();
  const [dishes, ratings] = await Promise.all([
    listActiveDishes(),
    myRatings(user.id),
  ]);

  const unratedCount = dishes.filter((dish) => !ratings.has(dish.id)).length;

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-[34px] font-semibold text-ink">
          Dishes
        </h1>
        <span className="tnum text-[13px] text-ink-faint">
          {dishes.length || "none"}
        </span>
      </div>

      {unratedCount > 0 && (
        <Link
          href="/rate"
          className="mt-5 flex items-center justify-between rounded-card border border-turmeric/40 bg-turmeric/10 px-4 py-3"
        >
          <span className="text-[15px] text-ink">
            {unratedCount} still to rate
          </span>
          <ChevronRight size={18} className="text-ink-soft" aria-hidden />
        </Link>
      )}

      {dishes.length === 0 ? (
        <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
          Nothing on the list yet. Six or so is enough to start &mdash; the
          ordinary weeknight things, not just the showpieces.
        </p>
      ) : (
        <ul className="mt-6 border-t border-line">
          {dishes.map((dish) => {
            const rating = ratingFor(ratings.get(dish.id));
            return (
              <li key={dish.id}>
                <Link
                  href={`/dishes/${dish.id}`}
                  className="flex items-center gap-3 border-b border-line-soft py-3.5"
                >
                  {rating ? (
                    <rating.Icon
                      size={20}
                      className={`shrink-0 ${rating.tone}`}
                      aria-label={rating.label}
                    />
                  ) : (
                    <CircleDashed
                      size={20}
                      className="shrink-0 text-ink-faint"
                      aria-label="Not rated"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[19px] text-ink">
                      {dish.name}
                    </span>
                    {dish.note && (
                      <span className="block truncate text-[13px] text-ink-faint">
                        {dish.note}
                      </span>
                    )}
                  </span>
                  <ChevronRight
                    size={17}
                    className="shrink-0 text-ink-faint"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6">
        <AddDishForm />
      </div>
    </>
  );
}
