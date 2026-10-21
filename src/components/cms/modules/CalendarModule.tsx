import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useCms } from "../../../context/CmsContext";
import { locationOf } from "../../../utils/gatherings";
import { eventPath, teaserOf } from "../../../utils/gatheringPresentation";
import { objectPositionOf } from "../../../utils/focusPoint";
import { cardImageClass, revealClassOf, whatsOnGatherings, whatsOnOptionsOf, type WhatsOnOptions } from "../../../utils/whatsOn";
import { useMediaMap } from "../../../hooks/useMediaMap";
import { resolveMediaUrl } from "../../../utils/media";
import {
  MODULE_PRESENTATION_DEFAULTS,
  ModulePresentationConfig,
  presentationText,
} from "../../../utils/modulePresentation";
import { PresentationSection } from "../PresentationSection";
import { useRevealChildren } from "../../../hooks/useRevealChildren";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import type { Gathering } from "../../../types";

export interface CalendarModuleProps {
  presentation?: ModulePresentationConfig;
}

const formatDate = (dateStr: string) => {
  try {
    return new Intl.DateTimeFormat("no-NO", { weekday: "short", day: "numeric", month: "short" }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
};

const formatTime = (dateStr: string) => {
  try {
    return new Intl.DateTimeFormat("no-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date(dateStr));
  } catch {
    return "";
  }
};

/** How one event is drawn: a card with the picture on top, a large card, or a row with the picture beside. */
type CardShape = "card" | "large" | "row";

interface EventCardProps {
  item: Gathering;
  image: string;
  show: WhatsOnOptions;
  shape: CardShape;
  className?: string;
}

const EventCard: React.FC<EventCardProps> = ({ item, image, show, shape, className = "" }) => {
  const teaser = show.showSummary ? teaserOf(item) : "";
  // The focus point keeps the important place in view when the picture fills the card
  const focusStyle = show.imageFit === "cover" ? { objectPosition: objectPositionOf(item.imageFocus) } : undefined;
  const row = shape === "row";
  const footer = (show.showTime || show.showLocation) && (
    <div className={`${row ? "mt-2" : "pt-4 mt-3 border-t border-stone-100"} flex items-center justify-between gap-3 text-xs text-stone-600`}>
      {show.showTime && (
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          <span>Kl. {formatTime(item.startsAt)}</span>
        </div>
      )}
      {show.showLocation && (
        <div className="flex items-center gap-1.5 truncate max-w-[160px]">
          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span className="truncate">{locationOf(item)}</span>
        </div>
      )}
    </div>
  );
  const words = (
    <>
      <div className="text-[11px] font-bold uppercase tracking-wider text-primary-700">{formatDate(item.startsAt)}</div>
      {item.cancelled && (
        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Avlyst</span>
      )}
      <h4 className={`font-bold text-stone-900 leading-snug ${shape === "large" ? "text-xl sm:text-2xl" : "text-base"}`}>{item.title}</h4>
      {teaser && <p className={`text-stone-500 ${shape === "large" ? "text-sm line-clamp-3" : "text-xs line-clamp-2"}`}>{teaser}</p>}
    </>
  );

  return (
    <Link
      to={eventPath(item.id)}
      data-whats-on-card={shape}
      data-gathering-id={item.id}
      className={`bg-white rounded-xl border hover:border-primary-300 hover:shadow-md transition-all overflow-hidden ${
        item.cancelled ? "border-red-200 bg-red-50/20 opacity-75" : "border-stone-200/80"
      } ${row ? "flex gap-4 p-3 items-center" : "p-5 flex flex-col justify-between min-h-[180px]"} ${className}`}
    >
      {row ? (
        <>
          {image && (
            <div className="w-28 sm:w-40 shrink-0 aspect-video rounded-lg overflow-hidden bg-stone-100">
              <img src={image} alt={item.imageAlt?.trim() || ""} loading="lazy" className={cardImageClass(show.imageFit)} style={focusStyle} />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            {words}
            {footer}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            {image && (
              <div className={`-mx-5 -mt-5 mb-3 bg-stone-100 ${shape === "large" ? "aspect-[16/10]" : "aspect-video"}`}>
                <img src={image} alt={item.imageAlt?.trim() || ""} loading="lazy" className={cardImageClass(show.imageFit)} style={focusStyle} />
              </div>
            )}
            {words}
          </div>
          {footer}
        </>
      )}
    </Link>
  );
};

/** Columns on a large screen: three for three or six cards, four otherwise, so no row is left half full. */
const gridColumns = (count: number) => (count === 3 || count === 6 ? "lg:grid-cols-3" : "lg:grid-cols-4");

/** «Hva skjer»: de neste offentlige arrangementene, hvert som et kort som åpner arrangementets egen side. */
export const CalendarModule: React.FC<CalendarModuleProps> = ({ presentation }) => {
  const { gatherings } = useFirebase();
  const { settings } = useCms();
  const mediaById = useMediaMap();
  const config = presentation || MODULE_PRESENTATION_DEFAULTS["module-calendar"];
  const options = whatsOnOptionsOf(config);
  const upcomingEvents = useMemo(() => whatsOnGatherings(gatherings, Date.now(), options), [gatherings, options.count, options.selection, options.groupId]);
  const cards = useRevealChildren<HTMLDivElement>(upcomingEvents.length);
  const title = presentationText(config, "title", `Hva skjer i ${settings.churchName}`);
  // An event without a picture of its own gets the module's standard picture, when one is chosen
  const imageOf = (item: Gathering) => resolveMediaUrl(item.imageUrl?.trim() || options.fallbackImage, mediaById, "web");
  const reveal = revealClassOf(options.motion);
  // The carousel moves most of its width at a time, so the next cards come in and the last one stays as a guide
  const browse = (direction: 1 | -1) => cards.current?.scrollBy({ left: direction * cards.current.clientWidth * 0.8, behavior: "smooth" });

  const body = () => {
    switch (options.layout) {
      case "list":
        return (
          <div ref={cards} data-whats-on-layout="list" className={`${reveal} grid grid-cols-1 gap-3`}>
            {upcomingEvents.map((item) => (
              <EventCard key={item.id} item={item} image={imageOf(item)} show={options} shape="row" />
            ))}
          </div>
        );
      case "carousel":
        return (
          <div className="relative">
            <div
              ref={cards}
              data-whats-on-layout="carousel"
              className={`${reveal} flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 [scrollbar-width:thin]`}
            >
              {upcomingEvents.map((item) => (
                <EventCard
                  key={item.id}
                  item={item}
                  image={imageOf(item)}
                  show={options}
                  shape="card"
                  className="snap-start shrink-0 w-[82%] sm:w-[46%] lg:w-[calc(25%-12px)]"
                />
              ))}
            </div>
            {upcomingEvents.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => browse(-1)}
                  aria-label="Forrige arrangementer"
                  className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white border border-stone-200 shadow-md text-stone-700 hover:bg-stone-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => browse(1)}
                  aria-label="Neste arrangementer"
                  className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white border border-stone-200 shadow-md text-stone-700 hover:bg-stone-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        );
      case "feature": {
        const [first, ...rest] = upcomingEvents;
        return (
          <div ref={cards} data-whats-on-layout="feature" className={`${reveal} grid grid-cols-1 md:grid-cols-2 gap-4`}>
            <EventCard item={first} image={imageOf(first)} show={options} shape="large" />
            {rest.length > 0 && (
              <div className="grid grid-cols-1 gap-3 content-start">
                {rest.map((item) => (
                  <EventCard key={item.id} item={item} image={imageOf(item)} show={options} shape="row" />
                ))}
              </div>
            )}
          </div>
        );
      }
      default:
        return (
          <div ref={cards} data-whats-on-layout="grid" className={`${reveal} grid grid-cols-1 md:grid-cols-2 ${gridColumns(options.count)} gap-4`}>
            {upcomingEvents.map((item) => (
              <EventCard key={item.id} item={item} image={imageOf(item)} show={options} shape="card" />
            ))}
          </div>
        );
    }
  };

  return (
    <PresentationSection config={config} className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 my-10">
      <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">{title}</h3>
      {upcomingEvents.length === 0 ? (
        <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200 text-stone-500 text-xs">
          Ingen kommende arrangementer registrert for øyeblikket.
        </div>
      ) : (
        body()
      )}
    </PresentationSection>
  );
};
