import { describe, expect, test } from "vitest";
import { heroHeightOf, heroSubtextOf, heroTitleStyleOf } from "../src/utils/heroLayout";
import { socialInMenu, socialLinksOf, socialUrlOf } from "../src/utils/socialLinks";

describe("Toppbildet på forsiden", () => {
  test("en side lagret før valgene fantes, ser ut som før", () => {
    expect(heroHeightOf({})).toBe("medium");
    expect(heroTitleStyleOf({})).toBe("bold");
    expect(heroHeightOf({ heroHeight: "low" })).toBe("low");
    expect(heroTitleStyleOf({ heroTitleStyle: "calm" })).toBe("calm");
  });

  test("undertittelen er sidens egen, så innstillingenes, og ingen når den er slått av", () => {
    expect(heroSubtextOf({ summary: "Sidens" }, { welcomeSubtext: "Innstillingenes" }, "Reserve")).toBe("Sidens");
    expect(heroSubtextOf({ summary: " " }, { welcomeSubtext: "Innstillingenes" }, "Reserve")).toBe("Innstillingenes");
    expect(heroSubtextOf({ summary: "Sidens", showHeroSubtext: false }, { welcomeSubtext: "Innstillingenes" }, "Reserve")).toBe("");
  });
});

describe("Lenker til sosiale medier", () => {
  test("bare felt som er fylt ut, gir et ikon, i fast rekkefølge", () => {
    const links = socialLinksOf({ youtubeUrl: "https://www.youtube.com/@menigheten", facebookUrl: "facebook.com/menigheten", instagramUrl: "" });
    expect(links.map((link) => link.kind)).toEqual(["facebook", "youtube"]);
    expect(links[0].url).toBe("https://facebook.com/menigheten");
  });

  test("noe som ikke er en lenke, blir ikke et ikon", () => {
    expect(socialUrlOf("menigheten")).toBeNull();
    expect(socialUrlOf("javascript:alert(1)")).toBeNull();
    expect(socialUrlOf("http://www.instagram.com/menigheten")).toBe("http://www.instagram.com/menigheten");
  });

  test("ikonene står i menyen til det slås av", () => {
    expect(socialInMenu({})).toBe(true);
    expect(socialInMenu({ showSocialInMenu: false })).toBe(false);
  });
});
