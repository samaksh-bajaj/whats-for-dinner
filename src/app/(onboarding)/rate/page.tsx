import Link from "next/link";
import { redirect } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { RatingScale } from "@/components/rating-scale";
import { requireHousehold } from "@/lib/household";
import { listActiveDishes, unratedDishes } from "@/lib/dishes";

export default async function RatePage() {
  const { user } = await requireHousehold();
  const [dishes, unrated] = await Promise.all([
    listActiveDishes(),
    unratedDishes(user.id),
  ]);

  if (unrated.length === 0) redirect("/tonight");

  const dish = unrated[0];
  const done = dishes.length - unrated.length;

  return (
    <>
      <div className="flex items-center gap-2 text-[13px] text-ink-faint">
        <UtensilsCrossed size={15} aria-hidden />
        <span className="tnum">
          {done + 1} of {dishes.length}
        </span>
      </div>

      <h1 className="mt-8 text-[15px] text-ink-soft">How do you feel about</h1>
      <p className="mt-2 font-display text-[40px] leading-[1.1] font-semibold text-ink">
        {dish.name}
      </p>
      {dish.note && (
        <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
          {dish.note}
        </p>
      )}

      <div className="mt-auto pt-10">
        <RatingScale dishId={dish.id} />
        <p className="mt-5 text-center text-[13px] leading-relaxed text-ink-faint">
          Rate every dish once and you&rsquo;re done — this is the opinion that
          carries into every round. You can change it later on the dish.
        </p>
        {done > 0 && (
          <p className="mt-4 text-center">
            <Link
              href="/dishes"
              className="text-[14px] text-ink-faint hover:text-ink-soft"
            >
              Back to the list
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
