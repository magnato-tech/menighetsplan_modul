// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { defaultSurfaces, type InstallationSurfaces } from "../src/utils/surfaces";

// The website link on pages outside the website (sign-in, login link, unsubscribe) follows the choice in admin
let surfaces: InstallationSurfaces = defaultSurfaces();
vi.mock("../src/context/CmsContext", () => ({ useCms: () => ({ surfaces }) }));

import { ChurchSiteLink } from "../src/components/ChurchSiteLink";

const hrefOf = (outsideSite: boolean) => {
  render(
    <MemoryRouter>
      <ChurchSiteLink outsideSite={outsideSite}>Til nettsiden</ChurchSiteLink>
    </MemoryRouter>
  );
  return screen.getByText("Til nettsiden").getAttribute("href");
};

describe("«Til nettsiden» utenfor nettsiden", () => {
  afterEach(cleanup);
  test("med nettsiden her går lenken til forsiden", () => {
    surfaces = defaultSurfaces();
    expect(hrefOf(true)).toBe("/");
  });

  test("med en annen nettside går lenken dit", () => {
    surfaces = { ...defaultSurfaces(), ownWebsite: false, externalSiteUrl: "https://kirken.example" };
    expect(hrefOf(true)).toBe("https://kirken.example");
  });

  test("adressen for «Tilbake til nettsiden» går foran, men bare utenfor nettsiden", () => {
    surfaces = { ...defaultSurfaces(), signInBackUrl: "https://kirken.example" };
    expect(hrefOf(true)).toBe("https://kirken.example");
  });

  test("inne på nettsiden gjelder ikke adressen for innloggingssiden", () => {
    surfaces = { ...defaultSurfaces(), signInBackUrl: "https://kirken.example" };
    expect(hrefOf(false)).toBe("/");
  });
});
