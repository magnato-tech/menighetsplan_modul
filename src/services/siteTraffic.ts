import { collection, doc, documentId, getDocs, increment, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { CMS_COLLECTIONS } from "../data/collections";
import { chunk } from "../utils/chunk";
import {
  TRAFFIC_RECORD,
  osloDayAndHour,
  parseTrafficDay,
  trafficDocId,
  type LoginCountId,
  type TrafficActionId,
  type TrafficDay,
  MIN_SIDE_OPENED,
} from "../utils/siteTraffic";
import type { TrafficRecorder } from "../utils/visitTracker";
import { ensureDeletionAllowed, readOperatingMode } from "./operatingMode";

/**
 * Where the visit counts are stored: one document per day, holding sums only (see
 * utils/siteTraffic.ts for what is counted and what is not).
 *
 * The rules deployed on the live project are older than firestore.rules and reject new
 * collections (checked 7 October 2026: a read of a new collection is denied). Like the
 * volunteer roles and the headcounts, the days are therefore stored as marked documents in
 * cms_settings, which allows writes. The public website only reads the settings document
 * itself, and the listeners behind it ask for their own mark, so nobody receives the counts
 * except the board that asks for them.
 *
 * The counts are not content: a dataset neither holds them nor empties them
 * (see datasetService.ts). They are reset here, on their own.
 */
const BATCH_SIZE = 400;

const dayRef = (date: string) => doc(db, CMS_COLLECTIONS.SETTINGS, trafficDocId(date));

// A name the database reserves, or one too long to be an address, is never used as a key
const isKey = (key: string): boolean => key.length > 0 && key.length <= 200 && !/^__.*__$/.test(key);

let reported = false;
/** A count that cannot be stored must never disturb the visitor. It is said once, for whoever looks. */
function report(error: unknown): void {
  if (reported) return;
  reported = true;
  console.warn("Besøkstellingen fikk ikke lagret:", error);
}

/** Adds to the sums of the day the moment falls on. Nothing is read first, so two visitors never overwrite each other. */
function add(at: Date, sums: Record<string, unknown>): void {
  const { date } = osloDayAndHour(at);
  try {
    setDoc(dayRef(date), { recordType: TRAFFIC_RECORD, date, ...sums }, { merge: true }).catch(report);
  } catch (error) {
    report(error);
  }
}

/** The recorder the public website counts with. */
export const siteTrafficRecorder: TrafficRecorder = {
  view(address, at, visit) {
    if (!isKey(address)) return;
    add(at, {
      views: { [address]: increment(1) },
      hours: { [String(osloDayAndHour(at).hour)]: increment(1) },
      ...(visit.entry ? { visits: increment(1), entries: { [address]: increment(1) } } : {}),
      ...(visit.second ? { deepVisits: increment(1) } : {}),
    });
  },
  seconds(address, at, seconds) {
    if (!isKey(address) || !(seconds > 0)) return;
    add(at, { seconds: { [address]: increment(Math.round(seconds)) } });
  },
  missing(address, at) {
    if (!isKey(address)) return;
    add(at, { missing: { [address]: increment(1) } });
  },
};

/** Counts a press on something the website offers. A played sermon is also counted on the sermon. */
export function recordTrafficAction(id: TrafficActionId, at: Date = new Date(), sermonId?: string): void {
  add(at, {
    actions: { [id]: increment(1) },
    ...(sermonId && isKey(sermonId) ? { sermons: { [sermonId]: increment(1) } } : {}),
  });
}

/**
 * Counts a sign-in (see services/auth.ts) or an opening of Min side (see hooks/useMinSideOpenCount.ts).
 * Stored in the day's actions, beside the website's, but kept apart from them when shown.
 */
export function recordLoginCount(id: LoginCountId | typeof MIN_SIDE_OPENED, at: Date = new Date()): void {
  add(at, { actions: { [id]: increment(1) } });
}

// The days are found by their names, which sort by date. No index has to be set up for that.
const daysBetween = (from: string, to: string) =>
  query(collection(db, CMS_COLLECTIONS.SETTINGS), where(documentId(), ">=", trafficDocId(from)), where(documentId(), "<=", trafficDocId(to)));
const allDays = () => query(collection(db, CMS_COLLECTIONS.SETTINGS), where("recordType", "==", TRAFFIC_RECORD));

const isDay = (day: TrafficDay | null): day is TrafficDay => day !== null;

/** Follows the counts of the days from `from` to `to`, both included. Returns the function that stops following. */
export function subscribeSiteTraffic(
  from: string,
  to: string,
  onChange: (days: TrafficDay[]) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(
    daysBetween(from, to),
    (snapshot) => onChange(snapshot.docs.map((d) => parseTrafficDay(d.data())).filter(isDay)),
    onError
  );
}

async function deleteDays(ids: string[]): Promise<number> {
  for (const piece of chunk(ids, BATCH_SIZE)) {
    const batch = writeBatch(db);
    for (const id of piece) batch.delete(doc(db, CMS_COLLECTIONS.SETTINGS, id));
    await batch.commit();
  }
  return ids.length;
}

/**
 * Deletes every visit count, so the counting starts over. There is no undo. Throws when the
 * app is in production (see operatingMode.ts): the counts are then a congregation's real ones.
 */
export async function clearSiteTraffic(): Promise<number> {
  await ensureDeletionAllowed();
  const snapshot = await getDocs(allDays());
  return deleteDays(snapshot.docs.map((d) => d.id));
}

/**
 * Puts example numbers in for the days given, for showing the board before there are visits to
 * count. A day that already has counts is left alone, so real numbers are never mixed with made
 * ones. Only in demo. Returns how many days were filled.
 */
export async function addExampleTraffic(days: TrafficDay[]): Promise<number> {
  if ((await readOperatingMode()) !== "demo") {
    throw new Error("Eksempeltall kan bare legges inn mens appen står i demo.");
  }
  const counted = new Set((await getDocs(allDays())).docs.map((d) => d.id));
  const fresh = days.filter((day) => !counted.has(trafficDocId(day.date)));
  for (const piece of chunk(fresh, BATCH_SIZE)) {
    const batch = writeBatch(db);
    for (const day of piece) batch.set(dayRef(day.date), { ...day, recordType: TRAFFIC_RECORD, simulated: true });
    await batch.commit();
  }
  return fresh.length;
}

/** Removes the example numbers and nothing else. Returns how many days were removed. */
export async function removeExampleTraffic(): Promise<number> {
  const snapshot = await getDocs(allDays());
  return deleteDays(snapshot.docs.filter((d) => d.data().simulated === true).map((d) => d.id));
}
