import { describe } from "vitest";
import { assert } from "./assert";
import { isAdminStudioPath, parseAdminDetailRoute } from "../src/utils/adminStudioRoutes";
import { isMinSidePath } from "../src/utils/routes";

describe("Admin Studio-ruter", () => {
  assert(isAdminStudioPath("/admin"), "Roten /admin er studio");
  assert(isAdminStudioPath("/admin/person/p1"), "Personkort er studio");
  assert(!isAdminStudioPath("/minside"), "Min side er ikke studio");
  assert(!isAdminStudioPath("/leder"), "Gruppeleder er ikke studio");

  const person = parseAdminDetailRoute("/admin/person/person-1");
  assert(person?.kind === "person" && person.id === "person-1", "Parser personkort");
  assert(person?.backTab === "planlegger-personer", "Personkort går tilbake til personer");

  const group = parseAdminDetailRoute("/admin/gruppe/g1");
  assert(group?.kind === "group" && group.backTab === "planlegger-grupper", "Parser gruppekort");

  const gathering = parseAdminDetailRoute("/admin/samling/evt-1");
  assert(gathering?.kind === "gathering" && gathering.backTab === "planlegger-samlinger", "Parser kjøreplan");

  const task = parseAdminDetailRoute("/admin/oppgave/t1");
  assert(task?.kind === "task" && task.backTab === "planlegger-oppgaver", "Parser oppgavekort");

  const membership = parseAdminDetailRoute("/admin/medlemskap/app-1");
  assert(
    membership?.kind === "membershipApplication" && membership.backTab === "planlegger-medlemskap",
    "Parser arkiv for medlemskapssøknad"
  );

  assert(parseAdminDetailRoute("/admin?tab=planlegger-personer") === null, "Faner er ikke detaljkort");
});

describe("Min side-ruter", () => {
  assert(!isMinSidePath("/admin/person/p1"), "Admin-kort er ikke Min side");
  assert(!isMinSidePath("/admin"), "Admin Studio er ikke Min side");
  assert(isMinSidePath("/minside"), "Min side er Min side");
});
