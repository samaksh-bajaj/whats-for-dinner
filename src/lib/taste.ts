import { learnTaste, type Taste, type TasteObservation } from "@/lib/scoring/taste";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Every vote that counts as a lasting opinion, dated by the evening it was
 * cast. One place decides this, because the rule has a sharp edge:
 *
 * **Only closed rounds count.** Tonight's votes are tonight's vote — letting
 * them into the taste as well would have a single tap count twice in the same
 * scoring pass, and would mean re-scoring an open round could move the winner.
 * They join the history the moment the round is ended.
 *
 * Both queries lean on the existing SELECT policies, which are household-wide
 * rather than round-scoped, so nothing new has to be granted. The volume is a
 * few thousand rows a year for a household — six votes each per evening — so
 * the join happens here rather than in Postgres, like every other fold in the
 * app. If it ever stops being small the answer is a `round_date` on `votes`,
 * not scoring in SQL.
 */
export async function tasteObservations(): Promise<TasteObservation[]> {
  const supabase = await createSupabaseServerClient();

  const [{ data: votes }, { data: rounds }] = await Promise.all([
    supabase.from("votes").select("round_id, user_id, dish_id, choice"),
    supabase.from("rounds").select("id, round_date").eq("status", "closed"),
  ]);

  const dateOf = new Map((rounds ?? []).map((round) => [round.id, round.round_date]));

  return (votes ?? []).flatMap((vote) => {
    const on = dateOf.get(vote.round_id);
    return on ? [{ memberId: vote.user_id, dishId: vote.dish_id, choice: vote.choice, on }] : [];
  });
}

/** Your own taste, keyed by dish — what the dishes list and a dish page show. */
export async function myTaste(userId: string, today: string) {
  const history = await tasteObservations();
  const mine = learnTaste(
    history.filter((observation) => observation.memberId === userId),
    today,
  );
  return new Map<string, Taste>(mine.map((taste) => [taste.dishId, taste]));
}
