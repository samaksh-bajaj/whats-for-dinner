"use server";

import { revalidatePath } from "next/cache";
import { closeRound, getRound, householdToday, startRound } from "@/lib/rounds";
import { requireHousehold } from "@/lib/household";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VOTE_VALUES, type VoteChoice } from "@/lib/scoring/config";

export type RoundActionState = { error: string } | null;

function isChoice(value: unknown): value is VoteChoice {
  return typeof value === "string" && value in VOTE_VALUES;
}

export async function startRoundAction(
  _previous: RoundActionState,
  _formData: FormData,
): Promise<RoundActionState> {
  const result = await startRound();
  revalidatePath("/tonight");
  return "error" in result ? { error: result.error } : null;
}

export async function submitVotesAction(
  _previous: RoundActionState,
  formData: FormData,
): Promise<RoundActionState> {
  const { user, household } = await requireHousehold();
  const roundId = String(formData.get("round_id") ?? "");

  let choices: Record<string, unknown>;
  try {
    choices = JSON.parse(String(formData.get("choices") ?? "{}"));
  } catch {
    return { error: "Something went wrong reading your votes." };
  }

  const round = await getRound(household.id, householdToday(household));
  if (!round || round.id !== roundId) return { error: "That round is gone." };
  if (round.status !== "open") return { error: "This round has already ended." };

  const supabase = await createSupabaseServerClient();
  const { data: ballot } = await supabase
    .from("round_dishes")
    .select("dish_id")
    .eq("round_id", roundId);

  const onTheBallot = (ballot ?? []).map((entry) => entry.dish_id);
  const rows = onTheBallot.map((dishId) => ({
    round_id: roundId,
    user_id: user.id,
    dish_id: dishId,
    choice: choices[dishId],
  }));

  if (!rows.every((row) => isChoice(row.choice))) {
    return { error: "Every dish needs an answer before you can send them." };
  }

  const { error } = await supabase
    .from("votes")
    .upsert(rows as { round_id: string; user_id: string; dish_id: string; choice: VoteChoice }[]);

  if (error) return { error: "We couldn't save your votes." };

  revalidatePath("/tonight");
  return null;
}

export async function endRoundAction(
  _previous: RoundActionState,
  formData: FormData,
): Promise<RoundActionState> {
  const result = await closeRound(String(formData.get("round_id") ?? ""));
  revalidatePath("/tonight");
  revalidatePath("/calendar");
  return "error" in result ? { error: result.error } : null;
}
