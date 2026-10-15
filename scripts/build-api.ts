// Packs the functions the hosting runs (server/vercel/*.ts) into api/*.js, one file each with
// everything it needs inside. Vercel reads the functions from api/ as they lie in the repo, before
// it builds anything, so the packed files are committed. Run `npm run build:api` after a change to
// a function or to anything it uses; tests/public-calendar-function.test.ts fails until it is done.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

/** The functions: the name in api/, and where the source is. */
export const API_FUNCTIONS = { kalender: "server/vercel/kalender.ts", epost: "server/vercel/epost.ts", nyhetsbrevbilde: "server/vercel/nyhetsbrevbilde.ts" } as const;

const root = fileURLToPath(new URL("..", import.meta.url));

const banner = (source: string) =>
  `// Laget av \`npm run build:api\` fra ${source}. Ikke rediger denne filen: endre kilden og kjør kommandoen.`;

/** The packed file for one function, as text. */
export async function packFunction(name: keyof typeof API_FUNCTIONS): Promise<string> {
  const source = API_FUNCTIONS[name];
  const result = await build({
    absWorkingDir: root,
    entryPoints: [source],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    target: "node20",
    charset: "utf8",
    legalComments: "none",
    banner: { js: banner(source) },
  });
  return result.outputFiles[0].text;
}

export const packedPathOf = (name: keyof typeof API_FUNCTIONS): string => fileURLToPath(new URL(`../api/${name}.js`, import.meta.url));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const name of Object.keys(API_FUNCTIONS) as (keyof typeof API_FUNCTIONS)[]) {
    await writeFile(packedPathOf(name), await packFunction(name), "utf8");
    console.log(`api/${name}.js er pakket fra ${API_FUNCTIONS[name]}`);
  }
}
