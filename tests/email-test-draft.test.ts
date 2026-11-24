import { describe, expect, test } from "vitest";
import { EMAIL_SUBJECT_MAX, EMAIL_TEMPLATES, emailDraftError } from "../src/utils/emailMessage";
import { TEST_SUBJECT, TEST_TEXT, testDraftFor } from "../src/utils/emailTest";

describe("Prøven av e-postutsendingen", () => {
  const draft = { subject: "Nytt semester", text: "Første avsnitt.", link: "leder" as const };

  test("et gyldig utkast fra siden sendes som det er", () => {
    expect(testDraftFor(draft, "Fjellbygda menighet")).toEqual(draft);
    expect(testDraftFor(EMAIL_TEMPLATES[0], "Fjellbygda menighet")).toEqual({ subject: EMAIL_TEMPLATES[0].subject, text: EMAIL_TEMPLATES[0].text, link: EMAIL_TEMPLATES[0].link });
  });

  test("et tomt utkast blir en fast prøve med menighetens navn, som kan sendes", () => {
    const result = testDraftFor({ subject: "", text: "", link: "minside" }, "Fjellbygda menighet");
    expect(result).toEqual({ subject: "Test av e-post fra Fjellbygda menighet", text: TEST_TEXT, link: "ingen" });
    expect(emailDraftError(result)).toBeNull();
    expect(TEST_TEXT).toContain("Du trenger ikke svare på den.");
  });

  test("uten navn på menigheten heter prøven bare «Test av e-post»", () => {
    expect(testDraftFor({ subject: "", text: "", link: "minside" }, "").subject).toBe(TEST_SUBJECT);
    expect(testDraftFor({ subject: "", text: "", link: "minside" }, "   ").subject).toBe("Test av e-post");
  });

  test("et navn med linjeskift eller så langt at emnet ikke kan sendes, gir et emne som kan sendes", () => {
    const broken = testDraftFor({ subject: " ", text: "x", link: "minside" }, "Fjell\r\nbygda   menighet");
    expect(broken.subject).toBe("Test av e-post fra Fjell bygda menighet");
    expect(emailDraftError(broken)).toBeNull();
    const long = testDraftFor({ subject: "", text: "", link: "minside" }, "M".repeat(EMAIL_SUBJECT_MAX));
    expect(long.subject).toBe(TEST_SUBJECT);
    expect(emailDraftError(long)).toBeNull();
  });

  test("et utkast med bare en tekst som mangler, er ikke gyldig og gir prøven", () => {
    expect(testDraftFor({ ...draft, text: "" }, "M").text).toBe(TEST_TEXT);
  });
});
