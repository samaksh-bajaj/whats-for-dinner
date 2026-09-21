import { describe, expect, it } from "vitest";
import { TASTE_DECAY_PER_DAY, TASTE_SHRINKAGE } from "./config";
import { learnTaste, observationWeight, type TasteObservation } from "./taste";

const TODAY = "2026-09-20";

function daysAgo(days: number) {
  return new Date(Date.UTC(2026, 8, 20) - days * 86_400_000).toISOString().slice(0, 10);
}

/** `count` identical votes, all cast today, so no decay muddies the sum. */
function repeated(choice: TasteObservation["choice"], count: number): TasteObservation[] {
  return Array.from({ length: count }, () => ({
    memberId: "ada",
    dishId: "rajma",
    choice,
    on: TODAY,
  }));
}

const only = (history: TasteObservation[]) => learnTaste(history, TODAY)[0];

describe("learning a taste from votes", () => {
  it("says nothing at all about a dish nobody has voted on", () => {
    // Not zero-in-a-row: absent. NO_TASTE is what the scorer reads instead,
    // so a member who joined tonight is neither helped nor punished.
    expect(learnTaste([], TODAY)).toEqual([]);
  });

  it("treats one yum as a hint, not a verdict", () => {
    // 2/(1+2) — a single evening cannot claim someone loves a dish.
    expect(only(repeated("yum", 1)).value).toBeCloseTo(2 / 3, 10);
  });

  it("climbs with agreement and never reaches the full +2", () => {
    const three = only(repeated("yum", 3)).value;
    const ten = only(repeated("yum", 10)).value;
    const hundred = only(repeated("yum", 100)).value;

    expect(three).toBeCloseTo(6 / 5, 10);
    expect(ten).toBeCloseTo(20 / 12, 10);
    expect(three).toBeLessThan(ten);
    expect(ten).toBeLessThan(hundred);
    expect(hundred).toBeLessThan(2);
  });

  it("is symmetric downwards", () => {
    expect(only(repeated("yuck", 1)).value).toBeCloseTo(-2 / 3, 10);
    expect(only(repeated("yuck", 10)).value).toBeCloseTo(-20 / 12, 10);
  });

  it("counts a meh as evidence of indifference, not as no evidence", () => {
    const mehs = only(repeated("meh", 4));
    expect(mehs.value).toBe(0);
    // The value matches an absent taste, but the weight does not: four
    // shrugs are something known, and the dots say so.
    expect(mehs.weight).toBe(4);
  });

  it("lets one yuck pull a run of yums down", () => {
    const mixed = only([...repeated("yum", 2), ...repeated("yuck", 1)]);
    expect(mixed.value).toBeCloseTo((2 + 2 - 2) / (3 + TASTE_SHRINKAGE), 10);
    expect(mixed.value).toBeLessThan(only(repeated("yum", 2)).value);
  });

  it("halves the weight of an opinion after ten weeks", () => {
    expect(observationWeight(TODAY, TODAY)).toBe(1);
    expect(observationWeight(daysAgo(69), TODAY)).toBeCloseTo(0.5, 2);
    expect(observationWeight(daysAgo(69), TODAY)).toBeCloseTo(
      TASTE_DECAY_PER_DAY ** 69,
      10,
    );
  });

  it("lets a recent change of heart outweigh an old habit", () => {
    const value = only([
      { memberId: "ada", dishId: "rajma", choice: "yum", on: daysAgo(400) },
      { memberId: "ada", dishId: "rajma", choice: "yuck", on: TODAY },
    ]).value;

    // The year-old yum has decayed to almost nothing; today's yuck decides it.
    expect(value).toBeLessThan(-0.5);
  });

  it("does not let a clock-skewed future round count for more than today", () => {
    expect(observationWeight("2027-01-01", TODAY)).toBe(1);
  });

  it("counts calendar days, so an evening in Kolkata is one evening", () => {
    // The whole reason dates are YYYY-MM-DD strings and never Date objects.
    expect(observationWeight("2026-09-19", "2026-09-20")).toBeCloseTo(
      TASTE_DECAY_PER_DAY,
      10,
    );
  });

  it("keeps members and dishes apart", () => {
    const learned = learnTaste(
      [
        { memberId: "ada", dishId: "rajma", choice: "yum", on: TODAY },
        { memberId: "bo", dishId: "rajma", choice: "yuck", on: TODAY },
        { memberId: "ada", dishId: "pasta", choice: "meh", on: TODAY },
      ],
      TODAY,
    );

    expect(learned).toHaveLength(3);
    const find = (memberId: string, dishId: string) =>
      learned.find((t) => t.memberId === memberId && t.dishId === dishId)!.value;
    expect(find("ada", "rajma")).toBeCloseTo(2 / 3, 10);
    expect(find("bo", "rajma")).toBeCloseTo(-2 / 3, 10);
    expect(find("ada", "pasta")).toBe(0);
  });

  it("does not care what order the history arrives in", () => {
    const history: TasteObservation[] = [
      { memberId: "ada", dishId: "rajma", choice: "yum", on: daysAgo(30) },
      { memberId: "ada", dishId: "rajma", choice: "yuck", on: daysAgo(2) },
      { memberId: "ada", dishId: "rajma", choice: "meh", on: daysAgo(9) },
    ];

    expect(learnTaste(history, TODAY)).toEqual(learnTaste([...history].reverse(), TODAY));
  });
});
