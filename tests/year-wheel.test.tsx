// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DEFAULT_YEAR_WHEEL } from "../src/data/defaultYearWheel";
import { daysIn, withoutYearWheelItem, withYearWheelItem, yearWheelByMonth, yearWheelItemError, yearWheelItemsOf, type YearWheelItem } from "../src/utils/yearWheel";

// The annual wheel of a congregation: deadlines month by month, which the administrator edits.

const service = vi.hoisted(() => ({
  stored: null as unknown,
  saveYearWheel: vi.fn(async (_items: unknown[]) => {}),
}));
vi.mock("../src/services/yearWheel", () => ({
  saveYearWheel: service.saveYearWheel,
  subscribeYearWheel: (onChange: (items: unknown) => void) => {
    onChange(service.stored);
    return () => {};
  },
}));

import { YearWheelTab } from "../src/pages/admin/tabs/YearWheelTab";

const showFeedback = vi.fn();
const show = () => render(<YearWheelTab showFeedback={showFeedback} currentMonth={10} />);
const month = (name: string) => screen.getByRole("region", { name });
const saved = () => service.saveYearWheel.mock.calls[0][0] as YearWheelItem[];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  service.stored = null;
});

describe("Standardårshjulet", () => {
  test("har frister i alle tolv måneder, hver med en dag som finnes", () => {
    const months = yearWheelByMonth(DEFAULT_YEAR_WHEEL);
    expect(months).toHaveLength(12);
    expect(months.every((entry) => entry.items.length > 0)).toBe(true);
    expect(DEFAULT_YEAR_WHEEL.every((item) => yearWheelItemError(item) === null)).toBe(true);
    expect(new Set(DEFAULT_YEAR_WHEEL.map((item) => item.id)).size).toBe(DEFAULT_YEAR_WHEEL.length);
    expect(months[2].items.map((item) => `${item.day}. ${item.title}`)).toEqual(["1. Rapportere menighetsstatistikk", "20. PMF (uke 11)", "31. Månedsregnskap", "31. Årsmøte"]);
  });
});

describe("En frist i årshjulet", () => {
  test("må ha en tittel og en dag som finnes i måneden", () => {
    expect(yearWheelItemError({ month: 3, day: 31, title: "Årsmøte" })).toBeNull();
    expect(yearWheelItemError({ month: 3, day: 31, title: "  " })).toBe("Skriv hva fristen gjelder.");
    expect(yearWheelItemError({ month: 4, day: 31, title: "Frist" })).toBe("April har ikke dag 31.");
    expect(yearWheelItemError({ month: 2, day: 29, title: "Frist" })).toBeNull();
    expect(yearWheelItemError({ month: 2, day: 30, title: "Frist" })).toBe("Februar har ikke dag 30.");
    expect(yearWheelItemError({ month: 13, day: 1, title: "Frist" })).toBe("Velg en måned.");
    expect(yearWheelItemError({ month: 5, day: NaN, title: "Frist" })).toBe("Mai har ikke dag NaN.");
    expect(daysIn(2)).toBe(29);
  });

  test("legges til, endres og tas ut uten at resten røres", () => {
    const wheel: YearWheelItem[] = [
      { id: "a", month: 1, day: 15, title: "A" },
      { id: "b", month: 1, day: 3, title: "B" },
    ];
    const added = withYearWheelItem(wheel, { id: "c", month: 1, day: 3, title: "  Alfa ", note: "  " });
    expect(yearWheelByMonth(added)[0].items.map((item) => item.title)).toEqual(["Alfa", "B", "A"]);
    expect(added[2]).toEqual({ id: "c", month: 1, day: 3, title: "Alfa" });
    expect(withYearWheelItem(wheel, { id: "a", month: 6, day: 1, title: "A flyttet" })).toEqual([{ id: "a", month: 6, day: 1, title: "A flyttet" }, wheel[1]]);
    expect(withoutYearWheelItem(wheel, "a")).toEqual([wheel[1]]);
  });

  test("det som er lagret, leses uten å stole på det", () => {
    expect(yearWheelItemsOf(undefined)).toBeNull();
    expect(yearWheelItemsOf({ items: "nei" })).toBeNull();
    expect(yearWheelItemsOf({ items: [] })).toEqual([]);
    const mixed = [{ id: "a", month: 1, day: 15, title: "A" }, { id: "b", month: 4, day: 31, title: "Feil dag" }, { title: "Uten id" }, null];
    expect(yearWheelItemsOf({ items: mixed })).toEqual([{ id: "a", month: 1, day: 15, title: "A" }]);
  });
});

describe("Årshjulet i admin", () => {
  test("uten noe lagret vises standardårshjulet, med måneden som er nå, merket", () => {
    show();
    expect(screen.getByText(/Dette er standardårshjulet/)).toBeTruthy();
    expect(screen.getAllByRole("region")).toHaveLength(12);
    expect(within(month("Oktober")).getByText("Nå")).toBeTruthy();
    expect(month("Oktober").getAttribute("aria-current")).toBe("date");
    expect(within(month("Mars")).queryByText("Nå")).toBeNull();
    expect(within(month("Februar")).getByText("Sende ut innkallelse til årsmøte")).toBeTruthy();
    expect(service.saveYearWheel).not.toHaveBeenCalled();
  });

  test("en ny frist lagres sammen med hele standardårshjulet, som da er menighetens eget", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Ny frist" }));
    const form = screen.getByRole("dialog", { name: "Ny frist" });
    expect((within(form).getByLabelText("Måned") as HTMLSelectElement).value).toBe("10");
    fireEvent.click(within(form).getByRole("button", { name: "Lagre" }));
    expect(within(form).getByRole("alert").textContent).toBe("Skriv hva fristen gjelder.");
    expect(service.saveYearWheel).not.toHaveBeenCalled();

    fireEvent.change(within(form).getByLabelText("Hva gjelder det"), { target: { value: "Bestille juletre" } });
    fireEvent.change(within(form).getByLabelText("Måned"), { target: { value: "11" } });
    fireEvent.change(within(form).getByLabelText("Dag"), { target: { value: "31" } });
    fireEvent.click(within(form).getByRole("button", { name: "Lagre" }));
    expect(within(form).getByRole("alert").textContent).toBe("November har ikke dag 31.");
    fireEvent.change(within(form).getByLabelText("Dag"), { target: { value: "20" } });
    fireEvent.click(within(form).getByRole("button", { name: "Lagre" }));

    expect(saved()).toHaveLength(DEFAULT_YEAR_WHEEL.length + 1);
    expect(saved()[saved().length - 1]).toMatchObject({ month: 11, day: 20, title: "Bestille juletre" });
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("Fristen er lagt inn i årshjulet."));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("en frist kan endres og tas ut, og menighetens eget årshjul vises når det er lagret", async () => {
    service.stored = [
      { id: "a", month: 3, day: 31, title: "Årsmøte" },
      { id: "b", month: 3, day: 1, title: "Statistikk", note: "Sendes til kirkesamfunnet" },
    ];
    vi.stubGlobal("confirm", vi.fn(() => true));
    show();
    expect(screen.queryByText(/Dette er standardårshjulet/)).toBeNull();
    expect(within(month("Mars")).getAllByRole("listitem").map((line) => line.textContent)).toEqual(["Statistikk1.Sendes til kirkesamfunnet", "Årsmøte31."]);
    expect(within(month("Januar")).getByText("Ingen frister")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Endre Årsmøte" }));
    const form = screen.getByRole("dialog", { name: "Endre frist" });
    fireEvent.change(within(form).getByLabelText("Dag"), { target: { value: "24" } });
    fireEvent.click(within(form).getByRole("button", { name: "Lagre" }));
    expect(saved()).toEqual([
      { id: "a", month: 3, day: 24, title: "Årsmøte" },
      { id: "b", month: 3, day: 1, title: "Statistikk", note: "Sendes til kirkesamfunnet" },
    ]);

    service.saveYearWheel.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Ta ut Statistikk" }));
    expect(vi.mocked(confirm).mock.calls[0][0]).toBe("Vil du ta «Statistikk» ut av årshjulet?");
    expect(saved().map((item) => item.id)).toEqual(["a"]);
  });

  test("uten bekreftelse tas ingenting ut, og et tomt årshjul er tomt, ikke standardårshjulet", () => {
    service.stored = [];
    vi.stubGlobal("confirm", vi.fn(() => false));
    show();
    expect(screen.queryByText(/Dette er standardårshjulet/)).toBeNull();
    expect(screen.getAllByText("Ingen frister")).toHaveLength(12);
    expect(service.saveYearWheel).not.toHaveBeenCalled();
  });
});
