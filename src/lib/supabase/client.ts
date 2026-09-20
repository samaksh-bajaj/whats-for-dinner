"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/**
 * The browser client. Used for Realtime subscriptions — tonight's round and
 * the who-has-voted list — not for anything a server component can render.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
}
