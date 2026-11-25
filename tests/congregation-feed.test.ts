import { describe, expect, test } from "vitest";
import { webcalUrl } from "../src/utils/congregationFeed";

// The address of the congregation's calendar file, as the phone's calendar app opens it with webcal://.

describe("webcalUrl", () => {
  test("bytter https:// med webcal://", () => {
    expect(webcalUrl("https://menighet.example/api/offentlig/kalender.ics")).toBe(
      "webcal://menighet.example/api/offentlig/kalender.ics"
    );
  });

  test("bytter http:// med webcal://", () => {
    expect(webcalUrl("http://localhost:3000/api/offentlig/kalender.ics?menighet=eksempel")).toBe(
      "webcal://localhost:3000/api/offentlig/kalender.ics?menighet=eksempel"
    );
  });
});
