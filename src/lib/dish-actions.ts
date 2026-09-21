"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHousehold } from "@/lib/household";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DishFormState = { error: string; values?: { name?: string } } | null;

/** The add form submits a stack of names, so its failures echo all of them. */
export type AddDishFormState =
  | { error: string; values?: { names?: string[] } }
  | null;

/** The key the unique index uses: one "Rajma chawal" however it was capitalised. */
const key = (name: string) => name.trim().toLowerCase();

const listOf = (names: string[]) =>
  new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(names);

export async function addDish(
  _previous: AddDishFormState,
  formData: FormData,
): Promise<AddDishFormState> {
  const { user, household } = await requireHousehold();

  // Blank rows are ignored rather than rejected — that is what makes a
  // trailing empty field harmless.
  const entered = formData
    .getAll("name")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (entered.length === 0) return { error: "A dish needs a name." };

  const tooLong = entered.find((name) => name.length > 80);
  if (tooLong) {
    return {
      error: `${tooLong.slice(0, 30)}… is longer than 80 characters.`,
      values: { names: entered },
    };
  }

  // Typing the same dish twice in one batch is unambiguous, not an error:
  // the first one wins and the repeat quietly falls away.
  const batch = [...new Map(entered.map((name) => [key(name), name])).values()];

  const supabase = await createSupabaseServerClient();
  // RLS scopes this to the household already.
  const { data: existing } = await supabase
    .from("dishes")
    .select("name")
    .is("archived_at", null);
  const taken = new Map((existing ?? []).map((dish) => [key(dish.name), dish.name]));

  const fresh = batch.filter((name) => !taken.has(key(name)));
  // Name the clash the way the list already spells it, not the way it was
  // just typed — "Pizza is already on the list", never "pizza is".
  const clashing = batch.filter((name) => taken.has(key(name)));

  if (fresh.length > 0) {
    const { error } = await supabase.from("dishes").insert(
      fresh.map((name) => ({
        household_id: household.id,
        name,
        created_by: user.id,
      })),
    );

    if (error) {
      return {
        error:
          // Someone else got the same name in between the read and the write.
          error.code === "23505"
            ? "Someone just added one of those. Try again."
            : "We couldn't add those dishes.",
        values: { names: entered },
      };
    }

    revalidatePath("/dishes");
  }

  // Rows were written, so the list has been revalidated — but a non-null
  // result keeps the form open holding the names that didn't make it.
  if (clashing.length > 0) {
    return {
      error: `${listOf(clashing.map((name) => taken.get(key(name)) ?? name))} ${
        clashing.length === 1 ? "is" : "are"
      } already on the list.`,
      values: { names: clashing },
    };
  }

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
  redirect("/dishes");
}
