import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Household = {
  id: string;
  name: string;
  timezone: string;
  join_code: string;
  leader_id: string | null;
};

/**
 * Who is asking, and which household they belong to — the question almost
 * every screen opens with. `cache` keeps it to one round-trip per request
 * even when a layout and its page both ask.
 *
 * Note the explicit column list: `password_hash` is not granted to
 * `authenticated`, so `select("*")` would fail outright.
 */
export const getViewer = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { user, household: null };

  const { data: household } = await supabase
    .from("households")
    .select("id, name, timezone, join_code, leader_id")
    .eq("id", membership.household_id)
    .single();

  return { user, household: household as Household | null };
});

/** For screens that need a household: sends people where they still have to go. */
export async function requireHousehold() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.household) redirect("/welcome");
  return { user: viewer.user, household: viewer.household };
}

/** For the welcome screens: anyone already settled belongs in the app. */
export async function requireNoHousehold() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.household) redirect("/tonight");
  return viewer.user;
}
