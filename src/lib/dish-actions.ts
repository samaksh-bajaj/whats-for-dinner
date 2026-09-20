"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DishFormState = { error: string; values?: { name?: string } } | null;

export async function addDish(
  _previous: DishFormState,
  formData: FormData,
): Promise<DishFormState> {
  const { user, household } = await requireHousehold();
  const name = String(formData.get("name") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!name) return { error: "A dish needs a name." };
  if (name.length > 80) {
    return { error: "That name is longer than 80 characters.", values: { name } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("dishes").insert({
    household_id: household.id,
    name,
    note: note || null,
    created_by: user.id,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? `${name} is already on the list.`
          : "We couldn't add that dish.",
      values: { name },
    };
  }

  revalidatePath("/dishes");
  revalidatePath("/rate");
  return null;
}

export async function updateDish(
  _previous: DishFormState,
  formData: FormData,
): Promise<DishFormState> {
  await requireHousehold();
  const id = String(formData.get("dish_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!name) return { error: "A dish needs a name." };

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("dishes")
    .update({ name, note: note || null }, { count: "exact" })
    .eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? `${name} is already on the list.`
          : "We couldn't save that.",
      values: { name },
    };
  }
  // RLS filters rather than refuses: no rows matched means it wasn't yours.
  if (count === 0) {
    return { error: "Only whoever added this dish, or the leader, can edit it." };
  }

  revalidatePath("/dishes");
  redirect("/dishes");
}

export async function archiveDish(formData: FormData) {
  await requireHousehold();
  const id = String(formData.get("dish_id") ?? "");

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("dishes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/dishes");
  revalidatePath("/rate");
  redirect("/dishes");
}

/**
 * One upsert per tap. The five-point scale is the whole vocabulary, so the
 * value is validated against it rather than trusted.
 */
export async function rateDish(formData: FormData) {
  const { user } = await requireHousehold();
  const dishId = String(formData.get("dish_id") ?? "");
  const value = Number(formData.get("value"));

  if (!Number.isInteger(value) || value < -2 || value > 2) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("dish_ratings")
    .upsert({ dish_id: dishId, user_id: user.id, value });

  revalidatePath("/rate");
  revalidatePath("/dishes");
  revalidatePath("/tonight");
}
