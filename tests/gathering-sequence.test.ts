import { describe, expect, test } from "vitest";
import type { Gathering } from "../src/types";
import { gatheringSequence, nearbySequence, neighbours, type SequenceItem } from "../src/utils/gatheringSequence";

// The arrows on the gathering page: which gatherings they step through, and where the current one stands.

const item = (id: string, startsAt: string, fields: Partial<Gathering> = {}, category?: string): SequenceItem => ({
  gathering: { id, groupId: "g-kor", title: id, startsAt, visibility: "offentlig", ...fields } as Gathering,
  group: category ? ({ category } as SequenceItem["group"]) : undefined,
});
const ids = (list: SequenceItem[]) => list.map((i) => i.gathering.id);

describe("gatheringSequence", () => {
  test("en serie vinner: alle med samme seriesId, uansett gruppe og type", () => {
    const a = item("s1", "2026-11-01T11:00:00", { seriesId: "serie", isGudstjeneste: false, groupId: "g-a" });
    const b = item("s2", "2026-11-08T11:00:00", { seriesId: "serie", groupId: "g-b" }, "husgruppe");
    const c = item("x", "2026-11-15T11:00:00", { groupId: "g-a" });
    const d = item("gud", "2026-11-22T11:00:00", { seriesId: "serie", isGudstjeneste: true, groupId: "g-c" });
    expect(ids(gatheringSequence(a, [d, c, b, a]))).toEqual(["s1", "s2", "gud"]);
  });

  test("gudstjenester går på tvers av grupper, og ordnes etter start", () => {
    const g1 = item("gud-2", "2026-11-15T11:00:00", { isGudstjeneste: true, groupId: "g-x" }, "tjenestegruppe");
    const g2 = item("gud-1", "2026-11-08T11:00:00", { isGudstjeneste: true, groupId: "g-y" });
    const cur = item("gud-3", "2026-11-22T11:00:00", { isGudstjeneste: true, groupId: "g-z" }, "husgruppe");
    const andre = item("bonn", "2026-11-12T19:00:00", { groupId: "g-z" }, "husgruppe");
    expect(ids(gatheringSequence(cur, [cur, g1, andre, g2]))).toEqual(["gud-1", "gud-2", "gud-3"]);
  });

  test("andre samlinger: samme type og samme gruppe, og ingen annen", () => {
    const cur = item("m2", "2026-11-08T19:00:00", { groupId: "g-kor" }, "husgruppe");
    const m1 = item("m1", "2026-11-01T19:00:00", { groupId: "g-kor" }, "husgruppe");
    const m3 = item("m3", "2026-11-15T19:00:00", { groupId: "g-kor" }, "husgruppe");
    const annenGruppe = item("m4", "2026-11-09T19:00:00", { groupId: "g-annen" }, "husgruppe");
    const annenType = item("m5", "2026-11-10T19:00:00", { groupId: "g-kor" }, "tjenestegruppe");
    expect(ids(gatheringSequence(cur, [m3, annenGruppe, annenType, cur, m1]))).toEqual(["m1", "m2", "m3"]);
  });

  test("avlyste samlinger er med", () => {
    const cur = item("a", "2026-11-01T19:00:00", { groupId: "g" });
    const avlyst = item("b", "2026-11-08T19:00:00", { groupId: "g", cancelled: true });
    expect(ids(gatheringSequence(cur, [cur, avlyst]))).toEqual(["a", "b"]);
  });

  test("den gjeldende samlingen legges til når den ikke står i listen", () => {
    const cur = item("a", "2026-11-01T19:00:00", { groupId: "g" });
    expect(ids(gatheringSequence(cur, []))).toEqual(["a"]);
  });
});

describe("neighbours", () => {
  const seq = ["a", "b", "c"].map((id, i) => item(id, `2026-11-0${i + 1}T11:00:00`));

  test("midten har to naboer", () => {
    const n = neighbours(seq, "b");
    expect(n.previous?.gathering.id).toBe("a");
    expect(n.next?.gathering.id).toBe("c");
    expect([n.index, n.total]).toEqual([1, 3]);
  });

  test("første og siste har ingen nabo i den retningen", () => {
    expect(neighbours(seq, "a").previous).toBeUndefined();
    expect(neighbours(seq, "a").next?.gathering.id).toBe("b");
    expect(neighbours(seq, "c").next).toBeUndefined();
    expect(neighbours(seq, "c").previous?.gathering.id).toBe("b");
  });

  test("en samling som ikke står i listen har ingen naboer", () => {
    const n = neighbours(seq, "finnes-ikke");
    expect(n.previous).toBeUndefined();
    expect(n.next).toBeUndefined();
    expect(n.index).toBe(-1);
  });
});

describe("nearbySequence", () => {
  const long = Array.from({ length: 30 }, (_, i) => item(`n${i}`, `2026-11-${String(i + 1).padStart(2, "0")}T11:00:00`));

  test("tre før og ti etter, med den gjeldende midt i", () => {
    const list = nearbySequence(long, "n10");
    expect(ids(list)).toEqual(["n7", "n8", "n9", "n10", "n11", "n12", "n13", "n14", "n15", "n16", "n17", "n18", "n19", "n20"]);
  });

  test("ved starten og slutten blir det kortere", () => {
    expect(ids(nearbySequence(long, "n1"))[0]).toBe("n0");
    expect(ids(nearbySequence(long, "n29"))).toHaveLength(4);
  });
});
