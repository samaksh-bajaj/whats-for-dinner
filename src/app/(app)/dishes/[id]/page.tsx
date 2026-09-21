import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft } from "lucide-react";
import { TasteBadge } from "@/components/taste-badge";
import { Button } from "@/components/ui/button";
import { archiveDish } from "@/lib/dish-actions";
import { requireHousehold } from "@/lib/household";
import { householdToday } from "@/lib/rounds";
import { myTaste } from "@/lib/taste";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EditDishForm } from "./edit-dish-form";

export default async function DishPage(props: PageProps<"/dishes/[id]">) {
  const { id } = await props.params;
  const { user, household } = await requireHousehold();
  const supabase = await createSupabaseServerClient();

  const { data: dish } = await supabase
    .from("dishes")
    .select("id, name, note, created_by, archived_at")
    .eq("id", id)
    .maybeSingle();

  // RLS makes another household's dish indistinguishable from a missing one,
  // which is exactly what we want to show.
  if (!dish) notFound();

  const tastes = await myTaste(user.id, householdToday(household));

  const { data: cooks } = await supabase
    .from("profiles")
    .select("id, display_name");
  const addedBy = cooks?.find((cook) => cook.id === dish.created_by);

  const canEdit = dish.created_by === user.id || household.leader_id === user.id;

  return (
    <>
      <Link
        href="/dishes"
        className="inline-flex items-center gap-1.5 text-[14px] text-ink-faint hover:text-ink-soft"
      >
        <ArrowLeft size={15} aria-hidden />
        Dishes
      </Link>

      <h1 className="mt-6 font-display text-[34px] leading-tight font-semibold text-ink">
        {dish.name}
      </h1>
      {dish.note && (
        <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">
          {dish.note}
        </p>
      )}
      <p className="mt-2 text-[13px] text-ink-faint">
        Added by {addedBy?.display_name ?? "someone"}
        {dish.archived_at && " · archived"}
      </p>

      <section className="mt-8">
        <h2 className="text-[13px] font-medium tracking-wide text-ink-faint uppercase">
          Your taste
        </h2>
        <div className="mt-3">
          <TasteBadge taste={tastes.get(dish.id)} />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
          Worked out from how you have voted on it, and nothing to fill in. The
          dots are how much voting that rests on.
        </p>
      </section>

      {canEdit && (
        <>
          <section className="mt-10 border-t border-line pt-6">
            <EditDishForm dishId={dish.id} name={dish.name} note={dish.note} />
          </section>

          {!dish.archived_at && (
            <section className="mt-8">
              <form action={archiveDish}>
                <input type="hidden" name="dish_id" value={dish.id} />
                <Button type="submit" variant="danger" size="sm">
                  <Archive size={16} aria-hidden />
                  Archive this dish
                </Button>
              </form>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
                It leaves the list and stops coming up in rounds. Nights it was
                cooked stay on the calendar.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
