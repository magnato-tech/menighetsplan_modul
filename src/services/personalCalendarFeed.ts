import type { Person } from "../types";
import type { ActionResult } from "../context/FirebaseDataContext";
import { newId } from "../utils/id";

/** Ensures the person has a feed token and returns it. */
export function ensurePersonalCalendarFeedToken(
  person: Person,
  updatePerson: (personId: string, updates: Partial<Person>) => ActionResult
): { success: true; token: string } | { success: false; error: string } {
  if (person.calendarFeedToken) return { success: true, token: person.calendarFeedToken };
  const token = newId("kal");
  const result = updatePerson(person.id, { calendarFeedToken: token });
  if (!result.success) return { success: false, error: result.error || "Kunne ikke lagre kalenderlenken." };
  return { success: true, token };
}
