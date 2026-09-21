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
