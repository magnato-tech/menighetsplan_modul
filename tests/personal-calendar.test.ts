import { describe } from "vitest";
import { assert } from "./assert";
import {
  filterPersonalCalendarEvents,
  personalCalendarEvents,
  personalCalendarGatheringsForFeed,
  PERSONAL_FEED_FUTURE_MS,
  PERSONAL_FEED_PAST_MS,
} from "../src/utils/personalCalendar";
import type { Gathering, Group } from "../src/types";

describe("Min kalender", () => {
  const from = new Date("2026-10-02T12:00:00.000Z").getTime();
  const inDays = (days: number) => new Date(from + days * 24 * 60 * 60 * 1000).toISOString();

  const tjenesteGroup: Group = {
    id: "tjeneste-1",
    name: "Lyd og bilde",
    category: "tjenestegruppe",
    memberIds: ["p1"],
    leaderIds: [],
  };

  const husGroup: Group = {
    id: "hus-1",
    name: "Husfellesskap Sentrum",
    category: "husgruppe",
    memberIds: ["p1"],
    leaderIds: [],
  };

  const publicGathering: Gathering = {
    id: "gudstjeneste",
    groupId: "church-group",
    title: "Søndagsgudstjeneste",
    startsAt: inDays(7),
    visibility: "offentlig",
    type: "arrangement",
  };

  const groupGathering: Gathering = {
    id: "gruppe-mote",
    groupId: "tjeneste-1",
    title: "Tjenestemøte",
    startsAt: inDays(3),
    visibility: "intern",
    type: "gruppesamling",
  };

  const husGathering: Gathering = {
    id: "hus-mote",
    groupId: "hus-1",
    title: "Husmøte",
    startsAt: inDays(5),
    visibility: "intern",
    type: "gruppesamling",
    invitationSent: false,
  };

  const duplicatePublic: Gathering = {
    ...publicGathering,
    groupId: "tjeneste-1",
    type: "gruppesamling",
  };

  const docs: Gathering[] = [publicGathering, groupGathering, husGathering, duplicatePublic];

  const events = personalCalendarEvents(docs, [tjenesteGroup, husGroup], from, () => undefined);

  assert(
    events.map((event) => event.gathering.id).join() === "gruppe-mote,gudstjeneste",
    "Tar med offentlig arrangement og gruppesamling, sortert kronologisk"
  );

  assert(
    events.find((event) => event.gathering.id === "gudstjeneste")?.source === "menigheten",
    "Offentlig samling merkes som menigheten"
  );

  assert(
    events.find((event) => event.gathering.id === "gruppe-mote")?.groupName === "Lyd og bilde",
    "Gruppesamling merkes med gruppenavn"
  );

  assert(
    !events.some((event) => event.gathering.id === "hus-mote"),
    "Husgruppe uten innkalling og uten svar holdes utenfor"
  );

  assert(
    events.filter((event) => event.gathering.id === "gudstjeneste").length === 1,
    "Samme id tas bare med én gang når den også er offentlig"
  );

  const husWithInvitation = personalCalendarEvents(
    [{ ...husGathering, invitationSent: true }],
    [husGroup],
    from,
    () => undefined
  );

  assert(
    husWithInvitation.some((event) => event.gathering.id === "hus-mote"),
    "Husgruppe med innkalling vises"
  );

  const husWithAnswer = personalCalendarEvents(
    [husGathering],
    [husGroup],
    from,
    (gatheringId) =>
      gatheringId === "hus-mote"
        ? { id: "att-1", gatheringId: "hus-mote", personId: "p1", status: "declined" }
        : undefined
  );

  assert(
    husWithAnswer.some((event) => event.gathering.id === "hus-mote"),
    "Husgruppe med svar vises selv uten innkalling"
  );

  const filtered = filterPersonalCalendarEvents(events, "mine_grupper");
  assert(
    filtered.every((event) => event.source === "mine_grupper"),
    "Filteret Mine grupper viser bare gruppesamlinger"
  );

  const now = new Date(from);
  const feed = personalCalendarGatheringsForFeed(docs, [tjenesteGroup, husGroup], now, () => undefined);
  assert(feed.map((g) => g.id).join() === "gruppe-mote,gudstjeneste", "iCal-utvalg følger Min kalender i feed-vinduet");

  const tooOld: Gathering = {
    ...groupGathering,
    id: "old",
    startsAt: new Date(from - PERSONAL_FEED_PAST_MS - 86400000).toISOString(),
  };
  const tooFar: Gathering = {
    ...groupGathering,
    id: "far",
    startsAt: new Date(from + PERSONAL_FEED_FUTURE_MS + 86400000).toISOString(),
  };
  const feedWindow = personalCalendarGatheringsForFeed(
    [...docs, tooOld, tooFar],
    [tjenesteGroup],
    now,
    () => undefined
  );
  assert(!feedWindow.some((g) => g.id === "old"), "Arrangement eldre enn feed-vinduet tas ikke med");
  assert(!feedWindow.some((g) => g.id === "far"), "Arrangement utenfor ett år fram tas ikke med");
});
