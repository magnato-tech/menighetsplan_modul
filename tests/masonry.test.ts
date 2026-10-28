import { describe, expect, test } from "vitest";
import { columnCountFor, masonryColumns } from "../src/utils/masonry";
import { estimatedTeamHeight, type RosterRow } from "../src/utils/staffingRoster";

// The team cards in columns with no gaps: how many columns a width holds, and where each card goes.

describe("columnCountFor", () => {
  test("så mange som får plass på 20 rem med 16 px mellom, minst én", () => {
    expect(columnCountFor(0)).toBe(1);
    expect(columnCountFor(320)).toBe(1);
    expect(columnCountFor(655)).toBe(1);
    expect(columnCountFor(656)).toBe(2);
    expect(columnCountFor(992)).toBe(3);
    expect(columnCountFor(991)).toBe(2);
  });
});

describe("masonryColumns", () => {
  test("første rad står fra venstre i rekkefølgen", () => {
    expect(masonryColumns([5, 1, 9], 3)).toEqual([[0], [1], [2]]);
  });

  test("neste kort går i den korteste kolonnen", () => {
    // 0 → col 0 (5), 1 → col 1 (1), 2 → col 1 (1+2=3), 3 → col 1 (3+2=5), tie with col 0: leftmost (col 0)
    expect(masonryColumns([5, 1, 2, 2, 4], 2)).toEqual([[0, 4], [1, 2, 3]]);
  });

  test("ved likhet går kortet til venstre", () => {
    expect(masonryColumns([3, 3, 3, 3], 2)).toEqual([[0, 2], [1, 3]]);
    expect(masonryColumns([1, 1], 3)).toEqual([[0], [1], []]);
  });

  test("én kolonne gir alle kortene i rekkefølge", () => {
    expect(masonryColumns([4, 1, 7], 1)).toEqual([[0, 1, 2]]);
  });

  test("ingen kort gir tomme kolonner, og under én kolonne blir én", () => {
    expect(masonryColumns([], 2)).toEqual([[], []]);
    expect(masonryColumns([2, 2], 0)).toEqual([[0, 1]]);
  });
});

describe("estimatedTeamHeight", () => {
  const row = (fields: Partial<RosterRow>): RosterRow =>
    ({ state: "dekket", free: 0, people: [], ...fields }) as unknown as RosterRow;

  test("et foldet kort er bare headeren", () => {
    expect(estimatedTeamHeight([row({ free: 3 })], false)).toBe(1);
  });

  test("et åpent kort: header, et bånd per rolle, en linje per person og per ledig plass, og «sa nei»", () => {
    const people = [
      { response: "confirmed" },
      { response: "pending" },
      { response: "declined" },
    ] as unknown as RosterRow["people"];
    // header 1 + role A (band 1 + 2 people + 1 free + «sa nei» 1 = 5) + role B (band 1, cancelled, no slots = 1)
    expect(estimatedTeamHeight([row({ people, free: 1 }), row({ state: "avlyst", free: 4 })], true)).toBe(7);
  });
});
