import { describe, expect, test } from "vitest";
import { ATTENDANCE_QUESTION_DAYS, asksAttendanceYet } from "../src/utils/meetingPlan";

// Whether a group asks its participants about a meeting yet: never, or a number of days before
const now = Date.parse("2026-11-24T12:00:00Z");
const inDays = (days: number) => new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

describe("Spør om oppmøte", () => {
  test("uten valg spørres det sju dager før", () => {
    expect(ATTENDANCE_QUESTION_DAYS).toBe(7);
    expect(asksAttendanceYet({}, inDays(6), now)).toBe(true);
    expect(asksAttendanceYet({}, inDays(7), now)).toBe(true);
    expect(asksAttendanceYet({}, inDays(8), now)).toBe(false);
  });

  test("en gruppe som har valgt nei, spør aldri", () => {
    expect(asksAttendanceYet({ attendanceQuestion: "off" }, inDays(1), now)).toBe(false);
  });

  test("en gruppe som har valgt to dager, spør først to dager før", () => {
    expect(asksAttendanceYet({ attendanceQuestion: 2 }, inDays(3), now)).toBe(false);
    expect(asksAttendanceYet({ attendanceQuestion: 2 }, inDays(2), now)).toBe(true);
  });

  test("et møte uten gyldig tid spørres det ikke om", () => {
    expect(asksAttendanceYet({}, "tull", now)).toBe(false);
  });
});
