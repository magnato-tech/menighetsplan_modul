import { describe, expect, test } from "vitest";
import { tallyAnswers } from "../src/utils/staffing";

describe("Hva de spurte har svart, slik en gruppeleder leser det", () => {
  test("teller hvem som har sagt ja, hvem som venter, og hvem som ikke kan", () => {
    const answers = [{ response: "confirmed" }, { response: "confirmed" }, { response: "pending" }, { response: "declined" }, { response: "withdrawn" }] as const;
    expect(tallyAnswers(answers)).toEqual({ confirmed: 2, pending: 1, declined: 2 });
  });

  test("uten noen spurte er alt null", () => {
    expect(tallyAnswers([])).toEqual({ confirmed: 0, pending: 0, declined: 0 });
  });
});
