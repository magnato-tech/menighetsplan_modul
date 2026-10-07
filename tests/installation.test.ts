import { describe, expect, test } from "vitest";
import {
  OPTIONAL_SETTINGS,
  REQUIRED_SETTINGS,
  UNCONFIGURED,
  firebaseOptionsOf,
  missingInstallationSettings,
  readInstallationConfig,
} from "../src/installation";

// The settings of a made-up congregation's installation
const sentrum = {
  VITE_FIREBASE_API_KEY: "nokkel-sentrum",
  VITE_FIREBASE_AUTH_DOMAIN: "menighetsplan-sentrum.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "menighetsplan-sentrum",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
};

describe("Installasjonen sier selv hvilken database den hører til", () => {
  test("uten innstillinger hører den ikke til noen, og det sies hvilke som mangler", () => {
    expect(readInstallationConfig({})).toBeNull();
    expect(missingInstallationSettings({})).toEqual([
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_APP_ID",
    ]);
  });

  test("mangler én, eller står den tom, er installasjonen ikke satt opp", () => {
    const { VITE_FIREBASE_PROJECT_ID: _left, ...withoutProject } = sentrum;
    expect(missingInstallationSettings(withoutProject)).toEqual(["VITE_FIREBASE_PROJECT_ID"]);
    expect(readInstallationConfig(withoutProject)).toBeNull();

    // An empty value, blanks only, or something that is not text is the same as nothing
    for (const nothing of ["", "   ", undefined, null, 42, true]) {
      const env = { ...sentrum, VITE_FIREBASE_API_KEY: nothing };
      expect(missingInstallationSettings(env)).toEqual(["VITE_FIREBASE_API_KEY"]);
      expect(readInstallationConfig(env)).toBeNull();
    }
  });

  test("med de fire som må være med, er den satt opp, og ingenting annet er gjettet", () => {
    expect(missingInstallationSettings(sentrum)).toEqual([]);
    expect(readInstallationConfig(sentrum)).toEqual({
      apiKey: "nokkel-sentrum",
      authDomain: "menighetsplan-sentrum.firebaseapp.com",
      projectId: "menighetsplan-sentrum",
      appId: "1:123:web:abc",
    });
  });

  test("de valgfrie tas med når de er fylt inn, uten mellomrom rundt", () => {
    const config = readInstallationConfig({
      ...sentrum,
      VITE_FIREBASE_PROJECT_ID: "  menighetsplan-sentrum ",
      VITE_FIREBASE_STORAGE_BUCKET: "menighetsplan-sentrum.firebasestorage.app",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
      VITE_FIREBASE_DATABASE_ID: "egen-database",
      VITE_TENANT_ID: "sentrum",
      // What the hosting adds on its own is not ours to read
      VITE_NOE_ANNET: "x",
      NODE_ENV: "production",
    });

    expect(config).toEqual({
      apiKey: "nokkel-sentrum",
      authDomain: "menighetsplan-sentrum.firebaseapp.com",
      projectId: "menighetsplan-sentrum",
      appId: "1:123:web:abc",
      storageBucket: "menighetsplan-sentrum.firebasestorage.app",
      messagingSenderId: "123",
      firestoreDatabaseId: "egen-database",
      tenantId: "sentrum",
    });
  });

  test("Firebase startes med sine egne innstillinger, uten de som er våre", () => {
    const config = readInstallationConfig({ ...sentrum, VITE_FIREBASE_DATABASE_ID: "egen-database", VITE_TENANT_ID: "sentrum" })!;

    expect(firebaseOptionsOf(config)).toEqual({
      apiKey: "nokkel-sentrum",
      authDomain: "menighetsplan-sentrum.firebaseapp.com",
      projectId: "menighetsplan-sentrum",
      appId: "1:123:web:abc",
    });
  });

  test("navnene er de avtalte: VITE_FIREBASE_ for databasen og VITE_TENANT_ID for menigheten", () => {
    const names = [...Object.values(REQUIRED_SETTINGS), ...Object.values(OPTIONAL_SETTINGS)];
    expect(names.filter((name) => !name.startsWith("VITE_FIREBASE_"))).toEqual(["VITE_TENANT_ID"]);
    expect(new Set(names).size).toBe(names.length);
  });

  test("plassholderen for en installasjon som ikke er satt opp, peker ikke på noe prosjekt som finnes", () => {
    expect(UNCONFIGURED.projectId).toBe("ikke-satt-opp");
    // A name under .invalid can never be registered
    expect(UNCONFIGURED.authDomain.endsWith(".invalid")).toBe(true);
    expect(UNCONFIGURED.firestoreDatabaseId).toBeUndefined();
  });
});
