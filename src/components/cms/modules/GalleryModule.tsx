import React, { useEffect, useState } from "react";
import {
  MODULE_PRESENTATION_DEFAULTS,
  ModulePresentationConfig,
  parseGalleryImages,
  presentationText,
} from "../../../utils/modulePresentation";
import { useMediaMap } from "../../../hooks/useMediaMap";
import { resolveMediaUrl } from "../../../utils/media";

export interface GalleryModuleProps {
  presentation?: ModulePresentationConfig;
}

/** Moves through the pictures and wraps around at either end. */
function nextIndex(index: number, delta: number, count: number): number {
  return (index + delta + count) % count;
}

export const GalleryModule: React.FC<GalleryModuleProps> = ({ presentation }) => {
  const config = presentation || MODULE_PRESENTATION_DEFAULTS["module-gallery"];
  const defaults = MODULE_PRESENTATION_DEFAULTS["module-gallery"];
  const mediaById = useMediaMap();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const title = presentationText(config, "title", defaults.title);
  // A picture whose library item is gone resolves to "" and is left out
  const pictures = parseGalleryImages(config.images)
    .map((image) => ({
      caption: image.caption,
      url: resolveMediaUrl(image.src, mediaById, "web"),
      thumb: resolveMediaUrl(image.src, mediaById, "thumb"),
    }))
    .filter((picture) => picture.url);
  const count = pictures.length;

  // Arrow keys and Escape work while the picture is open
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
      else if (event.key === "ArrowRight") setOpenIndex((index) => (index === null ? null : nextIndex(index, 1, count)));
      else if (event.key === "ArrowLeft") setOpenIndex((index) => (index === null ? null : nextIndex(index, -1, count)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, count]);

  // An empty gallery has nothing to show on the site
  if (count === 0) return null;

  const open = openIndex === null ? undefined : pictures[openIndex];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 my-12 space-y-6">
      <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">{title}</h3>

      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {pictures.map((picture, index) => (
          <li key={`${index}-${picture.url}`}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={picture.caption ? `Vis bilde: ${picture.caption}` : `Vis bilde ${index + 1}`}
              className="block w-full aspect-square overflow-hidden rounded-xl bg-stone-100 cursor-zoom-in"
            >
              <img
                src={picture.thumb || picture.url}
                alt={picture.caption}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {open && openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bildevisning"
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          // A press on the dark background closes the picture, a press on the picture itself does not
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpenIndex(null);
          }}
        >
          <img src={open.url} alt={open.caption} className="max-h-[75vh] max-w-full object-contain" />
          {open.caption && <p className="mt-3 text-center text-sm text-white">{open.caption}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              aria-label="Forrige"
              onClick={() => setOpenIndex(nextIndex(openIndex, -1, count))}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Forrige
            </button>
            <span className="text-xs text-stone-300">
              {openIndex + 1} / {count}
            </span>
            <button
              type="button"
              aria-label="Neste"
              onClick={() => setOpenIndex(nextIndex(openIndex, 1, count))}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Neste
            </button>
            <button
              type="button"
              aria-label="Lukk"
              onClick={() => setOpenIndex(null)}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Lukk
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
