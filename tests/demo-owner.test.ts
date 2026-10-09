// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readDemoInstallation } from "../src/installation";
import { MIN_OWNER_CODE_LENGTH, isOwnerCode, ownerCodeHashOf, ownerCodeProblem } from "../src/utils/demoOwner";

// The owner of the demo is known by a code. The demo's settings hold a fingerprint of the code,
// and the owner's browser holds the code.

// The test browser has no fingerprinting of its own
if (!globalThis.crypto?.subtle) vi.stubGlobal("crypto", webcrypto);

const CODE = "riktig-eierkode-2026";
const KEY = "menighetsplan_demo_eier";

const { installation } = vi.hoisted(() => ({ installation: { demo: null as null | { ownerCodeHash?: string } } }));
vi.mock("../src/demo", () => ({
  get DEMO() {
    return installation.demo;
  },
}));

/** The service as a browser that has just loaded the app has it. */
const open = async () => {
  vi.resetModules();
  return import("../src/services/demoOwner");
};
/** Follows the answer until the stored code has been tried. */
const settled = async (service: Awaited<ReturnType<typeof open>>) => {
  const stop = service.subscribeDemoOwner(() => {});
  await vi.waitFor(() => expect(service.readDemoOwner()).not.toBe("checking"));
  stop();
  return service.readDemoOwner();
};

beforeEach(async () => {
  installation.demo = { ownerCodeHash: await ownerCodeHashOf(CODE) };
});

afterEach(() => {
  window.localStorage.clear();
  installation.demo = null;
});

describe("Eierkoden og fingeravtrykket av den", () => {
  test("fingeravtrykket er SHA-256 av koden", async () => {
    expect(await ownerCodeHashOf("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await ownerCodeHashOf("  abc \n")).toBe(await ownerCodeHashOf("abc"));
    expect(await ownerCodeHashOf(CODE)).not.toBe(await ownerCodeHashOf(`${CODE}!`));
  });

  test("bare den riktige koden er eierens", async () => {
    const hash = await ownerCodeHashOf(CODE);
    expect(await isOwnerCode(CODE, hash)).toBe(true);
    expect(await isOwnerCode(` ${CODE} `, hash)).toBe(true);
    expect(await isOwnerCode("feil-kode-2026-xx", hash)).toBe(false);
    expect(await isOwnerCode("", hash)).toBe(false);
  });

  test("uten fingeravtrykk i innstillingene er ingen eier, heller ikke med tom kode", async () => {
    expect(await isOwnerCode(CODE, undefined)).toBe(false);
    expect(await isOwnerCode("", undefined)).toBe(false);
    expect(await isOwnerCode("", await ownerCodeHashOf(""))).toBe(false);
  });

  test("en kort kode kan ikke velges", () => {
    expect(ownerCodeProblem("")).toBeNull();
    expect(ownerCodeProblem("kort")).toMatch(new RegExp(`minst ${MIN_OWNER_CODE_LENGTH} tegn`));
    expect(ownerCodeProblem("a".repeat(MIN_OWNER_CODE_LENGTH - 1))).not.toBeNull();
    expect(ownerCodeProblem("a".repeat(MIN_OWNER_CODE_LENGTH))).toBeNull();
  });
});

describe("Fingeravtrykket i demoens innstillinger", () => {
  const hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

  test("leses når installasjonen er demoen", () => {
    expect(readDemoInstallation({ VITE_DEMO: "true", VITE_DEMO_OWNER_CODE_HASH: hash })?.ownerCodeHash).toBe(hash);
    expect(readDemoInstallation({ VITE_DEMO: "true", VITE_DEMO_OWNER_CODE_HASH: ` ${hash.toUpperCase()} ` })?.ownerCodeHash).toBe(hash);
  });

  test("noe annet enn et helt fingeravtrykk slipper ingen inn", () => {
    for (const value of ["", "abc", hash.slice(0, 63), `${hash}0`, hash.replace("b", "x"), CODE]) {
      expect(readDemoInstallation({ VITE_DEMO: "true", VITE_DEMO_OWNER_CODE_HASH: value })).not.toHaveProperty("ownerCodeHash");
    }
  });

  test("hos en menighet finnes det ingen eier av en demo", () => {
    expect(readDemoInstallation({ VITE_DEMO_OWNER_CODE_HASH: hash })).toBeNull();
  });
});

describe("Hvem som er eier i denne nettleseren", () => {
  test("ingen før koden er skrevet", async () => {
    const service = await open();
    expect(service.readDemoOwner()).toBe("checking");
    expect(await settled(service)).toBe("locked");
    expect(service.isDemoOwnerSetUp()).toBe(true);
  });

  test("feil kode åpner ikke, og huskes ikke", async () => {
    const service = await open();
    expect(await service.unlockDemoOwner("feil-kode-2026-xx")).toBe(false);
    expect(await settled(service)).toBe("locked");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  test("riktig kode åpner, sier fra til dem som følger med, og huskes til neste gang", async () => {
    const service = await open();
    const told = vi.fn();
    service.subscribeDemoOwner(told);
    await settled(service);

    expect(await service.unlockDemoOwner(CODE)).toBe(true);
    expect(service.readDemoOwner()).toBe("owner");
    expect(told).toHaveBeenCalled();

    // The app is loaded again in the same browser
    expect(await settled(await open())).toBe("owner");
  });

  test("et merke i nettleserens lager gjør ingen til eier: det er koden som prøves", async () => {
    window.localStorage.setItem(KEY, "1");
    expect(await settled(await open())).toBe("locked");
    window.localStorage.setItem(KEY, "owner");
    expect(await settled(await open())).toBe("locked");
  });

  test("byttes koden i innstillingene, er den gamle ikke eierens lenger", async () => {
    await (await open()).unlockDemoOwner(CODE);
    installation.demo = { ownerCodeHash: await ownerCodeHashOf("en-helt-ny-eierkode") };
    expect(await settled(await open())).toBe("locked");
  });

  test("å låse glemmer koden", async () => {
    const service = await open();
    await service.unlockDemoOwner(CODE);
    service.lockDemoOwner();

    expect(service.readDemoOwner()).toBe("locked");
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(await settled(await open())).toBe("locked");
  });

  test("uten eierkode i innstillingene åpner ingen kode", async () => {
    installation.demo = {};
    const service = await open();
    expect(service.isDemoOwnerSetUp()).toBe(false);
    expect(await service.unlockDemoOwner(CODE)).toBe(false);
    expect(await service.unlockDemoOwner("")).toBe(false);
    expect(await settled(service)).toBe("locked");
  });

  test("hos en menighet er ingen eier av en demo, uansett hva nettleseren har lagret", async () => {
    installation.demo = null;
    window.localStorage.setItem(KEY, CODE);
    const service = await open();
    expect(await settled(service)).toBe("locked");
    expect(await service.unlockDemoOwner(CODE)).toBe(false);
  });
});
