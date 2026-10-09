import { parseDataset, type Dataset } from "../utils/dataset";

// The congregations whose websites can be put in for a demonstration («Velg menighet» under
// Database). Each is a dataset file in public/demosett/, listed in index.json there. The files
// are made from the congregations' own public websites, with every e-mail address and phone
// number taken out, and are only fetched when one is chosen.

const FOLDER = "/demosett";

export interface DemoSetInfo {
  id: string;
  /** The congregation's name. */
  name: string;
  file: string;
  /** The website the content was taken from, e.g. «sognemisjonskirke.no». */
  source: string;
  fetchedAt: string;
  documents: number;
  /**
   * Whether the congregation is in the list every visitor of the demo is offered, until the
   * owner of the demo says otherwise (see utils/demoSite.ts). Left out, it is not.
   */
  listed?: boolean;
}

const isInfo = (value: unknown): value is DemoSetInfo => {
  const info = value as Partial<DemoSetInfo> | null;
  return (
    !!info &&
    typeof info.id === "string" &&
    typeof info.name === "string" &&
    typeof info.file === "string" &&
    // The file is fetched from the folder, so the name can be nothing but a file name
    /^[a-z0-9-]+\.json$/.test(info.file) &&
    typeof info.source === "string" &&
    typeof info.fetchedAt === "string" &&
    typeof info.documents === "number" &&
    (info.listed === undefined || typeof info.listed === "boolean")
  );
};

/** The demo sets that come with the app. Throws when the list cannot be fetched or is not a list. */
export async function listDemoSets(): Promise<DemoSetInfo[]> {
  const response = await fetch(`${FOLDER}/index.json`);
  if (!response.ok) throw new Error(`Listen over menigheter kunne ikke hentes (${response.status}).`);
  const list: unknown = await response.json();
  if (!Array.isArray(list)) throw new Error("Listen over menigheter har et ukjent format.");
  return list.filter(isInfo);
}

/** The dataset for one congregation. Throws when the file cannot be fetched or is not a dataset. */
export async function loadDemoSet(info: Pick<DemoSetInfo, "file" | "name">): Promise<Dataset> {
  const response = await fetch(`${FOLDER}/${info.file}`);
  if (!response.ok) throw new Error(`Innholdet for ${info.name} kunne ikke hentes (${response.status}).`);
  const parsed = parseDataset(await response.text());
  if (!parsed.ok) throw new Error(`Innholdet for ${info.name} kunne ikke leses: ${parsed.error}`);
  return parsed.dataset;
}
