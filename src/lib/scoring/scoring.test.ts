import { describe, expect, it } from "vitest";
import { KARMA_DECAY_PER_DAY, SAMPLE_SIZE } from "./config";
import { daysBetween } from "./dates";
import { decayed, karmaAfterRound, topChoices, type Vote } from "./karma";
import { sampleDishes, type SampleDish } from "./sample";
import {
  jitterFor,
  recencyPenalty,
  scoreRound,
  type Rating,
  type ScoreRoundInput,
} from "./score";

const TODAY = "2026-09-20";
/** Tests assert the formula, not the wobble; jitter gets its own tests. */
const noJitter = { jitter: () => 0 };

function daysAgo(days: number) {
  const date = new Date(Date.UTC(2026, 8, 20) - days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

describe("recency", () => {
  it("penalises by band, hardest when it was just cooked", () => {
    expect(recencyPenalty(daysAgo(0), TODAY)).toBe(4.0);
    expect(recencyPenalty(daysAgo(2), TODAY)).toBe(4.0);
    expect(recencyPenalty(daysAgo(3), TODAY)).toBe(2.0);
    expect(recencyPenalty(daysAgo(5), TODAY)).toBe(2.0);
    expect(recencyPenalty(daysAgo(6), TODAY)).toBe(0.8);
    expect(recencyPenalty(daysAgo(9), TODAY)).toBe(0.8);
    expect(recencyPenalty(daysAgo(10), TODAY)).toBe(0.3);
    expect(recencyPenalty(daysAgo(14), TODAY)).toBe(0.3);
    expect(recencyPenalty(daysAgo(15), TODAY)).toBe(0);
  });

  it("treats a dish never cooked as carrying no penalty", () => {
    expect(recencyPenalty(null, TODAY)).toBe(0);
  });

  it("counts calendar days, not elapsed hours", () => {
    expect(daysBetween("2026-09-18", "2026-09-20")).toBe(2);
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});

describe("a hand-computed evening", () => {
  // Three people, three dishes, every number worked out by hand below.
  const ratings: Rating[] = [
    { memberId: "ada", dishId: "rajma", value: 2 },
    { memberId: "ada", dishId: "khichdi", value: 0 },
    { memberId: "ada", dishId: "pasta", value: -1 },
    { memberId: "bo", dishId: "rajma", value: 1 },
    { memberId: "bo", dishId: "khichdi", value: 2 },
    { memberId: "bo", dishId: "pasta", value: 0 },
    { memberId: "kim", dishId: "rajma", value: -2 },
    { memberId: "kim", dishId: "khichdi", value: 1 },
    // kim never rated pasta: baseline 0.
  ];

  const votes: Vote[] = [
    { memberId: "ada", dishId: "rajma", choice: "yum" },
    { memberId: "ada", dishId: "khichdi", choice: "meh" },
    { memberId: "ada", dishId: "pasta", choice: "yuck" },
    { memberId: "bo", dishId: "rajma", choice: "meh" },
    { memberId: "bo", dishId: "khichdi", choice: "yum" },
    { memberId: "bo", dishId: "pasta", choice: "meh" },
    { memberId: "kim", dishId: "rajma", choice: "yuck" },
    { memberId: "kim", dishId: "khichdi", choice: "yum" },
    { memberId: "kim", dishId: "pasta", choice: "meh" },
  ];

  const input: ScoreRoundInput = {
    roundId: "round-1",
    today: TODAY,
    dishes: [
      { id: "rajma", lastCookedOn: daysAgo(2) },
      { id: "khichdi", lastCookedOn: null },
      { id: "pasta", lastCookedOn: daysAgo(15) },
    ],
    ratings,
    votes,
    karma: [
      { memberId: "ada", value: 0 },
      { memberId: "bo", value: 0 },
      { memberId: "kim", value: 1 },
    ],
  };

  const result = scoreRound(input, noJitter);
  const by = (id: string) => result.ranked.find((dish) => dish.dishId === id)!;

  it("scores rajma at -14: 2*(-5) + 0 - 4.0, no karma behind it", () => {
    // ada 2+2=4, bo 1+0=1, kim -2-3=-5 -> min -5, mean 0, cooked two days ago.
    expect(by("rajma").min).toBe(-5);
    expect(by("rajma").mean).toBe(0);
    expect(by("rajma").recency).toBe(4.0);
    expect(by("rajma").karma).toBe(0);
    expect(by("rajma").score).toBeCloseTo(-14, 10);
  });

  it("scores khichdi at 2.5833: 2*0 + 7/3 - 0 + 0.25", () => {
    // ada 0+0=0, bo 2+2=4, kim 1+2=3 -> min 0, mean 7/3, never cooked.
    // Yum came from bo (karma 0) and kim (karma 1): 0.5 * 0.5 = 0.25.
    expect(by("khichdi").min).toBe(0);
    expect(by("khichdi").mean).toBeCloseTo(7 / 3, 10);
    expect(by("khichdi").recency).toBe(0);
    expect(by("khichdi").karma).toBeCloseTo(0.25, 10);
    expect(by("khichdi").score).toBeCloseTo(2 * 0 + 7 / 3 + 0.25, 10);
  });

  it("scores pasta at -9.3333, with kim's missing rating counting as 0", () => {
    // ada -1-3=-4, bo 0, kim 0 (unrated) -> min -4, mean -4/3, 15 days rested.
    expect(by("pasta").min).toBe(-4);
    expect(by("pasta").mean).toBeCloseTo(-4 / 3, 10);
    expect(by("pasta").recency).toBe(0);
    expect(by("pasta").score).toBeCloseTo(-8 - 4 / 3, 10);
  });

  it("gives the night to khichdi", () => {
    expect(result.winnerDishId).toBe("khichdi");
    expect(result.ranked.map((dish) => dish.dishId)).toEqual([
      "khichdi",
      "pasta",
      "rajma",
    ]);
  });

  it("settles karma: ada is owed one, bo and kim paid for getting their way", () => {
    const after = karmaAfterRound({
      karma: [
        { memberId: "ada", value: 0, lastDecayOn: TODAY },
        { memberId: "bo", value: 0, lastDecayOn: TODAY },
        { memberId: "kim", value: 1, lastDecayOn: TODAY },
      ],
      votes,
      winnerDishId: "khichdi",
      today: TODAY,
    });

    expect(after).toEqual([
      { memberId: "ada", value: 1, lastDecayOn: TODAY },
      { memberId: "bo", value: -0.75, lastDecayOn: TODAY },
      { memberId: "kim", value: 0.25, lastDecayOn: TODAY },
    ]);
  });
});

describe("the awkward evenings", () => {
  const dishes = [
    { id: "a", lastCookedOn: null },
    { id: "b", lastCookedOn: null },
  ];

  it("refuses to pick a winner when nobody voted", () => {
    const result = scoreRound(
      { roundId: "r", today: TODAY, dishes, ratings: [], votes: [], karma: [] },
      noJitter,
    );
    expect(result.winnerDishId).toBeNull();
    expect(result).toMatchObject({ reason: "no-votes" });
  });

  it("still picks the least-bad dish when everything got a Yuck", () => {
    const votes: Vote[] = [
      { memberId: "ada", dishId: "a", choice: "yuck" },
      { memberId: "ada", dishId: "b", choice: "yuck" },
      { memberId: "bo", dishId: "a", choice: "yuck" },
      { memberId: "bo", dishId: "b", choice: "yuck" },
    ];
    const result = scoreRound(
      {
        roundId: "r",
        today: TODAY,
        dishes,
        ratings: [
          { memberId: "ada", dishId: "a", value: 1 },
          { memberId: "bo", dishId: "a", value: 0 },
          { memberId: "ada", dishId: "b", value: -2 },
          { memberId: "bo", dishId: "b", value: -1 },
        ],
        votes,
        karma: [],
      },
      noJitter,
    );

    expect(result.winnerDishId).toBe("a");
    expect(result.ranked[0].score).toBeLessThan(0);
  });

  it("counts only the people who voted, ignoring the ones who didn't", () => {
    const result = scoreRound(
      {
        roundId: "r",
        today: TODAY,
        dishes,
        ratings: [
          { memberId: "ada", dishId: "a", value: 2 },
          // bo hates it, but bo never voted, so bo is not in the room.
          { memberId: "bo", dishId: "a", value: -2 },
        ],
        votes: [{ memberId: "ada", dishId: "a", choice: "yum" }],
        karma: [],
      },
      noJitter,
    );

    const a = result.ranked.find((dish) => dish.dishId === "a")!;
    expect(a.memberScores).toEqual([{ memberId: "ada", value: 4 }]);
    expect(a.min).toBe(4);
    expect(a.mean).toBe(4);
    expect(result.winnerDishId).toBe("a");
  });

  it("does not invent an opinion for a voter who skipped one dish", () => {
    const result = scoreRound(
      {
        roundId: "r",
        today: TODAY,
        dishes,
        ratings: [],
        votes: [
          { memberId: "ada", dishId: "a", choice: "yum" },
          { memberId: "bo", dishId: "a", choice: "meh" },
          // Only ada had anything to say about b.
          { memberId: "ada", dishId: "b", choice: "yum" },
        ],
        karma: [],
      },
      noJitter,
    );

    expect(result.ranked.find((dish) => dish.dishId === "b")!.memberScores).toHaveLength(1);
  });
});

describe("ties", () => {
  const tied: ScoreRoundInput = {
    roundId: "round-tie",
    today: TODAY,
    dishes: [
      { id: "older", lastCookedOn: "2026-09-01" },
      { id: "newer", lastCookedOn: "2026-09-02" },
    ],
    ratings: [],
    votes: [
      { memberId: "ada", dishId: "older", choice: "meh" },
      { memberId: "ada", dishId: "newer", choice: "meh" },
    ],
    karma: [],
  };

  it("breaks a dead heat towards whatever has waited longest", () => {
    const result = scoreRound(tied, noJitter);
    expect(result.ranked[0].score).toBe(result.ranked[1].score);
    expect(result.winnerDishId).toBe("older");
  });

  it("prefers the higher minimum before it looks at dates", () => {
    // Same mean, same recency; one dish has someone who can't stand it.
    const result = scoreRound(
      {
        ...tied,
        dishes: [
          { id: "even", lastCookedOn: "2026-09-01" },
          { id: "divisive", lastCookedOn: "2026-09-01" },
        ],
        ratings: [
          { memberId: "ada", dishId: "divisive", value: 2 },
          { memberId: "bo", dishId: "divisive", value: -2 },
          { memberId: "ada", dishId: "even", value: 0 },
          { memberId: "bo", dishId: "even", value: 0 },
        ],
        votes: [
          { memberId: "ada", dishId: "even", choice: "meh" },
          { memberId: "bo", dishId: "even", choice: "meh" },
          { memberId: "ada", dishId: "divisive", choice: "meh" },
          { memberId: "bo", dishId: "divisive", choice: "meh" },
        ],
      },
      noJitter,
    );

    expect(result.ranked[0].mean).toBe(result.ranked[1].mean);
    expect(result.winnerDishId).toBe("even");
  });

  it("is stable when two dishes are identical in every way", () => {
    const identical: ScoreRoundInput = {
      ...tied,
      dishes: [
        { id: "one", lastCookedOn: null },
        { id: "two", lastCookedOn: null },
      ],
      votes: [
        { memberId: "ada", dishId: "one", choice: "meh" },
        { memberId: "ada", dishId: "two", choice: "meh" },
      ],
    };

    const first = scoreRound(identical, noJitter).winnerDishId;
    expect(scoreRound(identical, noJitter).winnerDishId).toBe(first);
    expect(scoreRound(identical, noJitter).winnerDishId).toBe(first);
  });
});

describe("jitter", () => {
  it("stays inside ±0.15 and never re-rolls for the same round and dish", () => {
    const once = jitterFor("round-9", "rajma");
    expect(once).toBe(jitterFor("round-9", "rajma"));
    expect(Math.abs(once)).toBeLessThanOrEqual(0.15);
  });

  it("differs between dishes, so it can actually break a tie", () => {
    expect(jitterFor("round-9", "rajma")).not.toBe(jitterFor("round-9", "khichdi"));
  });

  it("cannot overturn a gap the formula considers real", () => {
    // The widest jitter swing is 0.3; anything further apart is settled.
    const spread = Math.abs(jitterFor("r", "a") - jitterFor("r", "b"));
    expect(spread).toBeLessThanOrEqual(0.3);
  });
});

describe("karma over time", () => {
  it("halves in about a week, which is the intended half-life", () => {
    expect(KARMA_DECAY_PER_DAY ** 7).toBeCloseTo(0.5, 2);
    expect(KARMA_DECAY_PER_DAY ** 14).toBeCloseTo(0.25, 2);
  });

  it("fades towards nothing and clamps at the edges", () => {
    const faded = decayed({ memberId: "ada", value: 2, lastDecayOn: daysAgo(7) }, TODAY);
    expect(faded.value).toBeCloseTo(2 * KARMA_DECAY_PER_DAY ** 7, 10);
    expect(faded.lastDecayOn).toBe(TODAY);

    const capped = karmaAfterRound({
      karma: [{ memberId: "ada", value: 2.8, lastDecayOn: TODAY }],
      votes: [{ memberId: "ada", dishId: "b", choice: "yum" }],
      winnerDishId: "a",
      today: TODAY,
    });
    expect(capped[0].value).toBe(3);
  });

  it("leaves people who did not vote alone", () => {
    const after = karmaAfterRound({
      karma: [{ memberId: "absent", value: 1.5, lastDecayOn: TODAY }],
      votes: [{ memberId: "ada", dishId: "a", choice: "yum" }],
      winnerDishId: "a",
      today: TODAY,
    });
    expect(after[0].value).toBe(1.5);
  });

  it("treats the least-bad option as the top choice of someone who liked nothing", () => {
    const votes: Vote[] = [
      { memberId: "kim", dishId: "a", choice: "meh" },
      { memberId: "kim", dishId: "b", choice: "yuck" },
    ];
    expect(topChoices(votes, "kim")).toEqual(new Set(["a"]));
  });
});

describe("sampling", () => {
  const plain = (id: string, overrides: Partial<SampleDish> = {}): SampleDish => ({
    id,
    lastCookedOn: null,
    baseline: 0,
    lifetimeVotes: 0,
    ...overrides,
  });

  it("draws six from eight on a household with no history at all", () => {
    const dishes = Array.from({ length: 8 }, (_, i) => plain(`d${i}`));
    const picked = sampleDishes({ roundId: "r", today: TODAY, dishes });

    expect(picked).toHaveLength(SAMPLE_SIZE);
    expect(new Set(picked.map((dish) => dish.dishId)).size).toBe(SAMPLE_SIZE);
    expect(picked.filter((dish) => dish.slot === "high_baseline")).toHaveLength(3);
    expect(picked.filter((dish) => dish.slot === "exploration")).toHaveLength(2);
    expect(picked.filter((dish) => dish.slot === "wildcard")).toHaveLength(1);
  });

  it("puts every dish up when the household has fewer than six", () => {
    const dishes = [plain("a"), plain("b"), plain("c"), plain("d")];
    const picked = sampleDishes({ roundId: "r", today: TODAY, dishes });

    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((dish) => dish.dishId)).size).toBe(4);
  });

  it("copes when the whole list was cooked yesterday", () => {
    const dishes = Array.from({ length: 7 }, (_, i) =>
      plain(`d${i}`, { lastCookedOn: daysAgo(1) }),
    );
    const picked = sampleDishes({ roundId: "r", today: TODAY, dishes });

    expect(picked).toHaveLength(SAMPLE_SIZE);
    expect(new Set(picked.map((dish) => dish.dishId)).size).toBe(SAMPLE_SIZE);
  });

  it("fills the liked slots with the best-rated things that have rested", () => {
    const dishes = [
      plain("adored-but-yesterday", { baseline: 2, lastCookedOn: daysAgo(1) }),
      plain("liked-and-rested-1", { baseline: 1.5 }),
      plain("liked-and-rested-2", { baseline: 1.4 }),
      plain("liked-and-rested-3", { baseline: 1.3 }),
      plain("dull-1", { baseline: -1 }),
      plain("dull-2", { baseline: -1 }),
      plain("dull-3", { baseline: -1 }),
    ];
    const picked = sampleDishes({ roundId: "r", today: TODAY, dishes });
    const liked = picked
      .filter((dish) => dish.slot === "high_baseline")
      .map((dish) => dish.dishId);

    expect(liked).toEqual([
      "liked-and-rested-1",
      "liked-and-rested-2",
      "liked-and-rested-3",
    ]);
  });

  it("spends the exploration slots on whatever nobody has voted on", () => {
    const dishes = [
      plain("famous-1", { baseline: 2, lifetimeVotes: 40 }),
      plain("famous-2", { baseline: 2, lifetimeVotes: 38 }),
      plain("famous-3", { baseline: 2, lifetimeVotes: 36 }),
      plain("famous-4", { baseline: 1, lifetimeVotes: 30 }),
      plain("unknown-1", { baseline: 0, lifetimeVotes: 0 }),
      plain("unknown-2", { baseline: 0, lifetimeVotes: 1 }),
    ];
    const picked = sampleDishes({ roundId: "r", today: TODAY, dishes });
    const explored = picked
      .filter((dish) => dish.slot === "exploration")
      .map((dish) => dish.dishId);

    expect(explored).toEqual(["unknown-1", "unknown-2"]);
  });

  it("draws the same six every time for one round, and not by array order", () => {
    const dishes = Array.from({ length: 9 }, (_, i) => plain(`d${i}`));
    const once = sampleDishes({ roundId: "round-abc", today: TODAY, dishes });
    const again = sampleDishes({ roundId: "round-abc", today: TODAY, dishes });
    const reversed = sampleDishes({
      roundId: "round-abc",
      today: TODAY,
      dishes: [...dishes].reverse(),
    });

    expect(again).toEqual(once);
    expect(new Set(reversed.map((dish) => dish.dishId))).toEqual(
      new Set(once.map((dish) => dish.dishId)),
    );
  });
});
