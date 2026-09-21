import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TasteIcon } from "@/components/taste-badge";
import { requireHousehold } from "@/lib/household";
import { listActiveDishes } from "@/lib/dishes";
import { householdToday } from "@/lib/rounds";
import { myTaste } from "@/lib/taste";
import { AddDishForm } from "./add-dish-form";

export default async function DishesPage() {
  const { user, household } = await requireHousehold();
  const [dishes, tastes] = await Promise.all([
    listActiveDishes(),
    myTaste(user.id, householdToday(household)),
  ]);

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

      {dishes.length === 0 ? (
        <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
          Nothing on the list yet. Six or so is enough to start &mdash; the
          ordinary weeknight things, not just the showpieces.
        </p>
      ) : (
        <ul className="mt-6 border-t border-line">
          {dishes.map((dish) => {
            return (
              <li key={dish.id}>
                <Link
                  href={`/dishes/${dish.id}`}
                  className="flex items-center gap-3 border-b border-line-soft py-3.5"
                >
                  <TasteIcon taste={tastes.get(dish.id)} />
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
