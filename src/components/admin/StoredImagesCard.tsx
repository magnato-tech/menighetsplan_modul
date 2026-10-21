import React, { useMemo, useState } from "react";
import { HardDriveUpload } from "lucide-react";
import { useCms } from "../../context/CmsContext";
import { uploadStoredImage } from "../../services/mediaStorage";
import { findStoredImages, storedImagesIn, withStoredImagesReplaced, type StoredImagePlace } from "../../utils/storedImages";

type Doc = { id: string } & Record<string, unknown>;

/**
 * Under Mediebibliotek: pictures that are still kept as text inside pages, articles, talks and the
 * settings, from before pictures went to the picture store. One press uploads each of them once and
 * puts its address in its place. A page saved this way keeps its earlier version, as any save does.
 */
export const StoredImagesCard: React.FC = () => {
  const { pages, news, sermons, staff, settings, savePage, saveNews, saveSermon, saveStaff, saveSettings } = useCms();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const docsOf = (kind: StoredImagePlace["kind"]): Doc[] => {
    if (kind === "page") return pages as unknown as Doc[];
    if (kind === "news") return news as unknown as Doc[];
    if (kind === "sermon") return sermons as unknown as Doc[];
    if (kind === "staff") return staff as unknown as Doc[];
    return [{ ...(settings as unknown as Record<string, unknown>), id: "global", title: "Nettside-innstillinger" }];
  };

  const places = useMemo(
    () => (["page", "news", "sermon", "staff", "settings"] as const).flatMap((kind) => findStoredImages(kind, docsOf(kind))),
    [pages, news, sermons, staff, settings]
  );
  const images = useMemo(() => {
    const all = places.flatMap((place) => {
      const doc = docsOf(place.kind).find((d) => d.id === place.id);
      return place.fields.flatMap((field) => storedImagesIn(doc?.[field]));
    });
    return [...new Set(all)];
  }, [places]);

  if (images.length === 0 && !result) return null;

  const save = (place: StoredImagePlace, doc: Doc, patch: Record<string, unknown>): Promise<boolean> => {
    const next = { ...doc, ...patch };
    if (place.kind === "page") return savePage(next);
    if (place.kind === "news") return saveNews(next);
    if (place.kind === "sermon") return saveSermon(next);
    if (place.kind === "staff") return saveStaff(next);
    const { id: _id, title: _title, ...fields } = next;
    return saveSettings(fields);
  };

  const move = async () => {
    setResult(null);
    const addresses = new Map<string, string>();
    let failed = 0;
    for (const [index, image] of images.entries()) {
      setProgress({ done: index, total: images.length });
      try {
        addresses.set(image, await uploadStoredImage(image));
      } catch {
        failed++;
      }
    }
    setProgress({ done: images.length, total: images.length });
    let saved = 0;
    for (const place of places) {
      const doc = docsOf(place.kind).find((d) => d.id === place.id);
      if (!doc) continue;
      if (await save(place, doc, withStoredImagesReplaced(doc, place.fields, addresses))) saved++;
    }
    setProgress(null);
    setResult(
      failed === 0
        ? `${addresses.size} ${addresses.size === 1 ? "bilde" : "bilder"} er flyttet til bildelageret, og ${saved} ${saved === 1 ? "sted" : "steder"} er oppdatert.`
        : `${addresses.size} bilder er flyttet. ${failed} kunne ikke lastes opp og står som før; prøv igjen.`
    );
  };

  return (
    <section className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-3" data-stored-images>
      <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
        <HardDriveUpload className="w-4 h-4 text-[var(--studio-icon)]" />
        <span>Bilder lagret inne i sidene</span>
      </h3>
      {images.length > 0 ? (
        <>
          <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
            {images.length === 1 ? "Ett bilde" : `${images.length} bilder`} er lagret som tekst inne i{" "}
            {places.map((place) => `«${place.title}»`).join(", ")}. Det gjør nettsiden tyngre, og bildet kan ikke deles på Facebook.
            Flytt dem til bildelageret; sidene ser ut som før.
          </p>
          <button
            type="button"
            onClick={move}
            disabled={progress !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {progress ? `Flytter ${Math.min(progress.done + 1, progress.total)} av ${progress.total} …` : "Flytt til bildelageret"}
          </button>
        </>
      ) : null}
      {result && <p className="text-xs text-[var(--studio-text)]">{result}</p>}
    </section>
  );
};
