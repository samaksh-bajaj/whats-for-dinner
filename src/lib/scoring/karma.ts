import {
  KARMA_DECAY_PER_DAY,
  KARMA_MAX,
  KARMA_MIN,
  KARMA_ON_LOSS,
  KARMA_ON_WIN,
  VOTE_VALUES,
  type VoteChoice,
} from "./config";
import { daysBetween } from "./dates";

export type MemberKarma = {
  memberId: string;
  value: number;
  lastDecayOn: string;
};

export function clampKarma(value: number) {
  return Math.min(KARMA_MAX, Math.max(KARMA_MIN, value));
}

/**
 * Karma fades: a grievance from three weeks ago should not still be steering
 * dinner. Applied lazily — whoever reads or writes karma brings it up to date
 * first, so there is no nightly job.
 */
export function decayed(karma: MemberKarma, today: string): MemberKarma {
  const days = daysBetween(karma.lastDecayOn, today);
  if (days <= 0) return karma;
  return {
    ...karma,
    value: clampKarma(karma.value * KARMA_DECAY_PER_DAY ** days),
    lastDecayOn: today,
  };
}

export type Vote = { memberId: string; dishId: string; choice: VoteChoice };

/**
 * The dishes a member backed hardest tonight. Usually the ones they said Yum
 * to; for someone who disliked everything it is whatever they disliked least,
 * because "their top-voted dish" still has to mean something.
 */
export function topChoices(votes: readonly Vote[], memberId: string): Set<string> {
  const theirs = votes.filter((vote) => vote.memberId === memberId);
  if (theirs.length === 0) return new Set();

  const best = Math.max(...theirs.map((vote) => VOTE_VALUES[vote.choice]));
  return new Set(
    theirs
      .filter((vote) => VOTE_VALUES[vote.choice] === best)
      .map((vote) => vote.dishId),
  );
}

/**
 * After a round: whoever got their way owes a little, whoever didn't is owed.
 * People who never voted are untouched beyond the decay — they had no stake.
 */
export function karmaAfterRound({
  karma,
  votes,
  winnerDishId,
  today,
}: {
  karma: readonly MemberKarma[];
  votes: readonly Vote[];
  winnerDishId: string;
  today: string;
}): MemberKarma[] {
  const voters = new Set(votes.map((vote) => vote.memberId));

  return karma.map((entry) => {
    const current = decayed(entry, today);
    if (!voters.has(entry.memberId)) return current;

    const top = topChoices(votes, entry.memberId);
    const gotTheirWay = top.has(winnerDishId);
    return {
      ...current,
      value: clampKarma(current.value + (gotTheirWay ? KARMA_ON_WIN : KARMA_ON_LOSS)),
    };
  });
}
