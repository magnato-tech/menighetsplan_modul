import { beforeEach, describe, expect, test, vi } from "vitest";

const { writes, commits } = vi.hoisted(() => ({
  writes: [] as { ref: { name: string; id: string }; data: Record<string, unknown> }[],
  commits: { count: 0 },
}));
const DELETE_FIELD = Symbol("deleteField");

vi.mock("../src/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  doc: (_db: unknown, name: string, id: string) => ({ name, id }),
  query: (source: unknown) => source,
  where: () => ({}),
  onSnapshot: () => () => undefined,
  deleteField: () => DELETE_FIELD,
  writeBatch: () => ({
    update: (ref: { name: string; id: string }, data: Record<string, unknown>) => writes.push({ ref, data }),
    set: () => undefined,
    delete: () => undefined,
    commit: async () => {
      commits.count += 1;
    },
  }),
}));

import { moveRoleTasksToTeam } from "../src/services/volunteerRoles";
import { COLLECTIONS } from "../src/data/collections";

beforeEach(() => {
  writes.length = 0;
  commits.count = 0;
});

describe("Oppgavene til en rolle følger rollens team", () => {
  test("satt team skrives på hver oppgave", async () => {
    await moveRoleTasksToTeam("group-taler", ["t1", "t2"]);
    expect(writes).toEqual([
      { ref: { name: COLLECTIONS.TASKS, id: "t1" }, data: { groupId: "group-taler" } },
      { ref: { name: COLLECTIONS.TASKS, id: "t2" }, data: { groupId: "group-taler" } },
    ]);
    expect(commits.count).toBe(1);
  });

  test("uten team fjernes teamfeltet fra oppgavene", async () => {
    await moveRoleTasksToTeam(undefined, ["t1"]);
    expect(writes).toEqual([{ ref: { name: COLLECTIONS.TASKS, id: "t1" }, data: { groupId: DELETE_FIELD } }]);
  });

  test("mange oppgaver skrives i flere batcher, med høyst 400 i hver", async () => {
    const ids = Array.from({ length: 401 }, (_, index) => `t${index}`);
    await moveRoleTasksToTeam("group-taler", ids);
    expect(writes).toHaveLength(401);
    expect(commits.count).toBe(2);
  });

  test("uten oppgaver skrives ingenting", async () => {
    await moveRoleTasksToTeam("group-taler", []);
    expect(writes).toEqual([]);
    expect(commits.count).toBe(0);
  });
});
