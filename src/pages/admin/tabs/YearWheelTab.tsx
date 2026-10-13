import React, { useEffect, useState } from "react";
import { Clock, Pencil, Plus, Trash2, X } from "lucide-react";
import { DEFAULT_YEAR_WHEEL } from "../../../data/defaultYearWheel";
import { newId } from "../../../utils/id";
import { saveYearWheel, subscribeYearWheel } from "../../../services/yearWheel";
import {
  daysIn,
  MONTH_NAMES,
  withoutYearWheelItem,
  withYearWheelItem,
  yearWheelByMonth,
  yearWheelItemError,
  YEAR_WHEEL_NOTE_MAX,
  YEAR_WHEEL_TITLE_MAX,
  type YearWheelItem,
} from "../../../utils/yearWheel";
import type { ShowFeedback } from "../studio";
import { studioInputFull, studioPrimaryButton, studioSecondaryButton } from "../studioTheme";

interface YearWheelTabProps {
  showFeedback: ShowFeedback;
  /** The month that is now, 1–12. Given in tests; otherwise read from the clock. */
  currentMonth?: number;
}

// Shown when the pointer is over the line, or the button has the keyboard. Always shown where there is no pointer.
const iconButton =
  "inline-flex items-center justify-center w-7 h-7 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-bg)] cursor-pointer transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100";

/** The congregation's annual wheel: deadlines and what comes back every year, month by month. */
export const YearWheelTab: React.FC<YearWheelTabProps> = ({ showFeedback, currentMonth = new Date().getMonth() + 1 }) => {
  // undefined while the stored wheel is being read; null when none is stored
  const [stored, setStored] = useState<YearWheelItem[] | null | undefined>(undefined);
  const [editing, setEditing] = useState<YearWheelItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeYearWheel(setStored, () => {
        setStored(null);
        showFeedback("Årshjulet kunne ikke leses. Standardårshjulet vises.", "error");
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const items = stored ?? DEFAULT_YEAR_WHEEL;
  const isStandard = stored === null;

  const store = (next: YearWheelItem[], done: string) => {
    saveYearWheel(next).then(
      () => showFeedback(done),
      () => showFeedback("Årshjulet kunne ikke lagres. Prøv igjen.", "error")
    );
  };

  const save = () => {
    if (!editing) return;
    const wrong = yearWheelItemError(editing);
    setError(wrong);
    if (wrong) return;
    const isNew = !items.some((item) => item.id === editing.id);
    store(withYearWheelItem(items, editing), isNew ? "Fristen er lagt inn i årshjulet." : "Fristen er endret.");
    setEditing(null);
  };

  const remove = (item: YearWheelItem) => {
    if (!confirm(`Vil du ta «${item.title}» ut av årshjulet?`)) return;
    store(withoutYearWheelItem(items, item.id), "Fristen er tatt ut av årshjulet.");
  };

  const open = (item: YearWheelItem) => {
    setError(null);
    setEditing(item);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Menighetens årshjul</h2>
          <p className="text-xs text-[var(--studio-muted)] mt-1">Administrative frister og det som kommer igjen hvert år.</p>
        </div>
        <button type="button" onClick={() => open({ id: newId("frist"), month: currentMonth, day: daysIn(currentMonth) === 29 ? 28 : daysIn(currentMonth), title: "" })} className={`${studioPrimaryButton} flex items-center gap-1.5`}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Ny frist</span>
        </button>
      </div>

      {stored === undefined ? (
        <p className="text-xs text-[var(--studio-muted)]">Henter årshjulet …</p>
      ) : (
        <>
          {isStandard && (
            <p id="year-wheel-standard" className="text-xs text-[var(--studio-muted)]">
              Dette er standardårshjulet. Endre, legg til eller ta ut frister, så lagres det som menighetens eget.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {yearWheelByMonth(items).map(({ month, name, items: ofMonth }) => {
              const now = month === currentMonth;
              return (
                <section
                  key={month}
                  aria-label={name}
                  aria-current={now ? "date" : undefined}
                  className={`rounded-2xl bg-[var(--studio-surface)] border overflow-hidden ${now ? "border-indigo-500 ring-1 ring-indigo-500" : "border-[var(--studio-border)]"}`}
                >
                  <h3 className={`px-4 py-2.5 text-[11px] font-black uppercase tracking-wider border-b border-[var(--studio-border)] flex items-center justify-between ${now ? "text-indigo-400" : "text-[var(--studio-text)]"}`}>
                    <span>{name}</span>
                    {now && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white">Nå</span>}
                  </h3>
                  {ofMonth.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-[var(--studio-muted)] italic">Ingen frister</p>
                  ) : (
                    <ul className="p-2 space-y-0.5">
                      {ofMonth.map((item) => (
                        <li key={item.id} className="group flex items-start justify-between gap-2 px-2 py-2 rounded-xl hover:bg-[var(--studio-row)]">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--studio-text)] break-words">{item.title}</p>
                            <p className="mt-0.5 text-[11px] text-[var(--studio-muted)] flex items-center gap-1">
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              <span>{item.day}.</span>
                            </p>
                            {item.note && <p className="mt-1 text-[11px] text-[var(--studio-muted)] break-words">{item.note}</p>}
                          </div>
                          <div className="flex items-center shrink-0">
                            <button type="button" onClick={() => open(item)} aria-label={`Endre ${item.title}`} title="Endre" className={iconButton}>
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => remove(item)} aria-label={`Ta ut ${item.title}`} title="Ta ut" className={`${iconButton} hover:text-red-400`}>
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <div role="dialog" aria-modal="true" aria-labelledby="year-wheel-form-heading" className="fixed inset-0 z-50 bg-[var(--studio-overlay)] backdrop-blur-xs flex items-center justify-center p-4">
          {/* noValidate: the form says what is wrong in its own words, also for a day the month does not have */}
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
            className="w-full max-w-md rounded-2xl bg-[var(--studio-bg)] border border-[var(--studio-border)] p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="year-wheel-form-heading" className="text-sm font-bold text-[var(--studio-text)]">
                {items.some((item) => item.id === editing.id) ? "Endre frist" : "Ny frist"}
              </h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Lukk" className="text-[var(--studio-muted)] hover:text-[var(--studio-text)] cursor-pointer">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <label className="block text-xs font-bold text-[var(--studio-text)]">
              Hva gjelder det
              <input
                type="text"
                value={editing.title}
                maxLength={YEAR_WHEEL_TITLE_MAX}
                onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                placeholder="F.eks. Sende ut innkallelse til årsmøte"
                autoFocus
                className={`${studioInputFull} mt-1.5 font-normal`}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-[var(--studio-text)]">
                Måned
                <select value={editing.month} onChange={(event) => setEditing({ ...editing, month: Number(event.target.value) })} className={`${studioInputFull} mt-1.5 font-normal`}>
                  {MONTH_NAMES.map((name, at) => (
                    <option key={name} value={at + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-[var(--studio-text)]">
                Dag
                <input
                  type="number"
                  min={1}
                  max={daysIn(editing.month)}
                  value={Number.isNaN(editing.day) ? "" : editing.day}
                  onChange={(event) => setEditing({ ...editing, day: event.target.value === "" ? NaN : Number(event.target.value) })}
                  className={`${studioInputFull} mt-1.5 font-normal`}
                />
              </label>
            </div>

            <label className="block text-xs font-bold text-[var(--studio-text)]">
              Notat (valgfritt)
              <textarea
                value={editing.note ?? ""}
                maxLength={YEAR_WHEEL_NOTE_MAX}
                rows={2}
                onChange={(event) => setEditing({ ...editing, note: event.target.value })}
                className={`${studioInputFull} mt-1.5 font-normal`}
              />
            </label>

            {error && (
              <p role="alert" className="text-xs font-semibold text-rose-400">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--studio-border)]">
              <button type="button" onClick={() => setEditing(null)} className={studioSecondaryButton}>
                Avbryt
              </button>
              <button type="submit" className={studioPrimaryButton}>
                Lagre
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
