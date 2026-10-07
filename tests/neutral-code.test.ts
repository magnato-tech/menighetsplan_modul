import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { emptyCmsSettings } from "../src/data/cmsData";
import { DEFAULT_LOCATION } from "../src/utils/gatherings";
import { DEFAULT_LOCATION as API_DEFAULT_LOCATION } from "../server/publicApi";

// The app is installed for one congregation after another, so nothing in the code may belong
// to one of them: not a name, not a database. The one exception is the demo data, which is an
// example congregation by design and is only shown when it has been put in the database.

const root = path.resolve(__dirname, "..");
const DEMO_DATA = new Set(["src/data/cmsData.ts", "src/data/mockData.ts"]);
const ROOT_FILES = ["server.ts", "index.html", "firebase.json", "vercel.json", "vite.config.ts", ".env.example"];

const BELONGS_TO_ONE = [
  { what: "navnet på én menighet", pattern: /lillesand/i },
  { what: "ett kirkesamfunn", pattern: /Misjonskirken/ },
  // The name of the first project. "Gudstjenesteplanleggeren" alone is an ordinary word, used in the admin.
  { what: "ett Firebase-prosjekt", pattern: /gudstjenesteplanlegger2/i },
  { what: "én navngitt database", pattern: /ai-studio-menighetsplan/i },
  { what: "fila med en fast database", pattern: /firebase-applet-config/ },
];

function filesUnder(folder: string): string[] {
  return readdirSync(path.join(root, folder)).flatMap((name) => {
    const relative = `${folder}/${name}`;
    if (statSync(path.join(root, relative)).isDirectory()) return name === "tests" ? [] : filesUnder(relative);
    return /\.(ts|tsx|css|html|json)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [relative] : [];
  });
}

describe("Koden hører ikke til noen bestemt menighet", () => {
  test("ingen fil utenom demodataene nevner én menighet, ett kirkesamfunn eller én database", () => {
    const files = [...filesUnder("src"), ...filesUnder("server"), ...filesUnder("scripts"), ...ROOT_FILES].filter(
      (file) => !DEMO_DATA.has(file)
    );
    expect(files.length).toBeGreaterThan(200);

    const found = files.flatMap((file) => {
      const text = readFileSync(path.join(root, file), "utf8");
      return BELONGS_TO_ONE.filter(({ pattern }) => pattern.test(text)).map(({ what }) => `${file}: ${what}`);
    });
    expect(found).toEqual([]);
  });

  test("en installasjon uten egne innstillinger viser ingen menighets opplysninger", () => {
    expect(emptyCmsSettings.churchName).toBe("Menigheten");
    const said = Object.entries(emptyCmsSettings).filter(
      ([key, value]) => !["churchName", "appName", "theme"].includes(key) && value !== "" && value !== undefined
    );
    // No address, phone, e-mail, giving number, account, organisation number, motto or link
    expect(said).toEqual([]);
  });

  test("stedet for et arrangement uten sted er det samme nøytrale ordet i appen og i API-et", () => {
    expect(DEFAULT_LOCATION).toBe("Kirken");
    expect(API_DEFAULT_LOCATION).toBe(DEFAULT_LOCATION);
  });
});
