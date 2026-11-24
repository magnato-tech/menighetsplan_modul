import { useEffect, useMemo, useState } from "react";
import { useFirebase } from "../context/FirebaseDataContext";
import { useCms } from "../context/CmsContext";
import { logoOf } from "../utils/logo";
import { locationOf } from "../utils/gatherings";
import { visibilityOf } from "../utils/visibility";
import type { Gathering } from "../types";
import {
  infoScreenBoard,
  osloClock,
  osloDayMonth,
  osloDayOfMonth,
  osloLongDate,
  osloWeekdayShort,
  startTimeOf,
  todayHeadline,
} from "../utils/infoScreen";

// The info screen in the church foyer: a full-screen page for a TV, with no menu and no links.
// The lists are live (Firestore listeners); the clock is brought up to date every half minute.
const CLOCK_MS = 30_000;

// A screen that runs for weeks would keep the version it started with. Reloading now and then picks up a new one.
const RELOAD_MS = 6 * 60 * 60 * 1000;

const HEADING = "mb-[1.2vw] text-[1.6vw] font-bold uppercase tracking-[0.15em] text-primary-600";

export default function InfoScreenPage() {
  const { gatherings, gatheringsReady } = useFirebase();
  const { settings } = useCms();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const reload = window.setInterval(() => window.location.reload(), RELOAD_MS);
    return () => window.clearInterval(reload);
  }, []);

  const board = useMemo(() => infoScreenBoard(gatherings, now), [gatherings, now]);
  const { headline, rest } = useMemo(() => todayHeadline(board.today), [board.today]);

  const logo = logoOf(settings);
  const churchName = (settings.churchName || "").trim();
  // The number may be stored with its "#" in front; the page writes the "#" itself
  const vippsNumber = (settings.vippsNumber || "").trim().replace(/^#+/, "");

  return (
    <main className="flex h-[calc(100vh-var(--demo-strip,0px))] flex-col overflow-hidden bg-page p-[2.2vw] text-stone-900">
      <header className="flex items-start justify-between gap-[2vw]">
        <div className="flex min-w-0 items-center gap-[1.4vw]">
          {logo ? (
            <img src={logo} alt={churchName} className="h-[5.5vw] w-auto max-w-[12vw] object-contain" />
          ) : churchName ? (
            <span className="flex h-[5.5vw] w-[5.5vw] shrink-0 items-center justify-center rounded-[1vw] bg-primary-600 text-[2.8vw] font-bold text-white">
              {churchName.charAt(0).toUpperCase()}
            </span>
          ) : null}
          {churchName && <h1 className="truncate text-[2.8vw] font-bold">{churchName}</h1>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[4.6vw] leading-none font-extrabold tabular-nums">{osloClock(now)}</p>
          <p className="mt-[0.4vw] text-[1.6vw] text-stone-600">{osloLongDate(now)}</p>
        </div>
      </header>

      {gatheringsReady && (
        <>
          <div className="mt-[1.8vw] grid min-h-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-[2.2vw]">
            <section className="flex min-h-0 flex-col">
              <h2 className={HEADING}>I dag</h2>
              {board.today.length > 0 ? (
                <article className="min-h-0 overflow-hidden rounded-[1.6vw] bg-gradient-to-br from-primary-500 to-primary-700 p-[2.2vw] text-white shadow-xl">
                  {/* Without a headline every event of today is cancelled, and they are listed struck through */}
                  {headline && (
                    <>
                      <p className="text-[1.7vw] font-semibold text-accent-300">{[timeOf(headline, "Kl. "), locationOf(headline)].filter(Boolean).join(" · ")}</p>
                      <h3 className="mt-[0.6vw] text-[3.4vw] leading-tight font-extrabold">{headline.title}</h3>
                      {headline.summary && <p className="mt-[1vw] line-clamp-2 text-[1.8vw] leading-snug text-primary-100">{headline.summary}</p>}
                    </>
                  )}
                  {rest.length > 0 && (
                    <ul className={`${headline ? "mt-[1.8vw]" : ""} flex flex-col`}>
                      {rest.map((g) => (
                        <TodayRow key={g.id} gathering={g} />
                      ))}
                    </ul>
                  )}
                </article>
              ) : (
                <EmptyNote>Ingenting mer på programmet i dag</EmptyNote>
              )}
            </section>

            <section className="flex min-h-0 flex-col">
              <h2 className={HEADING}>Denne uka</h2>
              {board.week.length === 0 ? (
                <EmptyNote>Ingenting denne uka</EmptyNote>
              ) : (
                <ul className="flex min-h-0 flex-col gap-[0.9vw] overflow-hidden">
                  {board.week.map((g) => (
                    <EventRow key={g.id} gathering={g} detail={[timeOf(g, "Kl. "), locationOf(g)].filter(Boolean).join(" · ")} />
                  ))}
                </ul>
              )}
            </section>

            <section className="flex min-h-0 flex-col">
              <h2 className={HEADING}>Kommende</h2>
              {board.upcoming.length === 0 ? (
                <EmptyNote>Ingenting planlagt ennå</EmptyNote>
              ) : (
                <ul className="flex min-h-0 flex-col gap-[0.9vw] overflow-hidden">
                  {board.upcoming.map((g) => (
                    <EventRow
                      key={g.id}
                      gathering={g}
                      detail={[osloDayMonth(g.startsAt), timeOf(g, "kl. ")].filter(Boolean).join(" ")}
                      featured={visibilityOf(g) === "fremhevet"}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <footer className="mt-[1vw] text-[1.4vw] text-stone-600">
            {vippsNumber && (
              <>
                Vipps <b className="font-bold text-stone-900">#{vippsNumber}</b> ·{" "}
              </>
            )}
            {window.location.host}
          </footer>
        </>
      )}
    </main>
  );
}

/** The start time with a word in front, or nothing for an event without a time of day (see startTimeOf). */
function timeOf(gathering: Gathering, prefix: string): string {
  const time = startTimeOf(gathering.startsAt);
  return time ? `${prefix}${time}` : "";
}

function EmptyNote({ children }: { children: string }) {
  return <p className="rounded-[1.2vw] border-[0.2vw] border-dashed border-stone-300 p-[1.6vw] text-[1.8vw] text-stone-500">{children}</p>;
}

function Cancelled() {
  return (
    <span className="ml-[1vw] rounded-[0.5vw] bg-red-600 px-[0.8vw] py-[0.2vw] align-middle text-[1.3vw] font-bold tracking-wide text-white">
      AVLYST
    </span>
  );
}

/** A row of the rest of today, on the card of the headline: time, title, place. */
function TodayRow({ gathering }: { gathering: Gathering }) {
  const cancelled = gathering.cancelled === true;
  return (
    <li className="flex gap-[2vw] border-t border-white/25 py-[1.4vw]">
      <p className="w-[7vw] shrink-0 text-[2.2vw] font-bold text-accent-300">{timeOf(gathering, "")}</p>
      <div className="min-w-0">
        <p className="text-[2.2vw] font-bold">
          <span className={cancelled ? "text-primary-100 line-through" : undefined}>{gathering.title}</span>
          {cancelled && <Cancelled />}
        </p>
        <p className="text-[1.6vw] text-primary-100">{locationOf(gathering)}</p>
      </div>
    </li>
  );
}

/** A card in the week and upcoming columns: the day on the left, title and a line of detail on the right. */
function EventRow({ gathering, detail, featured = false }: { gathering: Gathering; detail: string; featured?: boolean }) {
  const cancelled = gathering.cancelled === true;
  return (
    <li
      className={`flex items-center gap-[1.4vw] rounded-[1.2vw] border-[0.25vw] px-[1.2vw] py-[0.9vw] shadow-sm ${
        featured ? "border-accent-500 bg-accent-50" : "border-transparent bg-white"
      }`}
    >
      <div className="flex w-[6.5vw] shrink-0 flex-col items-center">
        <span className="text-[1.2vw] font-bold text-primary-600">{osloWeekdayShort(gathering.startsAt)}</span>
        <span className="text-[2.4vw] leading-none font-extrabold text-stone-900">{osloDayOfMonth(gathering.startsAt)}</span>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-[1.9vw] leading-tight font-bold">
          <span className={cancelled ? "text-stone-500 line-through" : undefined}>{gathering.title}</span>
          {cancelled && <Cancelled />}
        </p>
        <p className="line-clamp-1 text-[1.4vw] text-stone-600">{detail}</p>
      </div>
    </li>
  );
}
