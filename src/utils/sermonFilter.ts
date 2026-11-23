// Search and filters for the sermon list in the admin («Taler & Prekener»).

import type { CmsSermon } from "../data/cmsData";

export interface SermonFilter {
  /** Free text, matched against title, speaker and bible text. Empty matches all. */
  query?: string;
  /** Exact series name. Empty or missing means all. */
  series?: string;
  /** Exact speaker name. Empty or missing means all. */
  speaker?: string;
  /** Exact year as text, e.g. "2026". Empty or missing means all. */
  year?: string;
}

export interface SermonFilterOptions {
  series: string[];
  speakers: string[];
  /** Newest first. */
  years: string[];
}

/** The speaker name shown for a sermon: the speaker, or else the guest speaker. */
export function sermonSpeakerOf(s: Pick<CmsSermon, "speaker" | "guestSpeakerName">): string {
  return s.speaker || s.guestSpeakerName || "";
}

/** The year of a sermon's date as text, or "" when the date is not valid. */
function yearOf(s: Pick<CmsSermon, "date">): string {
  const time = Date.parse(s.date);
  return Number.isNaN(time) ? "" : String(new Date(time).getFullYear());
}

/** Lower case, accents removed, and the Norwegian letters ø and æ written as o and ae. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae");
}

/** The values the three filter lists can show, sorted. */
export function sermonFilterOptions(sermons: CmsSermon[]): SermonFilterOptions {
  const series = new Set<string>();
  const speakers = new Set<string>();
  const years = new Set<string>();
  for (const s of sermons) {
    const seriesName = (s.series || "").trim();
    if (seriesName) series.add(seriesName);
    const speaker = sermonSpeakerOf(s).trim();
    if (speaker) speakers.add(speaker);
    const year = yearOf(s);
    if (year) years.add(year);
  }
  return {
    series: [...series].sort((a, b) => a.localeCompare(b, "nb")),
    speakers: [...speakers].sort((a, b) => a.localeCompare(b, "nb")),
    years: [...years].sort((a, b) => Number(b) - Number(a)),
  };
}

/** The sermons that pass the filter, newest first. */
export function filterSermons(sermons: CmsSermon[], filter: SermonFilter = {}): CmsSermon[] {
  const query = fold((filter.query ?? "").trim());
  const series = filter.series ?? "";
  const speaker = filter.speaker ?? "";
  const year = filter.year ?? "";

  return sermons
    .filter((s) => {
      if (query) {
        const fields = [s.title, sermonSpeakerOf(s), s.bibleText ?? ""];
        if (!fields.some((field) => fold(field).includes(query))) return false;
      }
      if (series && (s.series ?? "") !== series) return false;
      if (speaker && sermonSpeakerOf(s) !== speaker) return false;
      if (year && yearOf(s) !== year) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || 0);
}
