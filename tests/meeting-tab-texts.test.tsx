// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MeetingTab } from "../src/components/husfellesskap/MeetingTab";
import type { HusfellesskapModel } from "../src/components/husfellesskap/husfellesskapModel";

// The house-group view for a leader. A meeting is either a draft, which only the leaders see, or visible
// to the group on Min side. Nothing is sent by e-mail either way, so the texts must not promise it.

const ellen = { id: "ellen", name: "Ellen Fossli", globalRole: "member" as const };
const lars = { id: "lars", name: "Lars Fossli", globalRole: "member" as const };
const meeting = (invitationSent: boolean) => ({
  id: "m1",
  title: "Husfellesskap Borkedalen",
  startsAt: "2026-11-26T18:00:00.000Z",
  location: "Hos Ellen Fossli",
  groupId: "hus",
  invitationSent,
});

const modelFor = (invitationSent: boolean, sendInvitation = vi.fn(async () => ({ success: true }))) => {
  const active = meeting(invitationSent);
  return {
    model: {
      isLeader: true,
      isDeputyLeader: false,
      members: [ellen, lars],
      allGroupMeetings: [active],
      activeMeeting: active,
      setSelectedMeetingId: vi.fn(),
      hostPerson: undefined,
      attendingMembers: [],
      declinedMembers: [],
      unrespondedMembers: [ellen, lars],
      currentUserAttendance: undefined,
      respond: vi.fn(async () => ({ success: true })),
      sendInvitation,
      currentUser: ellen,
    } as unknown as HusfellesskapModel,
    sendInvitation,
  };
};

afterEach(cleanup);

describe("Lederens flyt for en samling i husgruppen", () => {
  test("et utkast sier at bare lederne ser det, og knappen heter Vis for gruppa", () => {
    const { model } = modelFor(false);
    render(<MeetingTab model={model} showToast={vi.fn()} onCreateMeeting={vi.fn()} onEditMeeting={vi.fn()} />);

    expect(screen.getByText("Utkast • Bare lederne ser den")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vis for gruppa" })).toBeTruthy();
    expect(screen.queryByText("Synlig for gruppa")).toBeNull();
    expect(screen.queryByText(/SEND INNKALLING|Send innkalling|e-post/i)).toBeNull();
  });

  test("en synlig samling sier at den står i kalenderen til gruppen, og har ingen sendeknapp", () => {
    const { model } = modelFor(true);
    render(<MeetingTab model={model} showToast={vi.fn()} onCreateMeeting={vi.fn()} onEditMeeting={vi.fn()} />);

    expect(screen.getByText("Synlig for gruppa")).toBeTruthy();
    expect(screen.getByText(/Det sendes ingen e-post eller SMS\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Vis for gruppa" })).toBeNull();
    expect(screen.queryByText("Send innkalling på nytt")).toBeNull();
    expect(screen.getByRole("button", { name: "Endre detaljer" })).toBeTruthy();
  });

  test("«Vis for gruppa» gjør møtet synlig og sier det, uten å sende noe", async () => {
    const { model, sendInvitation } = modelFor(false);
    const showToast = vi.fn();
    render(<MeetingTab model={model} showToast={showToast} onCreateMeeting={vi.fn()} onEditMeeting={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Vis for gruppa" }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("Møtet er synlig for gruppa."));
    expect(sendInvitation).toHaveBeenCalledWith("m1");
  });
});
