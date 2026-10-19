// Reads the public Firebase web settings out of the published demo, the way every visitor's browser gets them
const base = "https://demo.menighetsplan.no";
const html = await (await fetch(base + "/")).text();
const seen = new Set();
const queue = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
let text = "";
while (queue.length && seen.size < 120) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const js = await (await fetch(base + path)).text();
  text += "\n" + js;
  for (const m of js.matchAll(/["'`(/]((?:\/?assets\/)?[\w.-]+\.js)["'`)]/g)) {
    const p = m[1].startsWith("/assets/") ? m[1] : m[1].startsWith("assets/") ? "/" + m[1] : "/assets/" + m[1];
    if (!seen.has(p)) queue.push(p);
  }
}
const pick = (re) => text.match(re)?.[1];
const apiKey = pick(/(AIza[0-9A-Za-z_\-]{35})/);
const authDomain = pick(/["']([a-z0-9-]+\.firebaseapp\.com)["']/);
const appId = pick(/["'](1:\d+:web:[0-9a-f]+)["']/);
const projectId = authDomain?.replace(".firebaseapp.com", "");
const out = {
  VITE_FIREBASE_API_KEY: apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: authDomain,
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_APP_ID: appId,
  VITE_FIREBASE_MESSAGING_SENDER_ID: appId?.split(":")[1],
  VITE_DEMO: "true",
};
console.error("demo settings found:", Object.entries(out).map(([k, v]) => `${k}=${v ? "ja" : "NEI"}`).join(" "), "project:", projectId);
console.log(Object.entries(out).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("\n"));
