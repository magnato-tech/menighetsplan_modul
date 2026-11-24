import React from "react";
import { useLoginCounts } from "../../../hooks/useLoginCounts";
import { formatLongDayLabel, type LoginCountSummary } from "../../../utils/loginCounts";
import type { RequestTotals } from "../../../utils/loginRequests";
import { LOGIN_COUNTS, countOf } from "../../../utils/siteTraffic";
import { studioCardPadded, studioMuted } from "../studioTheme";

/** How many days «Alt» covers here. */
export const LOGIN_COUNT_ALL_DAYS = 90;

const PLOT_HEIGHT_CLASS = "h-24";

const BarDay: React.FC<{ summary: LoginCountSummary }> = ({ summary }) => {
  const top = Math.max(1, ...summary.days.map((day) => day.signIns));
  const first = summary.days[0];
  const last = summary.days[summary.days.length - 1];
  const describe = (day: LoginCountSummary["days"][number]) =>
    `${formatLongDayLabel(day.date)}: ${countOf(day.signIns, "innlogging", "innlogginger")}, ${day.minSide} åpnet Min side`;

  return (
    <div className="mt-4">
      <div role="group" aria-label="Innlogginger per dag" className={`flex items-end gap-px ${PLOT_HEIGHT_CLASS}`}>
        {summary.days.map((day) => (
          // A quiet day has no bar, only its empty slot, so it reads as quiet and not as missing
          <div key={day.date} role="img" aria-label={describe(day)} title={describe(day)} className="flex-1 min-w-0 h-full flex items-end">
            {day.signIns > 0 && (
              <div className="w-full max-w-[24px] mx-auto rounded-t-[4px] bg-[var(--viz-1)]" style={{ height: `${(day.signIns / top) * 100}%` }} />
            )}
          </div>
        ))}
      </div>
      <div className={`flex justify-between mt-1 text-[10px] tabular-nums ${studioMuted}`} aria-hidden="true">
        <span>{first ? formatLongDayLabel(first.date) : ""}</span>
        <span>{last ? formatLongDayLabel(last.date) : ""}</span>
      </div>
    </div>
  );
};

/**
 * The sign-ins and openings of Min side per day, for the period the Innlogging tab shows. Sums only,
 * no names. `requestTotals` is the count of the requests for a sign-in link, or null when the log
 * cannot be read: then its line is left out.
 */
export const LoginCountsSection: React.FC<{ days: number | null; requestTotals?: RequestTotals | null }> = ({ days, requestTotals }) => {
  const span = days ?? LOGIN_COUNT_ALL_DAYS;
  const { summary, error } = useLoginCounts(span);
  const since = summary?.countingSince ? formatLongDayLabel(summary.countingSince) : "i dag";
  const heading = days === null ? `Innlogginger per dag (siste ${LOGIN_COUNT_ALL_DAYS} dager)` : "Innlogginger per dag";

  return (
    <section className={studioCardPadded} aria-labelledby="login-counts-heading">
      <h3 id="login-counts-heading" className="text-sm font-black text-[var(--studio-text)]">
        {heading}
      </h3>
      {error && <p role="alert" className={`text-xs mt-2 ${studioMuted}`}>{error}</p>}
      {!summary && !error && <p className={`text-xs mt-2 ${studioMuted}`}>Henter tallene …</p>}
      {summary && (
        <>
          <p className={`text-xs mt-1 mb-3 ${studioMuted}`}>
            {`Telles fra og med ${since}${since.endsWith(".") ? "" : "."} Bare summer per dag, uten navn.`}
          </p>
          {summary.signIns === 0 && summary.minSide === 0 ? (
            <p className={`text-xs ${studioMuted}`}>Ingen innlogginger telt ennå. Tellingen startet da denne versjonen ble tatt i bruk.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-black text-[var(--studio-text)]">{summary.signIns}</p>
                  <p className="text-xs font-bold text-[var(--studio-text)]">Innlogginger</p>
                  <p className={`text-[11px] ${studioMuted}`}>
                    {LOGIN_COUNTS.map((kind) => `${kind.label} ${summary.byKind[kind.id]}`).join(" · ")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-black text-[var(--studio-text)]">{summary.minSide}</p>
                  <p className="text-xs font-bold text-[var(--studio-text)]">Åpnet Min side <span className="font-normal">(høyst én gang per nettleser per dag)</span></p>
                </div>
              </div>
              <BarDay summary={summary} />
            </>
          )}
          {requestTotals && (
            <p className={`text-xs mt-3 ${studioMuted}`}>
              {`Ba om lenke: ${requestTotals.requests} (sendt ${requestTotals.sent}, stoppet av sperren ${requestTotals.limited}, feilet ${requestTotals.failed})`}
            </p>
          )}
        </>
      )}
    </section>
  );
};
