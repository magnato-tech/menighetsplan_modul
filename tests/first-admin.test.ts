import { describe, expect, test } from "vitest";
import type { Person } from "../src/types";
import { planFirstAdmin } from "../src/utils/firstAdmin";

const kari: Person = { id: "kari", name: "Kari Nordmann", email: "kari@menigheten.no", globalRole: "admin" };
const ola: Person = { id: "ola", name: "Ola Hansen", email: "Ola@Eksempel.no", globalRole: "member" };
const anne: Person = { id: "anne", name: "Anne Berg", email: "familien@berg.no", globalRole: "member" };
const jon: Person = { id: "jon", name: "Jon Berg", email: "familien@berg.no", globalRole: "member" };

describe("Den første administratoren legges inn utenfra, én gang", () => {
  test("står ingen i registeret med adressen, legges personen inn som administrator", () => {
    const plan = planFirstAdmin(" Pastor@Sentrumskirken.no ", " Per Prest ", []);

    expect(plan.action).toBe("create");
    if (plan.action !== "create") return;
    expect(plan.person).toMatchObject({ name: "Per Prest", email: "pastor@sentrumskirken.no", globalRole: "admin" });
    expect(plan.person.id).toMatch(/^person-/);
  });

  test("står personen der som medlem, blir den administrator, og ingen ny person lages", () => {
    expect(planFirstAdmin("ola@eksempel.no", "", [kari, ola])).toEqual({ action: "promote", person: ola });
  });

  test("er personen administrator fra før, skrives ingenting", () => {
    expect(planFirstAdmin("KARI@menigheten.no", "Et annet navn", [kari, ola])).toEqual({ action: "none", person: kari });
  });

  test("en adresse flere personer deler, kan ikke brukes til å logge inn, og avvises med navnene", () => {
    const plan = planFirstAdmin("familien@berg.no", "", [anne, jon]);
    expect(plan).toMatchObject({ action: "refuse" });
    expect(plan.action === "refuse" && plan.reason).toContain("Anne Berg, Jon Berg");
  });

  test("noe som ikke er en e-postadresse, og en ny person uten navn, avvises", () => {
    for (const notAnAddress of ["", "kari", "kari@", "kari @menigheten.no", "@menigheten.no"]) {
      expect(planFirstAdmin(notAnAddress, "Kari", [])).toEqual({ action: "refuse", reason: "E-postadressen ser ikke riktig ut." });
    }
    expect(planFirstAdmin("ny@menigheten.no", "  ", [kari])).toMatchObject({ action: "refuse" });
  });
});
