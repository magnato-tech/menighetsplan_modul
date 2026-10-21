import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Calendar, CalendarPlus, CheckCircle2, Clock, ExternalLink, MapPin } from "lucide-react";
import { CmsContentRenderer } from "../../components/cms/CmsContentRenderer";
import { useCms } from "../../context/CmsContext";
import { useFirebase } from "../../context/FirebaseDataContext";
import { useResolvedMediaUrl } from "../../hooks/useMediaMap";
import { toIcalendarEvent } from "../../utils/calendarFeed";
import { isOpenCommunityGathering, isWorshipService, locationOf, ONGOING_MS } from "../../utils/gatherings";
import { objectPositionOf } from "../../utils/focusPoint";

const dayOf = (moment: string): string =>
  new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(moment));
const clockOf = (moment: string): string => new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date(moment));

/** When the event is, said in a line: the day, and the time it starts and, when it is given, ends. */
function whenOf(startsAt: string, endsAt?: string): { day: string; time: string } {
  if (!endsAt) return { day: dayOf(startsAt), time: `Kl. ${clockOf(startsAt)}` };
  const sameDay = dayOf(startsAt) === dayOf(endsAt);
  return sameDay
    ? { day: dayOf(startsAt), time: `Kl. ${clockOf(startsAt)}–${clockOf(endsAt)}` }
    : { day: `${dayOf(startsAt)} – ${dayOf(endsAt)}`, time: `Fra kl. ${clockOf(startsAt)} til kl. ${clockOf(endsAt)}` };
}

/**
 * An event's own page on the website: what the planner knows about it (when, where, whether it
 * is cancelled), and how it is presented (picture, lead, text and a link, see
 * utils/gatheringPresentation.ts). Every card and calendar entry for the event leads here.
 *
 * Only an event open to everyone has a page. One that is over keeps its page, and says so.
 */
export const PublicEventPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { gatherings, gatheringsReady } = useFirebase();
  const { news, settings } = useCms();

  const found = gatherings.find((gathering) => gathering.id === id);
  const event = found && isOpenCommunityGathering(found) ? found : undefined;
  const image = useResolvedMediaUrl(event?.imageUrl);

  // What is over is settled once, when the page is drawn
  const now = useMemo(() => Date.now(), []);
  const calendarFile = useMemo(
    () => (event ? `data:text/calendar;charset=utf-8,${encodeURIComponent(toIcalendarEvent(event, { calendarName: settings.churchName, siteUrl: window.location.origin }))}` : ""),
    [event, settings.churchName]
  );

  if (!event) {
    // Until the events have arrived, nothing can be said to be missing
    if (!gatheringsReady) return <p className="max-w-3xl mx-auto px-4 py-16 text-sm text-stone-500">Laster …</p>;
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black text-stone-900">Arrangementet ble ikke funnet</h1>
        <p className="text-sm text-stone-600">Arrangementet kan være flyttet eller tatt ut av kalenderen.</p>
        <Link to="/hva-skjer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
          <ArrowLeft className="w-4 h-4" />
          <span>Se kalenderen</span>
        </Link>
      </div>
    );
  }

  const when = whenOf(event.startsAt, event.endsAt);
  const over = new Date(event.endsAt || event.startsAt).getTime() + (event.endsAt ? 0 : ONGOING_MS) < now;
  const related = news.filter((article) => article.gatheringRefId === event.id && article.isPublished !== false);
  const link = event.linkUrl?.trim();
  const linkLabel = event.linkLabel?.trim() || "Les mer";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8">
      <div>
        <Link to="/hva-skjer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Tilbake til kalenderen</span>
        </Link>
      </div>

      <header className="space-y-4">
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-50 text-primary-800">
          {isWorshipService(event) ? "Gudstjeneste" : "Arrangement"}
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 tracking-tight leading-tight">{event.title}</h1>

        {/* Said with an icon and in words, never by colour alone */}
        {event.cancelled && (
          <p role="status" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm font-bold text-red-800">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            Arrangementet er avlyst
          </p>
        )}
        {!event.cancelled && over && (
          <p role="status" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-stone-100 border border-stone-200 text-sm font-semibold text-stone-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            Arrangementet er holdt
          </p>
        )}

        {event.summary?.trim() && <p className="text-lg text-stone-600 font-medium leading-relaxed">{event.summary.trim()}</p>}
      </header>

      {image && <img src={image} alt={event.imageAlt?.trim() || ""} style={{ objectPosition: objectPositionOf(event.imageFocus) }} className="w-full aspect-video object-cover rounded-2xl border border-stone-200 bg-stone-100" />}

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-white border border-stone-200/80">
          <Calendar className="w-4 h-4 mt-0.5 text-primary-600 shrink-0" aria-hidden="true" />
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Dato</dt>
            <dd className="font-semibold text-stone-900 capitalize">{when.day}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-white border border-stone-200/80">
          <Clock className="w-4 h-4 mt-0.5 text-primary-600 shrink-0" aria-hidden="true" />
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Tid</dt>
            <dd className="font-semibold text-stone-900">{when.time}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-white border border-stone-200/80">
          <MapPin className="w-4 h-4 mt-0.5 text-primary-600 shrink-0" aria-hidden="true" />
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Sted</dt>
            <dd className="font-semibold text-stone-900">{locationOf(event)}</dd>
          </div>
        </div>
      </dl>

      {event.theme?.trim() && (
        <p className="flex items-start gap-2 text-sm text-stone-700">
          <BookOpen className="w-4 h-4 mt-0.5 text-primary-600 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold text-stone-900">Tema:</span> {event.theme.trim()}
            {event.bibleText?.trim() ? ` (${event.bibleText.trim()})` : ""}
          </span>
        </p>
      )}

      {event.content?.trim() && (
        <article className="text-sm sm:text-base">
          <CmsContentRenderer content={event.content} />
        </article>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {link &&
          (link.startsWith("/") ? (
            <Link to={link} className="px-5 py-3 rounded-xl bg-accent-400 hover:bg-accent-300 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-xs transition-colors">
              <span>{linkLabel}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          ) : (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 rounded-xl bg-accent-400 hover:bg-accent-300 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-xs transition-colors"
            >
              <span>{linkLabel}</span>
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          ))}
        {!event.cancelled && !over && (
          <a
            href={calendarFile}
            download="arrangement.ics"
            className="px-5 py-3 rounded-xl bg-white hover:bg-stone-50 text-stone-800 font-semibold text-sm border border-stone-200 flex items-center gap-2 transition-colors"
          >
            <CalendarPlus className="w-4 h-4 text-primary-600" aria-hidden="true" />
            <span>Legg i kalenderen min</span>
          </a>
        )}
      </div>

      {related.length > 0 && (
        <section aria-labelledby="event-news" className="pt-6 border-t border-stone-200 space-y-3">
          <h2 id="event-news" className="text-lg font-black text-stone-900">
            Les mer om arrangementet
          </h2>
          <ul className="space-y-2">
            {related.map((article) => (
              <li key={article.id}>
                <Link
                  to={`/artikkel/${article.id}`}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white border border-stone-200/80 hover:border-primary-300 transition-colors"
                >
                  <span>
                    <span className="block font-bold text-stone-900">{article.title}</span>
                    {article.summary && <span className="block text-xs text-stone-500 line-clamp-1">{article.summary}</span>}
                  </span>
                  <ArrowRight className="w-4 h-4 text-primary-700 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
};
