import { describe } from "vitest";
import { assert } from "./assert";
import {
  membershipLogEntryLabel,
  membershipLogWithStatus,
  newClerkMembershipLogEntry,
  newMembershipLogEntry,
} from "../src/utils/membershipLog";
import { membershipApplicationAdminPath } from "../src/services/membershipApplications";
import { parseAdminDetailRoute } from "../src/utils/adminStudioRoutes";

describe("Medlemskapslogg på person", () => {
  const app = {
    id: "app-1",
    kind: "congregationApply" as const,
    submittedAt: "2026-11-01T10:00:00.000Z",
    status: "submitted" as const,
  };

  assert(newMembershipLogEntry(app).applicationId === "app-1", "Nye loggposter peker på søknaden");
  assert(newMembershipLogEntry(app).status === "submitted", "Starter med innsendt status");

  const afterReceive = membershipLogWithStatus(undefined, app, "received", "2026-11-02T10:00:00.000Z");
  assert(afterReceive.length === 1 && afterReceive[0].status === "received", "Oppdaterer status på eksisterende post");

  const appended = membershipLogWithStatus(afterReceive, { ...app, id: "app-2" }, "submitted", "2026-11-03T10:00:00.000Z");
  assert(appended.length === 2, "Flere søknader gir flere loggposter");
});

describe("Loggetiketter", () => {
  assert(membershipLogEntryLabel("withdrawal").includes("Utmelding"), "Utmelding i logg");
  assert(
    newClerkMembershipLogEntry({ kind: "withdrawal", submittedAt: "2026-01-01", status: "completed" }).status === "completed",
    "Clerk default status"
  );
});

describe("Arkivadresse i admin", () => {
  assert(membershipApplicationAdminPath("x1") === "/admin/medlemskap/x1", "Fast arkivsti");

  const route = parseAdminDetailRoute("/admin/medlemskap/x1");
  assert(route?.kind === "membershipApplication" && route.id === "x1", "Parser arkivside");
  assert(route?.backTab === "planlegger-medlemskap", "Arkiv går tilbake til medlemskap");
});