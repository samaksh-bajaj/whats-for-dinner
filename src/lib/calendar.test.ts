import { describe, expect, it } from "vitest";
import {
  karmaReading,
  monthBounds,
  monthGrid,
  monthLabel,
  relativeDay,
  shiftMonth,
} from "./calendar";

describe("month grids", () => {
  it("starts weeks on Monday and pads both ends", () => {
    // 1 September 2026 is a Tuesday: one leading blank.
    const grid = monthGrid("2026-09");
    expect(grid[0]).toEqual([
      null,
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
  });

  it("handles a month that starts on a Monday with no padding", () => {
    // 1 June 2026 is a Monday.
    expect(monthGrid("2026-06")[0][0]).toBe("2026-06-01");
  });

  it("gets February right in a leap year and out of one", () => {
    expect(monthGrid("2028-02").flat().filter(Boolean)).toHaveLength(29);
    expect(monthGrid("2026-02").flat().filter(Boolean)).toHaveLength(28);
    expect(monthBounds("2028-02").last).toBe("2028-02-29");
  });

  it("steps across year boundaries in both directions", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-09", -9)).toBe("2025-12");
  });

  it("labels a month without sliding a day", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLabel("2026-01")).toBe("January 2026");
  });
});

describe("plain language", () => {
  it("says how long ago a dish was cooked", () => {
    expect(relativeDay(null, "2026-09-20")).toBe("never");
    expect(relativeDay("2026-09-20", "2026-09-20")).toBe("tonight");
    expect(relativeDay("2026-09-19", "2026-09-20")).toBe("yesterday");
    expect(relativeDay("2026-09-17", "2026-09-20")).toBe("3 days ago");
    expect(relativeDay("2026-09-13", "2026-09-20")).toBe("last week");
    expect(relativeDay("2026-07-01", "2026-09-20")).toBe("over a month ago");
  });

  it("reads karma as a sentence rather than a number", () => {
    expect(karmaReading(2.4)).toBe("owed a win");
    expect(karmaReading(0.8)).toBe("due something");
    expect(karmaReading(0)).toBe("square");
    expect(karmaReading(-0.75)).toBe("got their way lately");
    expect(karmaReading(-2)).toBe("on a good run");
  });
});
