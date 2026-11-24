// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest";
import type { Group, Person } from "../src/types";
import { audienceChip, listChip, recipientSuggestions, resolveChips, selectionChip } from "../src/pages/admin/tabs/email/chips";
import {
  EPOST_HANDOVER_KEY,
  LISTS_NOT_PUBLISHED,
  isPermissionDenied,
  listFailureText,
  listNameError,
  listPersonIds,
  takeEmailHandover,
  writeEmailHandover,
  type EmailList,
} from "../src/utils/emailLists";

// E-mail lists from the Personer tab, and what they reach in «Send e-post». Everyone here is made up.

const person = (id: string, name: string, email?: string): Person => ({ id, name, email, globalRole: "member" });
const group = (id: string, name: string, category: Group["category"], leaderIds: string[], memberIds: string[]): Group => ({ id, name, category, leaderIds, memberIds });

const persons: Person[] = [
  person("hanne", "Hanne Husleder", "hanne@example.org"),
  person("hans", "Hans Husmedlem", "hans@example.org"),
  person("lars", "Lars Leder", "lars@example.org"),
  person("frida", "Frida Frivillig", "frida@example.org"),
];
const groups: Group[] = [group("hus", "Husgruppe øst", "husgruppe", ["hanne"], ["hanne", "hans"]), group("lyd", "Lyd og bilde", "tjenestegruppe", ["lars"], ["lars", "frida"])];

const meta = { createdAt: "2026-11-24T10:00:00.000Z", updatedAt: "2026-11-24T10:00:00.000Z", createdBy: "kari" };
const husgrupper: EmailList = { id: "liste-1", name: "Husgrupper", kind: "filter", filter: { roles: ["leader"], categories: ["husgruppe"] }, ...meta };
const styret: EmailList = { id: "liste-2", name: "Styret", kind: "fixed", personIds: ["lars", "slettet-person", "hanne", "lars"], ...meta };

describe("Hvem en liste når", () => {
  test("en filterliste er de som passer filteret i dag, og en ny som passer, kommer med", () => {
    expect(listPersonIds(husgrupper, persons, groups)).toEqual(["hanne"]);
    const withNew = [...persons, person("ny", "Ny Husleder")];
    const grown = [{ ...groups[0], leaderIds: ["hanne", "ny"] }, groups[1]];
    expect(listPersonIds(husgrupper, withNew, grown)).toEqual(["hanne", "ny"]);
  });

  test("en fast liste er personene den ble laget med, uten dobbelt, og den som er slettet fra registeret, faller bort", () => {
    expect(listPersonIds(styret, persons, groups)).toEqual(["lars", "hanne"]);
  });

  test("en filterliste uten filter når ingen", () => {
    expect(listPersonIds({ kind: "filter" }, persons, groups)).toEqual([]);
  });
});

describe("Navnet på en liste", () => {
  test("må finnes, og er unikt uten store og små bokstaver", () => {
    expect(listNameError("  ", [husgrupper])).toBe("Listen må ha et navn.");
    expect(listNameError("husgrupper", [husgrupper])).toBe("Det finnes allerede en liste med dette navnet.");
    expect(listNameError("Lederne", [husgrupper])).toBeNull();
    // A list keeps its own name when it is renamed to the same
    expect(listNameError("Husgrupper", [husgrupper], husgrupper.id)).toBeNull();
  });

  test("et avslag fra databasen sies med den rolige meldingen, og andre feil med en kort melding", () => {
    expect(isPermissionDenied({ code: "permission-denied" })).toBe(true);
    expect(isPermissionDenied(new Error("nettet svarte ikke"))).toBe(false);
    expect(listFailureText({ code: "permission-denied" }, "lagre listen")).toBe(LISTS_NOT_PUBLISHED);
    expect(listFailureText(new Error("ukjent"), "lagre listen")).toBe("Det gikk ikke å lagre listen. Prøv igjen.");
  });
});

describe("Overføringen fra Personer til Send e-post", () => {
  beforeEach(() => window.sessionStorage.clear());

  test("det som er skrevet, leses én gang, og er borte etterpå", () => {
    expect(writeEmailHandover({ personIds: ["hanne", "lars"], label: "Utvalg: Leder · Husgruppe" })).toBe(true);
    expect(window.sessionStorage.getItem(EPOST_HANDOVER_KEY)).not.toBeNull();
    expect(takeEmailHandover()).toEqual({ personIds: ["hanne", "lars"], label: "Utvalg: Leder · Husgruppe" });
    expect(window.sessionStorage.getItem(EPOST_HANDOVER_KEY)).toBeNull();
    expect(takeEmailHandover()).toBeNull();
  });

  test("det som ikke er riktig, gir ingenting", () => {
    window.sessionStorage.setItem(EPOST_HANDOVER_KEY, "ikke json");
    expect(takeEmailHandover()).toBeNull();
    window.sessionStorage.setItem(EPOST_HANDOVER_KEY, JSON.stringify({ personIds: "hanne", label: "Utvalg" }));
    expect(takeEmailHandover()).toBeNull();
    window.sessionStorage.setItem(EPOST_HANDOVER_KEY, JSON.stringify({ personIds: ["hanne"], label: "  " }));
    expect(takeEmailHandover()).toBeNull();
  });
});

describe("Listene og utvalget i «Til»", () => {
  test("én liste sendes til dem på listen, og listen gir navnet i loggen", () => {
    expect(resolveChips([listChip(husgrupper)], persons, groups, [husgrupper])).toEqual({ audience: { kind: "persons" }, onlyPersonIds: ["hanne"], label: "Husgrupper" });
  });

  test("et utvalg sendes til de nevnte, og får sitt navn", () => {
    const selection = selectionChip({ personIds: ["frida", "hans"], label: "Utvalg: Leder · Husgruppe" });
    expect(resolveChips([selection], persons, groups)).toEqual({ audience: { kind: "persons" }, onlyPersonIds: ["frida", "hans"], label: "Utvalg: Leder · Husgruppe" });
  });

  test("flere valg sendes til hver person én gang, med navnene satt sammen", () => {
    const mixed = resolveChips([listChip(husgrupper), listChip(styret), selectionChip({ personIds: ["hanne", "frida"], label: "Utvalg fra Personer" })], persons, groups, [husgrupper, styret]);
    expect([...(mixed?.onlyPersonIds ?? [])].sort()).toEqual(["frida", "hanne", "lars"]);
    expect(mixed?.label).toBe("Husgrupper, Styret, Utvalg fra Personer");
    expect(mixed?.audience).toEqual({ kind: "persons" });
  });

  test("en liste som ikke finnes lenger, når ingen", () => {
    expect(resolveChips([listChip({ id: "borte", name: "Borte" })], persons, groups, [husgrupper])?.onlyPersonIds).toEqual([]);
  });

  test("en gruppe eller en fast valgmulighet sendes som før", () => {
    expect(resolveChips([audienceChip({ kind: "leaders" }, groups)], persons, groups, [husgrupper])).toEqual({ audience: { kind: "leaders" }, label: "Ledere og nestledere i tjenestegruppene" });
  });

  test("forslagene tilbyr listene etter de faste valgene og før gruppene, med antallet", () => {
    // The persons whose names have «hus» in them come after the groups
    const found = recipientSuggestions("hus", persons, groups, [], [husgrupper, styret]);
    expect(found.slice(0, 2).map((suggestion) => [suggestion.chip.kind, suggestion.chip.label, suggestion.detail])).toEqual([
      ["list", "Husgrupper", "1 person"],
      ["audience", "Husgruppe øst", "2 personer"],
    ]);
    expect(found.slice(2).every((suggestion) => suggestion.chip.kind === "person")).toBe(true);
    // A list already chosen is not suggested again
    expect(recipientSuggestions("hus", persons, groups, [listChip(husgrupper)], [husgrupper]).some((suggestion) => suggestion.chip.kind === "list")).toBe(false);
  });
});
