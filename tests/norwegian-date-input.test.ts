import { describe, expect, test } from "vitest";
import { clockToNorwegian, dayToNorwegian, norwegianToClock, norwegianToDay } from "../src/utils/norwegianDateInput";

// The form's date and time fields show Norwegian text, whatever language the browser is in, and
// the form keeps ISO days and "HH:MM".

describe("Dato i norsk format", () => {
  test("ISO-dag vises som dd.mm.åååå", () => {
    expect(dayToNorwegian("2027-01-10")).toBe("10.01.2027");
    expect(dayToNorwegian("")).toBe("");
  });

  test("norsk tekst leses som ISO-dag", () => {
    expect(norwegianToDay("10.01.2027")).toBe("2027-01-10");
    expect(norwegianToDay("10.1.2027")).toBe("2027-01-10");
    expect(norwegianToDay("1.1.2027")).toBe("2027-01-01");
    expect(norwegianToDay("10/01/2027")).toBe("2027-01-10");
    expect(norwegianToDay("10-01-2027")).toBe("2027-01-10");
    expect(norwegianToDay("  10.01.2027  ")).toBe("2027-01-10");
    expect(norwegianToDay("29.02.2028")).toBe("2028-02-29");
  });

  test("ugyldige datoer og ufullstendig tekst gir tom verdi", () => {
    expect(norwegianToDay("31.02.2027")).toBe("");
    expect(norwegianToDay("29.02.2027")).toBe("");
    expect(norwegianToDay("00.01.2027")).toBe("");
    expect(norwegianToDay("10.13.2027")).toBe("");
    expect(norwegianToDay("")).toBe("");
    expect(norwegianToDay("abc")).toBe("");
    expect(norwegianToDay("10.01.27")).toBe("");
    expect(norwegianToDay("10.01.")).toBe("");
    expect(norwegianToDay("10.01.2027.")).toBe("");
    expect(norwegianToDay("10.01/2027")).toBe("");
  });
});

describe("Klokkeslett i 24-timers format", () => {
  test("gyldig tt:mm vises som den er", () => {
    expect(clockToNorwegian("21:00")).toBe("21:00");
    expect(clockToNorwegian("09:30")).toBe("09:30");
    expect(clockToNorwegian("")).toBe("");
    expect(clockToNorwegian("9:00")).toBe("");
    expect(clockToNorwegian("24:00")).toBe("");
  });

  test("klokkeslett skrives på flere måter og blir tt:mm", () => {
    expect(norwegianToClock("21:00")).toBe("21:00");
    expect(norwegianToClock("21.00")).toBe("21:00");
    expect(norwegianToClock("9:00")).toBe("09:00");
    expect(norwegianToClock("0900")).toBe("09:00");
    expect(norwegianToClock("2100")).toBe("21:00");
    expect(norwegianToClock("21")).toBe("21:00");
    expect(norwegianToClock("9")).toBe("09:00");
    expect(norwegianToClock(" 21:30 ")).toBe("21:30");
    expect(norwegianToClock("00:00")).toBe("00:00");
    expect(norwegianToClock("23:59")).toBe("23:59");
  });

  test("ugyldige klokkeslett gir tom verdi", () => {
    expect(norwegianToClock("24:00")).toBe("");
    expect(norwegianToClock("2400")).toBe("");
    expect(norwegianToClock("21:60")).toBe("");
    expect(norwegianToClock("12:5")).toBe("");
    expect(norwegianToClock("")).toBe("");
    expect(norwegianToClock("abc")).toBe("");
    expect(norwegianToClock("9999")).toBe("");
  });
});
