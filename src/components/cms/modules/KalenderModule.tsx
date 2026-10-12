import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { eventPath } from "../../../utils/gatheringPresentation";
import { useMediaMap } from "../../../hooks/useMediaMap";
import { resolveMediaUrl } from "../../../utils/media";
import { useFirebase } from "../../../context/FirebaseDataContext";
import { useCms } from "../../../context/CmsContext";
import { isWorshipService, locationOf, upcomingPublicGatherings } from "../../../utils/gatherings";
import { buildMonthGrid, monthLabel } from "../../../utils/calendarMonth";
import {
  MODULE_PRESENTATION_DEFAULTS,
  ModulePresentationConfig,
  presentationText,
} from "../../../utils/modulePresentation";
import { PresentationSection } from "../PresentationSection";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  MapPin,
} from "lucide-react";

export const PUBLIC_CALENDAR_FEED_PATH = "/api/offentlig/kalender.ics";

const WEEKDAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export interface KalenderModuleProps {
  variant?: "month" | "list";
  presentation?: ModulePresentationConfig;
}

export const KalenderModule: React.FC<KalenderModuleProps> = ({
  variant = "month",
  presentation,
}) => {
  const { gatherings } = useFirebase();
  const { settings } = useCms();
  const mediaById = useMediaMap();
  const config = presentation || MODULE_PRESENTATION_DEFAULTS["module-kalender"];
  const defaults = MODULE_PRESENTATION_DEFAULTS["module-kalender"];

  const [view, setView] = useState<"month" | "list">(variant);
  const [monthOffset, setMonthOffset] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const allEvents = useMemo(
    () => upcomingPublicGatherings(gatherings, startOfToday),
    [gatherings, startOfToday]
  );

  const monthEvents = useMemo(() => {
    const start = new Date(monthOffset.year, monthOffset.month, 1).getTime();
    const end = new Date(monthOffset.year, monthOffset.month + 1, 0, 23, 59, 59, 999).getTime();
    return allEvents.filter((g) => {
      const t = new Date(g.startsAt).getTime();
      return t >= start && t <= end;
    });
  }, [allEvents, monthOffset]);

  const grid = useMemo(
    () => buildMonthGrid(monthOffset.year, monthOffset.month, monthEvents),
    [monthOffset, monthEvents]
  );

  const badge = presentationText(config, "badge", defaults.badge);
  const title = presentationText(config, "title", `Hva skjer i ${settings.churchName}`);

  const formatDateLong = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat("no-NO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat("no-NO", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(dateStr));
    } catch {
      return "";
    }
  };

  const shiftMonth = (delta: number) => {
    setMonthOffset((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const eventPillClass = (g: { isGudstjeneste?: boolean; cancelled?: boolean }) => {
    if (g.cancelled) return "bg-red-100 text-red-800 border-red-200";
    if (isWorshipService(g)) return "bg-primary-600 text-white border-primary-700";
    return "bg-accent-600 text-white border-accent-700";
  };

  return (
    <PresentationSection
      config={config}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 my-10"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary-700">{badge}</h2>
          <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight mt-1">{title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                view === "list" ? "bg-primary-700 text-white" : "text-stone-600 hover:bg-stone-50"
              }`}
              aria-pressed={view === "list"}
            >
              <List className="w-3.5 h-3.5" />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                view === "month" ? "bg-primary-700 text-white" : "text-stone-600 hover:bg-stone-50"
              }`}
              aria-pressed={view === "month"}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Måned
            </button>
          </div>
          <a
            href={`${typeof window !== "undefined" ? window.location.origin : ""}${PUBLIC_CALENDAR_FEED_PATH}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-primary-700 border border-primary-200 bg-primary-50 hover:bg-primary-100"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Abonner på kalenderen</span>
          </a>
        </div>
      </div>

      {allEvents.length === 0 ? (
        <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200 text-stone-500 text-xs">
          Ingen kommende arrangementer registrert i kalenderen for øyeblikket.
        </div>
      ) : view === "list" ? (
        <div className="bg-white rounded-2xl border border-stone-200/80 divide-y divide-stone-100 shadow-xs overflow-hidden">
          {allEvents.map((item) => {
            const thumbnail = resolveMediaUrl(item.imageUrl, mediaById, "thumb");
            const lead = item.summary?.trim();
            return (
            <Link
              key={item.id}
              to={eventPath(item.id)}
              className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-stone-50/80 transition-colors ${
                item.cancelled ? "opacity-75 bg-red-50/20" : ""
              }`}
            >
              {thumbnail && (
                <img src={thumbnail} alt={item.imageAlt?.trim() || ""} loading="lazy" className="w-full md:w-40 aspect-video object-cover rounded-xl shrink-0 bg-stone-100" />
              )}
              <div className="space-y-1 flex-1 min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-primary-700 capitalize block">
                  {formatDateLong(item.startsAt)}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xl font-black text-stone-900 leading-snug">{item.title}</h4>
                  {item.cancelled && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                      Avlyst
                    </span>
                  )}
                </div>
                {item.theme && (
                  <p className="text-sm text-stone-600">
                    <span className="font-semibold text-stone-800">Tema: </span>
                    {item.theme}
                    {item.bibleText ? ` (${item.bibleText})` : ""}
                  </p>
                )}
                {lead && <p className="text-sm text-stone-600 line-clamp-2">{lead}</p>}
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2 text-xs text-stone-600 shrink-0">
                <div className="flex items-center gap-1.5 font-bold text-stone-800 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200/60">
                  <Clock className="w-3.5 h-3.5 text-primary-600" />
                  <span>Kl. {formatTime(item.startsAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  <span>{locationOf(item)}</span>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-stone-200">
            <h4 className="text-lg font-black text-stone-900 capitalize">
              {monthLabel(monthOffset.year, monthOffset.month)}
            </h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 cursor-pointer"
                aria-label="Forrige måned"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 cursor-pointer"
                aria-label="Neste måned"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-2 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-stone-500 text-center"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((cell) => (
              <div
                key={cell.date.toISOString()}
                className={`min-h-[88px] sm:min-h-[110px] border-b border-r border-stone-100 p-1.5 sm:p-2 ${
                  cell.inMonth ? "bg-white" : "bg-stone-50/60"
                }`}
              >
                <div className="flex justify-start mb-1">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full ${
                      cell.isToday
                        ? "bg-primary-700 text-white"
                        : cell.inMonth
                        ? "text-stone-800"
                        : "text-stone-300"
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {cell.events.slice(0, 3).map((event) => (
                    <Link
                      key={event.id}
                      to={eventPath(event.id)}
                      className={`block px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold truncate border hover:underline ${eventPillClass(event)}`}
                      title={event.title}
                    >
                      {event.title}
                    </Link>
                  ))}
                  {cell.events.length > 3 && (
                    <div className="text-[9px] text-stone-400 font-medium px-1">
                      +{cell.events.length - 3} til
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PresentationSection>
  );
};
