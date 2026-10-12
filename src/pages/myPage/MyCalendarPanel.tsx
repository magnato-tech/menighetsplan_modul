import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, X } from "lucide-react";
import { CalendarSubscribeButtons } from "../../components/public/CalendarSubscribeButtons";
import { useFirebase } from "../../context/FirebaseDataContext";
import { useCurrentUser } from "../../hooks/memberHooks";
import { DEMO } from "../../demo";
import { DEMO_SITE } from "../../demoSite";
import { ensurePersonalCalendarFeedToken } from "../../services/personalCalendarFeed";
import { formatNorwegianDateTime } from "../../utils/dates";
import { locationOf } from "../../utils/gatherings";
import {
  filterPersonalCalendarEvents,
  personalCalendarEvents,
  personalCalendarFeedUrl,
  PersonalCalendarFilter,
} from "../../utils/personalCalendar";

interface MyCalendarPanelProps {
  onClose: () => void;
}

const FILTERS: { id: PersonalCalendarFilter; label: string }[] = [
  { id: "alle", label: "Alle" },
  { id: "menigheten", label: "Menigheten" },
  { id: "mine_grupper", label: "Mine grupper" },
];

export const MyCalendarPanel: React.FC<MyCalendarPanelProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { currentUser, userGroups } = useCurrentUser();
  const { gatherings, getPersonAttendance, updatePerson } = useFirebase();
  const [filter, setFilter] = useState<PersonalCalendarFilter>("alle");
  const [feedToken, setFeedToken] = useState<string | null>(currentUser.calendarFeedToken ?? null);

  useEffect(() => {
    if (currentUser.calendarFeedToken) setFeedToken(currentUser.calendarFeedToken);
  }, [currentUser.calendarFeedToken, currentUser.id]);

  const from = useMemo(() => Date.now(), []);

  const allEvents = useMemo(
    () =>
      personalCalendarEvents(gatherings, userGroups, from, (gatheringId) =>
        getPersonAttendance(gatheringId, currentUser.id)
      ),
    [gatherings, userGroups, from, getPersonAttendance, currentUser.id]
  );

  const visibleEvents = useMemo(
    () => filterPersonalCalendarEvents(allEvents, filter),
    [allEvents, filter]
  );

  const openEvent = (gatheringId: string) => {
    onClose();
    navigate(`/samling/${gatheringId}`);
  };

  const resolveFeedToken = (): string | null => {
    if (feedToken) return feedToken;
    if (currentUser.calendarFeedToken) return currentUser.calendarFeedToken;
    const ensured = ensurePersonalCalendarFeedToken(currentUser, updatePerson);
    if (!ensured.success) return null;
    setFeedToken(ensured.token);
    return ensured.token;
  };

  const feedUrlFor = () => {
    const token = resolveFeedToken();
    if (!token) return null;
    return personalCalendarFeedUrl(window.location.origin, token, DEMO_SITE, DEMO !== null);
  };

  return (
    <div
      id="modal-my-calendar"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
    >
      <div className="w-full max-w-md bg-slate-50 rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Min kalender</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Lukk kalender"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 bg-white border-b border-slate-200 space-y-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 space-y-2">
            <p className="text-[11px] text-slate-700 leading-relaxed">
              Abonner på det du ser her i Google Kalender eller annen kalenderapp. Oppdateringen skjer automatisk, ofte med noen
              timers mellomrom.
            </p>
            <CalendarSubscribeButtons tone="emerald" resolveFeedUrl={feedUrlFor} />
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 w-full">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  filter === item.id
                    ? "bg-emerald-700 text-white"
                    : "text-slate-600 hover:bg-white"
                }`}
                aria-pressed={filter === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {visibleEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
              <p className="font-bold text-slate-700">Ingen hendelser</p>
              <p>Det finnes ingen kommende hendelser i dette filteret.</p>
            </div>
          ) : (
            visibleEvents.map((event) => (
              <button
                key={event.gathering.id}
                type="button"
                onClick={() => openEvent(event.gathering.id)}
                className={`w-full text-left p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 hover:border-emerald-300 transition-colors cursor-pointer ${
                  event.gathering.cancelled ? "opacity-75 bg-red-50/30 border-red-100" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                        event.source === "menigheten"
                          ? "text-emerald-800 bg-emerald-50 border-emerald-100"
                          : "text-slate-700 bg-slate-100 border-slate-200"
                      }`}
                    >
                      {event.source === "menigheten" ? "Menigheten" : event.groupName || "Gruppe"}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {event.gathering.title}
                    </h4>
                  </div>
                  {event.gathering.cancelled && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
                      Avlyst
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-900">
                      {formatNorwegianDateTime(event.gathering.startsAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{locationOf(event.gathering)}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
