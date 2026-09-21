/**
 * What someone generally thinks of a dish, learned from how they have voted on
 * it before. Nobody is ever asked for this directly — the evening's ballot is
 * the only input the app has, and the only one it needs.
 *
 *   taste = Σ wᵢ·vᵢ / (Σ wᵢ + K)
 *
 * A shrunk, time-decayed mean. The shrinkage K is the interesting part: with
 * no history the numerator and the weight are both zero, so taste is exactly
 * zero and the lasting term simply stays quiet while tonight's vote speaks. A
 * member who joined this evening is therefore never at a disadvantage to one
 * who has been here a year; they just have less to say yet.
 */

import { TASTE_DECAY_PER_DAY, TASTE_SHRINKAGE, TASTE_VALUES, type VoteChoice } from "./config";
import { daysBetween } from "./dates";

/** One vote, from one closed round. `on` is a household calendar day. */
export type TasteObservation = {
  memberId: string;
  dishId: string;
  choice: VoteChoice;
  on: string;
};

export type Taste = {
  memberId: string;
  dishId: string;
  /** -2..+2, exclusive at both ends. Zero means "no idea yet". */
  value: number;
  /** Σw — how much evidence is behind the value, for showing confidence. */
  weight: number;
};

/** How much a vote cast on `on` still counts for on `today`. */
export function observationWeight(on: string, today: string) {
  // A round dated in the future is someone's clock being wrong, not an opinion
  // worth more than today's.
  const days = Math.max(0, daysBetween(on, today));
  return TASTE_DECAY_PER_DAY ** days;
}

/**
 * Fold a vote history into one taste per (member, dish). Pure, order-
 * independent, and total: pairs with no history are absent from the result
 * rather than present at zero, which is what `NO_TASTE` is for at the reading
 * end.
 */
export function learnTaste(
  history: readonly TasteObservation[],
  today: string,
): Taste[] {
  const totals = new Map<string, { memberId: string; dishId: string; sum: number; weight: number }>();

  for (const observation of history) {
    const key = `${observation.memberId}:${observation.dishId}`;
    const running = totals.get(key) ?? {
      memberId: observation.memberId,
      dishId: observation.dishId,
      sum: 0,
      weight: 0,
    };
    const weight = observationWeight(observation.on, today);
    running.sum += weight * TASTE_VALUES[observation.choice];
    running.weight += weight;
    totals.set(key, running);
  }

  return [...totals.values()].map(({ memberId, dishId, sum, weight }) => ({
    memberId,
    dishId,
    value: sum / (weight + TASTE_SHRINKAGE),
    weight,
  }));
}

/**
 * The household's mean taste for each dish — what the sampler ranks its
 * favourite slot by, and what the calendar shows. Members with nothing learned
 * about a dish are absent rather than counted as indifferent, so one person's
 * opinion is not diluted by housemates who have never tried it.
 */
export function householdTasteByDish(tastes: readonly Taste[]) {
  const byDish = new Map<string, number[]>();
  for (const taste of tastes) {
    byDish.set(taste.dishId, [...(byDish.get(taste.dishId) ?? []), taste.value]);
  }

  return new Map(
    [...byDish].map(([dishId, values]) => [
      dishId,
      values.reduce((total, value) => total + value, 0) / values.length,
    ]),
  );
}
