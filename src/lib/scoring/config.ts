/**
 * Every tunable number in the app. Nothing here is duplicated in SQL: Postgres
 * stores rows, this file decides dinner. If an evening starts feeling unfair,
 * this is the only file to argue about.
 */

/** What tonight's vote is worth, on top of the lasting taste. */
export const VOTE_VALUES = { yum: 2, meh: 0, yuck: -3 } as const;

export type VoteChoice = keyof typeof VOTE_VALUES;

/**
 * The same vote, read as a lasting opinion rather than tonight's mood. Yuck is
 * -2 here and -3 above on purpose: the extra point is a veto that belongs to
 * the evening, while what you generally think of a dish sits on the symmetric
 * -2..+2 scale. That is what keeps a member's score inside [-5, +4].
 */
export const TASTE_VALUES = { yum: 2, meh: 0, yuck: -2 } as const;

/** 0.99^69 = 0.5, so an opinion is worth half as much after ten weeks. */
export const TASTE_DECAY_PER_DAY = 0.99;

/**
 * Shrinkage, in imaginary observations sitting at zero. It is what makes one
 * night's vote a hint rather than a verdict: a single yum learns +0.67, not
 * +2, and only repeated agreement climbs. It also means someone who has never
 * voted on a dish contributes nothing at all instead of being guessed at.
 */
export const TASTE_SHRINKAGE = 2;

/** A dish you have never voted on. The algebra keeps |taste| < 2 either way. */
export const NO_TASTE = 0;

/**
 * How hard the least-happy member pulls. At 2, one person's "yuck" outweighs
 * two other people's mild enthusiasm — which is the entire point of the app.
 */
export const MIN_WEIGHT = 2;

/** Days since last cooked -> penalty. First matching band wins. */
export const RECENCY_BANDS: ReadonlyArray<{ upToDays: number; penalty: number }> = [
  { upToDays: 2, penalty: 4.0 },
  { upToDays: 5, penalty: 2.0 },
  { upToDays: 9, penalty: 0.8 },
  { upToDays: 14, penalty: 0.3 },
];
export const RECENCY_PENALTY_BEYOND = 0;

/** Karma: ground given to whoever keeps losing. */
export const KARMA_ON_LOSS = 1.0;
export const KARMA_ON_WIN = -0.75;
/**
 * A ~7-day half-life: 0.905^7 = 0.497. The original plan called this a
 * fortnight, which was simply wrong arithmetic; a week is what was wanted and
 * what this is. (0.9513 would be a genuine fortnight, if that ever changes.)
 */
export const KARMA_DECAY_PER_DAY = 0.905;
export const KARMA_MIN = -3;
export const KARMA_MAX = 3;
/** How much of the Yum-voters' mean karma reaches the dish's score. */
export const KARMA_TERM_WEIGHT = 0.5;

/** Jitter is uniform over [-JITTER, +JITTER), seeded so it never re-rolls. */
export const JITTER = 0.15;

/** Six dishes a night, frozen when the round starts. */
export const SAMPLE_SIZE = 6;

export type SlotType = "favourite" | "exploration" | "wildcard";

/**
 * Filled in order. `windows` are the "not cooked in the last N days" rules,
 * tried in turn — if a slot still can't be filled after the last one, it draws
 * at random from whatever is left.
 */
export const SLOT_PLAN: ReadonlyArray<{
  slot: SlotType;
  count: number;
  windows: readonly number[];
}> = [
  { slot: "favourite", count: 3, windows: [7, 3, 0] },
  { slot: "exploration", count: 2, windows: [0] },
  { slot: "wildcard", count: 1, windows: [15, 7, 0] },
];
