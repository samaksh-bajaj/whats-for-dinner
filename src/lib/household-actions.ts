"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// React 19 resets a form once its action settles, so anything worth keeping
// after a failure has to come back out as a default value. Never the password.
export type FormState = {
  error: string;
  values?: { name?: string; code?: string };
} | null;

/**
 * The RPCs raise their own user-facing messages (`P0001`). Anything else is a
 * Postgres detail no cook should have to read.
 */
function friendly(error: { code?: string; message: string }, fallback: string) {
  return error.code === "P0001" ? error.message : fallback;
}

export async function createHousehold(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const timezone = String(formData.get("timezone") ?? "UTC");

  if (!name) return { error: "Your household needs a name." };
  if (password.length < 4) {
    return { error: "Pick a password of at least 4 characters.", values: { name } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_household", {
    p_name: name,
    p_password: password,
    p_timezone: timezone,
  });

  if (error) {
    return {
      error: friendly(error, "We couldn't create that household."),
      values: { name },
    };
  }

  // The leader's first job is stocking the list.
  redirect("/dishes");
}

export async function joinHousehold(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const password = String(formData.get("password") ?? "");

  if (code.length !== 6) {
    return { error: "A join code is six characters.", values: { code } };
  }
  if (!password) {
    return { error: "The household password is missing.", values: { code } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("join_household", {
    p_code: code,
    p_password: password,
  });

  if (error) {
    return {
      error: friendly(error, "We couldn't join that household."),
      values: { code },
    };
  }

  redirect("/tonight");
}

export async function renameHousehold(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const id = String(formData.get("household_id") ?? "");
  if (!name) return { error: "A household needs a name." };

  const supabase = await createSupabaseServerClient();
  // RLS decides whether this is allowed; no leader check is needed here.
  const { error } = await supabase
    .from("households")
    .update({ name })
    .eq("id", id);

  if (error) return { error: "Only the leader can rename the household." };

  revalidatePath("/household");
  return null;
}

export async function updateDisplayName(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) return { error: "Your name can't be empty." };
  if (displayName.length > 40) return { error: "That name is a bit long." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) return { error: "We couldn't save that name." };

  revalidatePath("/household");
  return null;
}
