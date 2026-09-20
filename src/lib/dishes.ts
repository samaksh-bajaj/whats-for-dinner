import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Dish = {
  id: string;
  name: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

/** The active repertoire — archived dishes stay in history but leave the list. */
export async function listActiveDishes() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("dishes")
    .select("id, name, note, created_by, created_at")
    .is("archived_at", null)
    .order("name");
  return (data ?? []) as Dish[];
}

/** Your own ratings, keyed by dish. */
export async function myRatings(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("dish_ratings")
    .select("dish_id, value")
    .eq("user_id", userId);
  return new Map((data ?? []).map((row) => [row.dish_id, row.value]));
}

/**
 * The gate: every active dish needs a rating from you before you can vote —
 * including one a housemate added an hour ago.
 */
export async function unratedDishes(userId: string) {
  const [dishes, ratings] = await Promise.all([
    listActiveDishes(),
    myRatings(userId),
  ]);
  return dishes.filter((dish) => !ratings.has(dish.id));
}
