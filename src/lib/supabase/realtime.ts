import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Hand Realtime the session token before subscribing to anything.
 *
 * The browser client loads its session lazily, so a channel that subscribes on
 * mount can open the socket before any token exists. The join still succeeds —
 * as `anon` — and since every policy in this schema is `to authenticated`, the
 * subscription then sits there receiving nothing at all. A silent dead roster
 * is a far worse failure than an error, so this runs first.
 */
export async function authorizeRealtime(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) await supabase.realtime.setAuth(token);
  return Boolean(token);
}
