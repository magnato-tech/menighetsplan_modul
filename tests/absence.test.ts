import { describe, expect, test } from "vitest";
import { absenceFields, idsWithWithdrawalReason } from "../src/utils/staffing";

describe("Forfall", () => {
  test("lagrer bare svaret", () => {
    expect(absenceFields("confirmed", "2026-10-12T12:00:00.000Z")).toEqual({
      response: "withdrawn",
      respondedAt: "2026-10-12T12:00:00.000Z",
    });
    expect(absenceFields("pending", "2026-10-12T12:00:00.000Z").response).toBe("declined");
  });

  test("finner tildelinger som fortsatt har en grunn fra før", () => {
    expect(idsWithWithdrawalReason([
      { id: "b", withdrawalReason: "Syk" },
      { id: "a" },
      { id: "c", withdrawalReason: "" },
    ])).toEqual(["b", "c"]);
  });
});