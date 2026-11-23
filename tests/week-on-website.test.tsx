// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { CmsNewsArticle, CmsPage } from "../src/data/cmsData";
import type { Gathering } from "../src/types";
import { missingThisWeek, newsThisWeek, recentChanges, weekOf } from "../src/utils/weekOnWebsite";

// The dialog is a stub here: this test is about what the card does with it, not what the dialog shows.
vi.mock("../src/components/gathering/GatheringWebsiteDialog", () => ({
  GatheringWebsiteDialog: ({ gathering, onSave, onClose }: { gathering: Gathering; onSave: (u: Partial<Gathering>) => unknown; onClose: () => void }) => (
    <div role="dialog" aria-label={`Bilde og tekst: ${gathering.title}`}>
      <button type="button" onClick={() => { onSave({ summary: "Ny tekst" }); onClose(); }}>Lagre test</button>
      <button type="button" onClick={onClose}>Lukk test</button>
    </div>
  ),
}));

import { WeekOnWebsiteCard } from "../src/pages/admin/tabs/dashboard/WeekOnWebsiteCard";

/** Monday 23. november 2026, 10:00 local time: the week runs 23.–29. november. */
const NOW = new Date(2026, 10, 23, 10, 0).getTime();
const at = (month: number, day: number, hour = 12, minute = 0) => new Date(2026, month, day, hour, minute);
const iso = (month: number, day: number, hour = 12, minute = 0) => at(month, day, hour, minute).toISOString();

const event = (over: Partial<Gathering> & { id: string; title: string; startsAt: string }) =>
  ({ visibility: "offentlig", isPublic: true, cancelled: false, imageUrl: "", summary: "", content: "", ...over }) as unknown as Gathering;

const article = (over: Partial<CmsNewsArticle> & { id: string; title: string }) =>
  ({ slug: over.id, summary: "", content: "", category: "aktuelt", author: "", publishedAt: iso(10, 20), isPublished: true, ...over }) as CmsNewsArticle;

const page = (over: Partial<CmsPage> & { id: string; title: string }) => ({ slug: over.id, summary: "", content: "", isPublished: true, updatedAt: "", ...over }) as CmsPage;

afterEach(() => cleanup());

describe("Denne uka på nettsiden: uke", () => {
  test("uka har etiketten mandag til søndag i samme måned", () => {
    expect(weekOf(NOW).label).toBe("mandag 23. – søndag 29. november");
  });

  test("uka som går over to måneder har måneden på begge dager", () => {
    expect(weekOf(at(10, 30, 9).getTime()).label).toBe("mandag 30. november – søndag 6. desember");
  });

  test("søndag kl. 23.59 hører til uka som starter mandagen før, og neste mandag til neste uke", () => {
    const week = weekOf(at(10, 29, 23, 59).getTime());
    expect(week.start).toBe(at(10, 23, 0).getTime());
    expect(week.end).toBe(at(10, 30, 0).getTime() - 1);
    expect(weekOf(at(10, 30, 0, 0).getTime()).start).toBe(at(10, 30, 0).getTime());
  });
});

describe("Denne uka på nettsiden: arrangementer", () => {
  const gatherings = [
    event({ id: "sent", title: "Konsert", startsAt: iso(10, 25, 19), imageUrl: "bilde.jpg", summary: "Ingress" }),
    event({ id: "bonne", title: "Bønnemøte", startsAt: iso(10, 24, 18) }),
    event({ id: "intern", title: "Styremøte", startsAt: iso(10, 26, 18), visibility: "intern", isPublic: false }),
    event({ id: "avlyst", title: "Avlyst", startsAt: iso(10, 27, 18), cancelled: true }),
    event({ id: "gruppe", title: "Gruppe", startsAt: iso(10, 26, 18), type: "gruppesamling" }),
    event({ id: "fortid", title: "Forrige uke", startsAt: iso(10, 22, 18) }),
    event({ id: "neste", title: "Neste uke", startsAt: iso(10, 30, 18) }),
  ];

  test("offentlige, ikke avlyste arrangementer fra nå til søndag, i tidsrekkefølge, med det som mangler", () => {
    const items = missingThisWeek(gatherings, NOW);
    expect(items.map((item) => item.gathering.id)).toEqual(["bonne", "sent"]);
    expect(items[0].missing).toEqual(["bilde", "tekst"]);
  });

  test("et ferdig arrangement tas med, uten noe som mangler", () => {
    const ready = missingThisWeek(gatherings, NOW).find((item) => item.gathering.id === "sent");
    expect(ready?.missing).toEqual([]);
  });
});

describe("Denne uka på nettsiden: nyheter", () => {
  const gatherings = [event({ id: "ev", title: "Ev", startsAt: iso(10, 27, 11), endsAt: iso(10, 27, 12) })];

  test("publiseres senere denne uka, og går ut denne uka (i dag med)", () => {
    const news = [
      article({ id: "planlagt", title: "Planlagt", publishedAt: iso(10, 26, 9) }),
      article({ id: "ute", title: "Går ut i dag", publishedAt: iso(10, 1), expiresAt: "2026-11-23" }),
      article({ id: "fredag", title: "Går ut fredag", publishedAt: iso(10, 1), expiresAt: "2026-11-27" }),
      article({ id: "utkast", title: "Utkast", publishedAt: iso(10, 26, 9), isPublished: false }),
      article({ id: "gammel", title: "Gammel", publishedAt: iso(10, 20, 9) }),
      article({ id: "desember", title: "Desember", publishedAt: iso(10, 1), expiresAt: "2026-12-04" }),
    ];
    const result = newsThisWeek(news, gatherings, NOW);
    expect(result.publishing.map((item) => item.news.id)).toEqual(["planlagt"]);
    expect(result.publishing[0].at).toBe(at(10, 26, 9).getTime());
    expect(result.expiring.map((item) => [item.news.id, item.day])).toEqual([
      ["ute", "2026-11-23"],
      ["fredag", "2026-11-27"],
    ]);
  });

  test("en nyhet om et arrangement går ut med arrangementet, og en uten dato står", () => {
    const news = [
      article({ id: "om-ev", title: "Om arrangementet", publishedAt: iso(10, 1), gatheringRefId: "ev" }),
      article({ id: "uten", title: "Uten slutt", publishedAt: iso(10, 1) }),
    ];
    const result = newsThisWeek(news, gatherings, NOW);
    expect(result.expiring.map((item) => item.news.id)).toEqual(["om-ev"]);
    expect(result.publishing).toEqual([]);
  });
});

describe("Denne uka på nettsiden: sist endret", () => {
  test("sider og nyheter etter tid, nyeste først, med høyst fem", () => {
    const pages = [
      page({ id: "a", title: "Eldst", updatedAt: iso(10, 1) }),
      page({ id: "b", title: "Nyest", updatedAt: iso(10, 23, 14), updatedBy: "p1" }),
      page({ id: "c", title: "Uten tid", updatedAt: "" }),
    ];
    const news = [article({ id: "n", title: "Nyhet", publishedAt: iso(10, 1), updatedAt: iso(10, 22, 9) })];
    const changes = recentChanges(pages, news, NOW, 5);
    expect(changes.map((change) => [change.kind, change.title])).toEqual([
      ["side", "Nyest"],
      ["nyhet", "Nyhet"],
      ["side", "Eldst"],
    ]);
    expect(changes[0].updatedBy).toBe("p1");

    const many = Array.from({ length: 7 }, (_, index) => page({ id: `s${index}`, title: `Side ${index}`, updatedAt: iso(10, 10 + index) }));
    expect(recentChanges(many, [], NOW)).toHaveLength(5);
  });
});

describe("Denne uka på nettsiden: kortet", () => {
  const persons = [{ id: "p1", name: "Kristine Vik" }];
  const nameOf = (id: string) => persons.find((person) => person.id === id)?.name;

  const renderCard = (onTabChange = vi.fn(), onSaveGathering = vi.fn(() => ({ success: true }))) => {
    const { container } = render(
      <WeekOnWebsiteCard
        pages={[page({ id: "forside", title: "Forside", updatedAt: iso(10, 23, 14, 5), updatedBy: "p1" })]}
        news={[
          article({ id: "n1", title: "Julemøte", publishedAt: iso(10, 26, 9) }),
          article({ id: "n2", title: "Vinterkurs", publishedAt: iso(10, 1), expiresAt: "2026-11-27" }),
        ]}
        gatherings={[
          event({ id: "bonne", title: "Bønnemøte", startsAt: iso(10, 24, 18) }),
          event({ id: "sent", title: "Konsert", startsAt: iso(10, 25, 19), imageUrl: "bilde.jpg", summary: "Ingress" }),
        ]}
        nameOf={nameOf}
        now={NOW}
        onTabChange={onTabChange}
        onSaveGathering={onSaveGathering}
      />
    );
    return { card: within(container), onTabChange, onSaveGathering };
  };

  test("viser de tre kolonnene med radene", () => {
    const { card } = renderCard();
    expect(card.getByText("Denne uka på nettsiden")).toBeTruthy();
    expect(card.getByText("mandag 23. – søndag 29. november")).toBeTruthy();
    expect(card.getByText("Mangler før søndag")).toBeTruthy();
    expect(card.getByText("Publiseres")).toBeTruthy();
    expect(card.getByText("Går ut")).toBeTruthy();
    expect(card.getByText("Sist endret")).toBeTruthy();

    expect(card.getByText("Bønnemøte · tir. 24. nov.")).toBeTruthy();
    expect(card.getByText("Mangler bilde og tekst")).toBeTruthy();
    expect(card.getByText("Klar: bilde og tekst er på plass")).toBeTruthy();
    expect(card.getByText("Nyhet · planlagt tor. 26. nov. kl. 09:00")).toBeTruthy();
    expect(card.getByText("Nyhet · siste dag fre. 27. nov.")).toBeTruthy();
    expect(card.getByText("Side · Endret i dag kl. 14:05 av Kristine Vik")).toBeTruthy();
  });

  test("et arrangement som mangler åpner bilde og tekst, og lagring går til arrangementet", () => {
    const { card, onSaveGathering } = renderCard();
    fireEvent.click(card.getByText("Bønnemøte · tir. 24. nov.").closest("button") as HTMLElement);
    const dialog = card.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Bilde og tekst: Bønnemøte");
    fireEvent.click(within(dialog).getByText("Lagre test"));
    expect(onSaveGathering).toHaveBeenCalledWith("bonne", { summary: "Ny tekst" });
  });

  test("klar arrangement er ikke en knapp, og nyheter og endringer går til sin fane", () => {
    const { card, onTabChange } = renderCard();
    expect(card.getByText("Klar: bilde og tekst er på plass").closest("button")).toBeNull();

    fireEvent.click(card.getByText("Julemøte").closest("button") as HTMLElement);
    expect(onTabChange).toHaveBeenLastCalledWith("cms-nyheter");
    fireEvent.click(card.getByText("Vinterkurs").closest("button") as HTMLElement);
    expect(onTabChange).toHaveBeenLastCalledWith("cms-nyheter");
    fireEvent.click(card.getByText("Forside").closest("button") as HTMLElement);
    expect(onTabChange).toHaveBeenLastCalledWith("cms-sider");
  });

  test("tomme kolonner sier det", () => {
    const { container } = render(
      <WeekOnWebsiteCard pages={[]} news={[]} gatherings={[]} nameOf={nameOf} now={NOW} onTabChange={vi.fn()} onSaveGathering={vi.fn(() => ({ success: true }))} />
    );
    const card = within(container);
    expect(card.getByText("Ingenting mangler denne uka.")).toBeTruthy();
    expect(card.getByText("Ingenting planlagt denne uka.")).toBeTruthy();
    expect(card.getByText("Ingenting går ut denne uka.")).toBeTruthy();
    expect(card.getByText("Ingen endringer ennå.")).toBeTruthy();
  });
});
