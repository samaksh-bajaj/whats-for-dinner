import {
  JITTER,
  KARMA_TERM_WEIGHT,
  MIN_WEIGHT,
  RECENCY_BANDS,
  RECENCY_PENALTY_BEYOND,
  UNRATED_BASELINE,
  VOTE_VALUES,
  type VoteChoice,
} from "./config";
import { daysSince } from "./dates";
import { seededUnit } from "./random";
import type { Vote } from "./karma";

export type Rating = { memberId: string; dishId: string; value: number };
export type DishFacts = { id: string; lastCookedOn: string | null };

export type ScoreRoundInput = {
  roundId: string;
  /** The round's own date, in the household's timezone. */
  today: string;
  /** The six frozen at round start. */
  dishes: readonly DishFacts[];
  ratings: readonly Rating[];
  votes: readonly Vote[];
  /** Already decayed to `today`. */
  karma: readonly { memberId: string; value: number }[];
};

export type MemberScore = { memberId: string; value: number };

export type DishResult = {
  dishId: string;
  score: number;
  min: number;
  mean: number;
  recency: number;
  karma: number;
  jitter: number;
  memberScores: MemberScore[];
};

export type RoundResult =
  | { ranked: DishResult[]; winnerDishId: string }
  | { ranked: []; winnerDishId: null; reason: "no-votes" };

/** How stale a dish is. Never cooked is as fresh as it gets. */
export function recencyPenalty(lastCookedOn: string | null, today: string) {
  const days = daysSince(lastCookedOn, today);
  if (days === null) return RECENCY_PENALTY_BEYOND;
  // A date in the future would be someone's clock being wrong, not a reason to
  // treat the dish as ancient.
  const elapsed = Math.max(0, days);
  return (
    RECENCY_BANDS.find((band) => elapsed <= band.upToDays)?.penalty ??
    RECENCY_PENALTY_BEYOND
  );
}

/** Tonight's feeling on top of the lasting one. */
export function memberScore(baseline: number, choice: VoteChoice) {
  return baseline + VOTE_VALUES[choice];
}

/** Deterministic on (round, dish): scoring twice cannot change the winner. */
export function jitterFor(roundId: string, dishId: string) {
  return (seededUnit(`${roundId}:${dishId}`) * 2 - 1) * JITTER;
}

export function scoreRound(
  input: ScoreRoundInput,
  options: { jitter?: (roundId: string, dishId: string) => number } = {},
): RoundResult {
  const jitter = options.jitter ?? jitterFor;

  // Only people who actually voted count — towards the minimum, the mean, or
  // anything else. Whoever didn't vote before the round ended is simply absent.
  const voters = [...new Set(input.votes.map((vote) => vote.memberId))];
  if (voters.length === 0) return { ranked: [], winnerDishId: null, reason: "no-votes" };

  const baseline = new Map(
    input.ratings.map((rating) => [`${rating.memberId}:${rating.dishId}`, rating.value]),
  );
  const voteFor = new Map(
    input.votes.map((vote) => [`${vote.memberId}:${vote.dishId}`, vote.choice]),
  );
  const karmaOf = new Map(input.karma.map((entry) => [entry.memberId, entry.value]));

  const ranked = input.dishes.map((dish): DishResult => {
    const memberScores: MemberScore[] = [];
    for (const memberId of voters) {
      const choice = voteFor.get(`${memberId}:${dish.id}`);
      // A voter who skipped this one dish abstains on it rather than counting
      // as indifferent — the UI does not allow it, but the maths should not
      // invent an opinion either way.
      if (!choice) continue;
      const rated = baseline.get(`${memberId}:${dish.id}`) ?? UNRATED_BASELINE;
      memberScores.push({ memberId, value: memberScore(rated, choice) });
    }

    const values = memberScores.map((entry) => entry.value);
    const min = values.length ? Math.min(...values) : 0;
    const mean = values.length
      ? values.reduce((total, value) => total + value, 0) / values.length
      : 0;

    const recency = recencyPenalty(dish.lastCookedOn, input.today);

    // Only the people who actively wanted this dish tonight lend it their
    // karma — otherwise someone owed a win would lift every dish equally.
    const enthusiasts = memberScores
      .filter((entry) => voteFor.get(`${entry.memberId}:${dish.id}`) === "yum")
      .map((entry) => karmaOf.get(entry.memberId) ?? 0);
    const karma = enthusiasts.length
      ? KARMA_TERM_WEIGHT *
        (enthusiasts.reduce((total, value) => total + value, 0) / enthusiasts.length)
      : 0;

    const wobble = jitter(input.roundId, dish.id);
    const score = MIN_WEIGHT * min + mean - recency + karma + wobble;

    return { dishId: dish.id, score, min, mean, recency, karma, jitter: wobble, memberScores };
  });

  ranked.sort(compareDishes(input));
  return { ranked, winnerDishId: ranked[0].dishId };
}

/** Highest score, then the least-hated, then whatever has waited longest. */
function compareDishes(input: ScoreRoundInput) {
  const lastCooked = new Map(input.dishes.map((dish) => [dish.id, dish.lastCookedOn]));

  return (a: DishResult, b: DishResult) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.min !== b.min) return b.min - a.min;

    const aCooked = lastCooked.get(a.dishId) ?? null;
    const bCooked = lastCooked.get(b.dishId) ?? null;
    // Never cooked counts as the longest wait of all.
    if (aCooked !== bCooked) {
      if (aCooked === null) return -1;
      if (bCooked === null) return 1;
      return aCooked < bCooked ? -1 : 1;
    }

    // Stable, seeded, and never a re-roll.
    return (
      seededUnit(`${input.roundId}:tiebreak:${a.dishId}`) -
      seededUnit(`${input.roundId}:tiebreak:${b.dishId}`)
    );
  };
}
