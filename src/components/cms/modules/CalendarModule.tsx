import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useCms } from "../../../context/CmsContext";
import { locationOf, upcomingPublicGatherings } from "../../../utils/gatherings";
import { eventPath, teaserOf } from "../../../utils/gatheringPresentation";
import { useMediaMap } from "../../../hooks/useMediaMap";
import { resolveMediaUrl } from "../../../utils/media";
import {
  MODULE_PRESENTATION_DEFAULTS,
  ModulePresentationConfig,
  presentationText,
} from "../../../utils/modulePresentation";
import { PresentationSection } from "../PresentationSection";
import { useRevealChildren } from "../../../hooks/useRevealChildren";
import { Clock, MapPin } from "lucide-react";

export interface CalendarModuleProps {
  presentation?: ModulePresentationConfig;
}

/** «Hva skjer»: de fire neste offentlige arrangementene, hvert som et kort som åpner arrangementets egen side. */
export const CalendarModule: React.FC<CalendarModuleProps> = ({ presentation }) => {
  const { gatherings } = useFirebase();
  const { settings } = useCms();
  const mediaById = useMediaMap();
  const config = presentation || MODULE_PRESENTATION_DEFAULTS["module-calendar"];

  const upcomingEvents = useMemo(
    () => upcomingPublicGatherings(gatherings, Date.now()).slice(0, 4),
    [gatherings]
  );
  const cards = useRevealChildren<HTMLDivElement>(upcomingEvents.length);

  const title = presentationText(config, "title", `Hva skjer i ${settings.churchName}`);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("no-NO", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("no-NO", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return "";
    }
  };

  return (
    <PresentationSection
      config={config}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 my-10"
    >
      <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">{title}</h3>

      {upcomingEvents.length === 0 ? (
        <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200 text-stone-500 text-xs">
          Ingen kommende arrangementer registrert for øyeblikket.
        </div>
      ) : (
        <div ref={cards} className="reveal-children grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {upcomingEvents.map((item) => {
            const image = resolveMediaUrl(item.imageUrl, mediaById, "web");
            const teaser = teaserOf(item);
            return (
            <Link
              key={item.id}
              to={eventPath(item.id)}
              className={`bg-white rounded-xl border p-5 hover:border-primary-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[180px] overflow-hidden ${
                item.cancelled ? "border-red-200 bg-red-50/20 opacity-75" : "border-stone-200/80"
              }`}
            >
              <div className="space-y-2">
                {/* The whole picture is shown, in the shape posters are made in, so a text in it is not cut */}
                {image && (
                  <div className="-mx-5 -mt-5 mb-3 aspect-video bg-stone-100">
                    <img src={image} alt={item.imageAlt?.trim() || ""} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary-700">
                  {formatDate(item.startsAt)}
                </div>
                {item.cancelled && (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                    Avlyst
                  </span>
                )}
                <h4 className="font-bold text-stone-900 text-base leading-snug">{item.title}</h4>
                {teaser && <p className="text-xs text-stone-500 line-clamp-2">{teaser}</p>}
              </div>

              <div className="pt-4 mt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>Kl. {formatTime(item.startsAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">{locationOf(item)}</span>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </PresentationSection>
  );
};
