import React from "react";
import {
  MODULE_PRESENTATION_DEFAULTS,
  ModulePresentationConfig,
  presentationText,
} from "../../../utils/modulePresentation";

export interface MapModuleProps {
  variant?: string;
  presentation?: ModulePresentationConfig;
}

// Heights in pixels per variant. An unknown variant gets the middle height.
const MAP_HEIGHTS: Record<string, number> = { small: 240, medium: 360, large: 480 };

/** Only real numbers reach the map URL, so a bad stored value cannot change the link. */
function coordinate(value: string | undefined): number | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

export const MapModule: React.FC<MapModuleProps> = ({ variant, presentation }) => {
  const config = presentation || MODULE_PRESENTATION_DEFAULTS["module-map"];
  const defaults = MODULE_PRESENTATION_DEFAULTS["module-map"];

  const title = presentationText(config, "title", defaults.title);
  const address = (config.address || "").trim();
  if (!address) return null;

  const lat = coordinate(config.lat);
  const lon = coordinate(config.lon);
  const height = MAP_HEIGHTS[variant ?? ""] ?? MAP_HEIGHTS.medium;

  // Without a found position there is no map to draw, only a search link
  const hasPoint = lat !== null && lon !== null;
  const embedSrc = hasPoint
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01},${lat - 0.006},${lon + 0.01},${lat + 0.006}&layer=mapnik&marker=${lat},${lon}`
    : null;
  const openLink = hasPoint
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 my-12 space-y-4">
      <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">{title}</h3>

      {embedSrc && (
        <div
          className="w-full rounded-2xl overflow-hidden border border-stone-200 shadow-sm"
          style={{ height }}
        >
          {/* No referrer is sent to the map provider, in line with the no-cookies promise */}
          <iframe
            title={`Kart: ${address}`}
            src={embedSrc}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full border-0"
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-stone-600">
        <span>{address}</span>
        <a
          href={openLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent-700 hover:underline"
        >
          Åpne i kart
        </a>
      </div>
    </section>
  );
};
