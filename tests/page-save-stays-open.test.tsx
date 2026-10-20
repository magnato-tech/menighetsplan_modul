// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminCmsPanel } from "../src/components/admin/AdminCmsPanel";
import { PageEditModal } from "../src/pages/admin/tabs/pages/PageEditModal";
import { demoCmsSettings, type CmsPage } from "../src/data/cmsData";
import { pageFingerprint } from "../src/utils/pageRecord";

const { savePage } = vi.hoisted(() => ({ savePage: vi.fn(async () => true) }));

vi.mock("../src/context/CmsContext", () => ({
  useCms: () => ({
    settings: demoCmsSettings,
    pages: [],
    media: [],
    news: [],
    sermons: [],
    staff: [],
    savePage,
    deletePage: vi.fn(),
    reorderPages: vi.fn(),
    getPageBySlug: () => undefined,
  }),
}));
vi.mock("../src/context/FirebaseDataContext", () => ({
  useFirebase: () => ({ currentUser: { id: "p1", name: "Kari Nordmann", globalRole: "admin" }, allPersons: [], gatherings: [], groups: [] }),
}));

afterEach(() => {
  cleanup();
  savePage.mockClear();
});

describe("Lagre i redigeringen av en side", () => {
  test("siden blir stående åpen, og neste Lagre oppdaterer den samme siden", async () => {
    const showFeedback = vi.fn();
    const { getByPlaceholderText, getByTitle } = render(
      <MemoryRouter>
        <AdminCmsPanel showFeedback={showFeedback} createRequested />
      </MemoryRouter>
    );
    fireEvent.change(getByPlaceholderText("f.eks. Om oss, Barn & Unge, Kontakt"), { target: { value: "Om oss" } });

    fireEvent.click(getByTitle("Lagre siden"));
    await waitFor(() => expect(showFeedback).toHaveBeenCalledWith("Siden ble lagret og menystrukturen ble oppdatert!"));
    const first = (savePage.mock.calls[0] as unknown as [Partial<CmsPage>])[0];
    expect(first.id).toMatch(/^page/);
    // Still open
    expect(getByPlaceholderText("f.eks. Om oss, Barn & Unge, Kontakt")).toBeTruthy();

    fireEvent.click(getByTitle("Lagre siden"));
    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(2));
    const second = (savePage.mock.calls[1] as unknown as [Partial<CmsPage>])[0];
    expect(second.id).toBe(first.id);
  });
});

describe("Endringer som ikke er lagret", () => {
  const åpneNySide = () =>
    render(
      <MemoryRouter>
        <AdminCmsPanel showFeedback={vi.fn()} createRequested />
      </MemoryRouter>
    );
  const tittel = (view: ReturnType<typeof åpneNySide>) => view.getByPlaceholderText("f.eks. Om oss, Barn & Unge, Kontakt") as HTMLInputElement;

  test("en side lagres likt når ingenting er endret, og ulikt når noe er det", () => {
    const side: Partial<CmsPage> = { id: "page-om-oss", slug: "om-oss", title: "Om oss", content: "Tekst" };
    expect(pageFingerprint({ ...side })).toBe(pageFingerprint(side));
    expect(pageFingerprint({ ...side, title: "Om oss X" })).not.toBe(pageFingerprint(side));
  });

  test("uten endringer lukkes siden uten spørsmål", () => {
    const view = åpneNySide();
    fireEvent.click(view.getByText("Avbryt"));
    expect(view.queryByRole("alertdialog")).toBeNull();
    expect(view.queryByPlaceholderText("f.eks. Om oss, Barn & Unge, Kontakt")).toBeNull();
  });

  test("med endringer spørres det først, og Bli her lar endringene stå", () => {
    const view = åpneNySide();
    fireEvent.change(tittel(view), { target: { value: "Om oss" } });
    fireEvent.click(view.getByText("Avbryt"));
    expect(view.getByRole("alertdialog").textContent).toContain("«Om oss»");
    fireEvent.click(view.getByText("Bli her"));
    expect(view.queryByRole("alertdialog")).toBeNull();
    expect(tittel(view).value).toBe("Om oss");
  });

  test("Forkast lukker uten å lagre, og Lagre lagrer før siden lukkes", async () => {
    let view = åpneNySide();
    fireEvent.change(tittel(view), { target: { value: "Om oss" } });
    fireEvent.click(view.getByText("Avbryt"));
    fireEvent.click(view.getByText("Forkast endringene"));
    expect(savePage).not.toHaveBeenCalled();
    expect(view.queryByPlaceholderText("f.eks. Om oss, Barn & Unge, Kontakt")).toBeNull();
    cleanup();

    view = åpneNySide();
    fireEvent.change(tittel(view), { target: { value: "Om oss" } });
    fireEvent.click(view.getByText("Avbryt"));
    fireEvent.click(view.getByRole("alertdialog").querySelector("button:last-child")!);
    await waitFor(() => expect(view.queryByPlaceholderText("f.eks. Om oss, Barn & Unge, Kontakt")).toBeNull());
    expect(savePage).toHaveBeenCalledTimes(1);
  });

  test("etter Lagre er det ingen endringer igjen å spørre om", async () => {
    const view = åpneNySide();
    fireEvent.change(tittel(view), { target: { value: "Om oss" } });
    fireEvent.click(view.getByTitle("Lagre siden"));
    await waitFor(() => expect(savePage).toHaveBeenCalledTimes(1));
    fireEvent.click(view.getByText("Avbryt"));
    expect(view.queryByRole("alertdialog")).toBeNull();
  });
});

describe("Når redigeringen åpnes", () => {
  test("kommer den øverst på skjermen, ikke bare nederste del av den", () => {
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    render(
      <MemoryRouter>
        <AdminCmsPanel showFeedback={vi.fn()} createRequested />
      </MemoryRouter>
    );
    expect(scrolled.some((element) => element.hasAttribute("data-page-editor"))).toBe(true);
  });
});

describe("Toppbildet på forsiden i redigeringen", () => {
  const forside: Partial<CmsPage> = { id: "page-forside", slug: "forside", linkUrl: "/", title: "Forside" };
  const rediger = (page: Partial<CmsPage>) =>
    render(
      <MemoryRouter>
        <PageEditModal editingPage={page} isNewPage={false} availableParentPages={[]} onUpdate={vi.fn()} onSave={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>
    );

  test("størrelse og skrift står rett under Tittel i Hero", () => {
    const { getByLabelText } = rediger(forside);
    const size = getByLabelText("Tekststørrelse på tittelen");
    const box = [...document.querySelectorAll("span")].find((span) => span.textContent === "Toppbildet: størrelse, tittel og flere bilder")!;
    // Before the hero box in the form, not inside it
    expect(size.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getByLabelText("Skrift på tittelen")).toBeTruthy();
  });

  test("tittelfeltet for toppbilde 2 og 3 står der alltid, og kan brukes når bildet er valgt", () => {
    const { getByLabelText } = rediger({ ...forside, heroImages: ["https://example.org/to.jpg"] });
    const to = getByLabelText("Tittel på toppbilde 2") as HTMLInputElement;
    const tre = getByLabelText("Tittel på toppbilde 3") as HTMLInputElement;
    expect(to.disabled).toBe(false);
    expect(tre.disabled).toBe(true);
    expect(tre.placeholder).toBe("Velg et bilde først");
  });

  test("en vanlig side har ikke størrelse og skrift for toppbildet", () => {
    const { queryByLabelText } = rediger({ id: "page-om-oss", slug: "om-oss", title: "Om oss" });
    expect(queryByLabelText("Tekststørrelse på tittelen")).toBeNull();
  });
});
