import { decayed, karmaAfterRound, type Vote } from "@/lib/scoring/karma";
import { sampleDishes, type SampleDish } from "@/lib/scoring/sample";
import { scoreRound, type Rating } from "@/lib/scoring/score";
import { todayIn } from "@/lib/scoring/dates";
import { requireHousehold, type Household } from "@/lib/household";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Round = {
  id: string;
  round_date: string;
  status: "open" | "closed";
  started_by: string | null;
  ended_by: string | null;
  winner_dish_id: string | null;
};

const ROUND_COLUMNS = "id, round_date, status, started_by, ended_by, winner_dish_id";

export function householdToday(household: Household) {
  return todayIn(household.timezone);
}

export async function getRound(householdId: string, date: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("rounds")
    .select(ROUND_COLUMNS)
    .eq("household_id", householdId)
    .eq("round_date", date)
    .maybeSingle();
  return (data as Round | null) ?? null;
}

/**
 * Everything the sampler and the scorer need, assembled from the household's
 * own rows. All of it is small — a repertoire is tens of dishes, not
 * thousands — so it is cheaper to fetch and fold in TypeScript than to teach
 * Postgres half the formula.
 */
async function gatherFacts() {
  const supabase = await createSupabaseServerClient();

  const [dishes, ratings, closedRounds, votes] = await Promise.all([
    supabase.from("dishes").select("id, name").is("archived_at", null),
    supabase.from("dish_ratings").select("dish_id, user_id, value"),
    supabase
      .from("rounds")
      .select("round_date, winner_dish_id")
      .eq("status", "closed")
      .not("winner_dish_id", "is", null),
    supabase.from("votes").select("dish_id"),
  ]);

  // The winner of a closed round *is* the record that it was cooked.
  const lastCookedOn = new Map<string, string>();
  for (const round of closedRounds.data ?? []) {
    const dishId = round.winner_dish_id!;
    const previous = lastCookedOn.get(dishId);
    if (!previous || round.round_date > previous) {
      lastCookedOn.set(dishId, round.round_date);
    }
  }

  const lifetimeVotes = new Map<string, number>();
  for (const vote of votes.data ?? []) {
    lifetimeVotes.set(vote.dish_id, (lifetimeVotes.get(vote.dish_id) ?? 0) + 1);
  }

  const ratingsByDish = new Map<string, number[]>();
  for (const rating of ratings.data ?? []) {
    ratingsByDish.set(rating.dish_id, [
      ...(ratingsByDish.get(rating.dish_id) ?? []),
      rating.value,
    ]);
  }

  const sampleDishList: SampleDish[] = (dishes.data ?? []).map((dish) => {
    const values = ratingsByDish.get(dish.id) ?? [];
    return {
      id: dish.id,
      lastCookedOn: lastCookedOn.get(dish.id) ?? null,
      baseline: values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : 0,
      lifetimeVotes: lifetimeVotes.get(dish.id) ?? 0,
    };
  });

  const allRatings: Rating[] = (ratings.data ?? []).map((rating) => ({
    memberId: rating.user_id,
    dishId: rating.dish_id,
    value: rating.value,
  }));

  return { dishes: sampleDishList, ratings: allRatings, lastCookedOn };
}

export type RoundOutcome = { error: string } | { roundId: string };

/**
 * Any member can start tonight. The six are drawn here and frozen into
 * round_dishes, so the ballot cannot change under anyone mid-evening.
 */
export async function startRound(): Promise<RoundOutcome> {
  const { user, household } = await requireHousehold();
  const supabase = await createSupabaseServerClient();
  const today = householdToday(household);

  const already = await getRound(household.id, today);
  if (already) return { roundId: already.id };

  const { dishes } = await gatherFacts();
  if (dishes.length === 0) {
    return { error: "There are no dishes to choose between yet." };
  }

  const { data: round, error } = await supabase
    .from("rounds")
    .insert({ household_id: household.id, round_date: today, started_by: user.id })
    .select("id")
    .single();

  if (error || !round) {
    // Two people tapped "Start" at once; the unique (household, date) index
    // settled it. Whoever lost simply joins the round that exists.
    const existing = await getRound(household.id, today);
    if (existing) return { roundId: existing.id };
    return { error: "We couldn't start tonight's round." };
  }

  const picked = sampleDishes({ roundId: round.id, today, dishes });
  const { error: freezeError } = await supabase.from("round_dishes").insert(
    picked.map((dish) => ({
      round_id: round.id,
      dish_id: dish.dishId,
      slot: dish.slot,
    })),
  );

  if (freezeError) {
    // A round with no ballot is worse than no round; take it back.
    await supabase.from("rounds").delete().eq("id", round.id);
    return { error: "We couldn't set tonight's dishes." };
  }

  return { roundId: round.id };
}

/**
 * Any member can end it, at any time. Whoever hasn't voted is excluded from
 * the scoring rather than blocking it — but a round with nobody's opinion in
 * it decides nothing, so that one is refused.
 */
export async function closeRound(roundId: string): Promise<RoundOutcome> {
  const { user, household } = await requireHousehold();
  const supabase = await createSupabaseServerClient();
  const today = householdToday(household);

  const { data: round } = await supabase
    .from("rounds")
    .select(ROUND_COLUMNS)
    .eq("id", roundId)
    .maybeSingle();

  if (!round) return { error: "That round is gone." };
  if (round.status !== "open") return { error: "This round has already ended." };

  const [ballot, tally, karmaRows, facts] = await Promise.all([
    supabase.from("round_dishes").select("dish_id").eq("round_id", roundId),
    supabase.from("votes").select("user_id, dish_id, choice").eq("round_id", roundId),
    supabase.from("member_karma").select("user_id, value, last_decay_on"),
    gatherFacts(),
  ]);

  const votes: Vote[] = (tally.data ?? []).map((vote) => ({
    memberId: vote.user_id,
    dishId: vote.dish_id,
    choice: vote.choice,
  }));

  if (votes.length === 0) {
    return { error: "Nobody has voted yet. Someone has to weigh in first." };
  }

  const karma = (karmaRows.data ?? []).map((row) =>
    decayed(
      { memberId: row.user_id, value: Number(row.value), lastDecayOn: row.last_decay_on },
      today,
    ),
  );

  const result = scoreRound({
    roundId,
    today,
    dishes: (ballot.data ?? []).map((entry) => ({
      id: entry.dish_id,
      lastCookedOn: facts.lastCookedOn.get(entry.dish_id) ?? null,
    })),
    ratings: facts.ratings,
    votes,
    karma: karma.map((entry) => ({ memberId: entry.memberId, value: entry.value })),
  });

  if (!result.winnerDishId) {
    return { error: "Nobody has voted yet. Someone has to weigh in first." };
  }

  // The status check is the guard: if someone else ended this round a moment
  // ago, this update matches no rows and we stop rather than score it twice.
  const { data: closed } = await supabase
    .from("rounds")
    .update({
      status: "closed",
      ended_by: user.id,
      ended_at: new Date().toISOString(),
      winner_dish_id: result.winnerDishId,
    })
    .eq("id", roundId)
    .eq("status", "open")
    .select("id");

  if (!closed?.length) return { error: "Someone else just ended this round." };

  await Promise.all([
    ...result.ranked.map((dish) =>
      supabase
        .from("round_dishes")
        .update({ final_score: dish.score })
        .eq("round_id", roundId)
        .eq("dish_id", dish.dishId),
    ),
    supabase.from("member_karma").upsert(
      karmaAfterRound({ karma, votes, winnerDishId: result.winnerDishId, today }).map(
        (entry) => ({
          household_id: household.id,
          user_id: entry.memberId,
          value: entry.value,
          last_decay_on: entry.lastDecayOn,
        }),
      ),
    ),
  ]);

  return { roundId };
}
