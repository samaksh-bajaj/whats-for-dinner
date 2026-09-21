import { SLOT_PLAN, type SlotType } from "./config";
import { daysSince } from "./dates";
import { seededRandom, seededUnit } from "./random";

export type SampleDish = {
  id: string;
  lastCookedOn: string | null;
  /** The household's mean learned taste for this dish. */
  taste: number;
  /** How many votes it has ever received, across all rounds. */
  lifetimeVotes: number;
};

export type SampledDish = { dishId: string; slot: SlotType };

/** "Not cooked in the last N days", with never-cooked always passing. */
function restedFor(dish: SampleDish, today: string, days: number) {
  const since = daysSince(dish.lastCookedOn, today);
  return since === null || since >= days;
}

/**
 * The six that go up tonight, drawn once and then frozen.
 *
 * Three the household likes and hasn't had lately, two that nobody has had a
 * chance to vote on, and one wildcard from the back of the cupboard. A slot
 * that cannot be filled relaxes its "not cooked in N days" rule and, failing
 * that, takes whatever is left — day one has no history at all, so the
 * fallbacks are the normal path, not the exception.
 *
 * With every taste at zero the favourite slot falls through to fewest votes
 * and then the coin, which is how a household with no history bootstraps one:
 * the exploration slots keep putting unfamiliar dishes in front of people, and
 * voting on them is what teaches the app their taste in the first place.
 *
 * With fewer than six active dishes this naturally returns all of them.
 */
export function sampleDishes({
  roundId,
  today,
  dishes,
}: {
  roundId: string;
  today: string;
  dishes: readonly SampleDish[];
}): SampledDish[] {
  const random = seededRandom(`${roundId}:sample`);
  const coin = (dish: SampleDish) => seededUnit(`${roundId}:${dish.id}`);

  const remaining = new Map(dishes.map((dish) => [dish.id, dish]));
  const picked: SampledDish[] = [];

  const take = (dish: SampleDish, slot: SlotType) => {
    remaining.delete(dish.id);
    picked.push({ dishId: dish.id, slot });
  };

  const rank: Record<SlotType, (a: SampleDish, b: SampleDish) => number> = {
    // Liked, and among equals the one that has been asked about least.
    favourite: (a, b) =>
      b.taste - a.taste || a.lifetimeVotes - b.lifetimeVotes || coin(a) - coin(b),
    // The whole point is the dishes nobody has weighed in on yet.
    exploration: (a, b) =>
      a.lifetimeVotes - b.lifetimeVotes || b.taste - a.taste || coin(a) - coin(b),
    // No merit involved.
    wildcard: (a, b) => coin(a) - coin(b),
  };

  for (const { slot, count, windows } of SLOT_PLAN) {
    let needed = count;

    for (const window of windows) {
      if (needed === 0) break;
      const eligible = [...remaining.values()]
        .filter((dish) => restedFor(dish, today, window))
        .sort(rank[slot]);

      for (const dish of eligible.slice(0, needed)) {
        take(dish, slot);
        needed--;
      }
    }

    // Still short: the window was never the problem, there just aren't enough
    // dishes. Take what's left, at random.
    while (needed > 0 && remaining.size > 0) {
      const pool = [...remaining.values()];
      const dish = pool[Math.floor(random() * pool.length)];
      take(dish, slot);
      needed--;
    }
  }

  return picked;
}
