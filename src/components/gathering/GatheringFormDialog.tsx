import React, { Suspense, lazy, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarPlus, Edit3, EyeOff, Globe, Image as ImageIcon, LayoutTemplate, Plus, Repeat, Save, Star, X } from "lucide-react";
import type { GatheringVisibility, VolunteerRole } from "../../types";
import { gatheringFormError, hasPresentation, type GatheringFormValues } from "../../utils/gatheringForm";
import { formValuesFromTemplate, type GatheringTemplate } from "../../utils/gatheringTemplates";
import { TemplateFormDialog } from "./TemplateFormDialog";
import { DEFAULT_LOCATION } from "../../utils/gatherings";
import { SERIES_FREQUENCIES, SERIES_LIMIT, seriesDays, suggestedLastDay, type SeriesFrequency } from "../../utils/series";

// The picture chooser brings the media library with it, so it is fetched when the part is opened
const GatheringWebsiteFields = lazy(() => import("./GatheringWebsiteFields"));

/** What is chosen in the form beyond the event's own fields. */
export interface GatheringFormChoices {
  /** The template the event is made from, or null. */
  templateId: string | null;
  /** The days of the series, the event's own day among them. Empty when the event is not repeated. */
  days: string[];
}

/** Opens the template form from «Nytt arrangement» and stores changes in the congregation's library. */
export interface GatheringTemplateEditor {
  roles: VolunteerRole[];
  withPlanner: boolean;
  onSave: (template: GatheringTemplate) => Promise<boolean>;
}

interface GatheringFormDialogProps {
  /** A new event, or one that exists. A new one can start from a template and be repeated. */
  isNew: boolean;
  initial: GatheringFormValues;
  groups: { id: string; name: string }[];
  /** Whether the responsible group is chosen here. It is not on the level without the planner. */
  showGroup: boolean;
  /** Set when the form is opened to fill in how the event is presented on the website: that part is then open, and in view. */
  openAt?: "website";
  /** The congregation's templates. A new event can be started from one of them. */
  templates?: GatheringTemplate[];
  /** The template the form is opened with, and whether it is opened to plan a series. */
  initialTemplateId?: string;
  initialRepeat?: boolean;
  /** The events that already stand in the calendar, so a series can say where it meets one. */
  existing?: { day: string; title: string }[];
  /** When set, each mal can be opened and changed before the event is created. */
  templateEditor?: GatheringTemplateEditor;
  /** Stores the event, or the events of the series. The form closes itself when it went well. */
  onSave: (values: GatheringFormValues, choices: GatheringFormChoices) => { success: boolean; error?: string };
  onClose: () => void;
}

const VISIBILITIES: { id: GatheringVisibility; label: string; says: string; icon: React.ReactNode }[] = [
  { id: "offentlig", label: "Offentlig", says: "Står i kalenderen på nettsiden", icon: <Globe className="w-4 h-4" aria-hidden="true" /> },
  { id: "fremhevet", label: "Fremhevet", says: "Løftes fram på forsiden", icon: <Star className="w-4 h-4" aria-hidden="true" /> },
  { id: "intern", label: "Kun intern", says: "Vises bare i planleggeren", icon: <EyeOff className="w-4 h-4" aria-hidden="true" /> },
];

/** A day ("2026-10-18") as it is written out: «søndag 18. oktober». */
const writtenDay = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Today, as the calendar shows it to the one at the screen. */
const today = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const field = "w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const label = "block text-xs font-bold text-slate-700 mb-1";
const sectionTitle = "text-sm font-black text-slate-900 flex items-center gap-2";

/**
 * The form an event is made and changed in, on a surface large enough for all of it (see
 * utils/gatheringForm.ts for what its fields hold). A new event can start from one of the
 * congregation's templates (utils/gatheringTemplates.ts), and be repeated as a series
 * (utils/series.ts): the days are shown before anything is made, and each can be left out.
 */
export const GatheringFormDialog: React.FC<GatheringFormDialogProps> = ({
  isNew,
  initial,
  groups,
  showGroup,
  openAt,
  templates = [],
  initialTemplateId,
  initialRepeat = false,
  existing = [],
  templateEditor,
  onSave,
  onClose,
}) => {
  const [values, setValues] = useState<GatheringFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (changes: Partial<GatheringFormValues>) => setValues((current) => ({ ...current, ...changes }));

  // The part about the website is folded while it is empty, so the form is no longer than it has to be
  const [websiteOpen, setWebsiteOpen] = useState(openAt === "website" || hasPresentation(initial));
  // Brought into view once its fields are there: before that it is shorter than it will be
  const websiteSection = useRef<HTMLElement>(null);
  const showWebsiteSection = () => websiteSection.current?.scrollIntoView?.({ block: "start" });

  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId ?? null);
  const [editingTemplate, setEditingTemplate] = useState<GatheringTemplate | null>(null);
  const startFrom = (template: GatheringTemplate) => {
    const filled = formValuesFromTemplate(template, values);
    setTemplateId(template.id);
    setValues(filled);
    if (hasPresentation(filled)) setWebsiteOpen(true);
  };

  // The series: how often, to which day, and the days that are left out
  const [repeats, setRepeats] = useState(initialRepeat);
  const [frequency, setFrequency] = useState<SeriesFrequency>("weekly");
  const [lastDay, setLastDay] = useState(() => suggestedLastDay(initial.date || today()));
  const [leftOut, setLeftOut] = useState<string[]>([]);
  const allDays = useMemo(() => (repeats && values.date && lastDay ? seriesDays(values.date, lastDay, frequency) : []), [repeats, values.date, lastDay, frequency]);
  const days = allDays.filter((day) => !leftOut.includes(day));
  const cutShort = allDays.length === SERIES_LIMIT;
  const standingOn = (day: string): string[] => existing.filter((event) => event.day === day).map((event) => event.title);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = gatheringFormError(values);
    if (problem) {
      setError(problem);
      return;
    }
    if (isNew && repeats && days.length === 0) {
      setError("Serien har ingen dager. Velg en siste dato etter den første, eller slå av gjentakelsen.");
      return;
    }
    const result = onSave(values, { templateId: isNew ? templateId : null, days: isNew && repeats ? days : [] });
    if (result.success) onClose();
    else setError(result.error || "Arrangementet kunne ikke lagres.");
  };

  const heading = isNew ? "Nytt arrangement" : "Rediger arrangement";
  const submitLabel = !isNew ? "Lagre endringer" : repeats && days.length > 1 ? `Opprett ${days.length} arrangementer` : "Opprett arrangement";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gathering-form-heading"
        className="bg-slate-50 w-full max-w-4xl sm:rounded-3xl sm:max-h-[calc(100vh-2rem)] shadow-2xl flex flex-col overflow-hidden text-slate-800"
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 bg-white border-b border-slate-200">
          <h2 id="gathering-form-heading" className="text-lg font-black text-slate-900 flex items-center gap-2">
            {isNew ? <CalendarPlus className="w-5 h-5 text-indigo-600" aria-hidden="true" /> : <Edit3 className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
            {heading}
          </h2>
          <button type="button" onClick={onClose} aria-label="Lukk" className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 sm:px-8 py-6 space-y-6">
            {isNew && (
              <section aria-labelledby="gathering-form-template" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h3 id="gathering-form-template" className={sectionTitle}>
                  <LayoutTemplate className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                  Start fra en mal
                </h3>
                {templates.length === 0 ? (
                  <p className="text-xs text-slate-600">Ingen maler er laget ennå. En mal lages under «Maler» i menyen, eller av et arrangement som alt er satt opp.</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-600">Malen fyller inn skjemaet, og arrangementet får malens program og oppgaver. Alt kan endres etterpå.</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className={`flex rounded-xl border overflow-hidden transition-colors ${
                            templateId === template.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300"
                          }`}
                        >
                          <button
                            type="button"
                            aria-pressed={templateId === template.id}
                            onClick={() => startFrom(template)}
                            className="flex-1 min-w-0 text-left px-3 py-2.5 cursor-pointer"
                          >
                            <span className="block text-sm font-bold text-slate-900">{template.name}</span>
                            <span className="block text-[11px] text-slate-500">
                              Kl. {template.time} · {template.program.length} programpunkter
                            </span>
                          </button>
                          {templateEditor && (
                            <button
                              type="button"
                              onClick={() => setEditingTemplate(template)}
                              aria-label={`Rediger malen ${template.name}`}
                              className="shrink-0 px-2.5 border-l border-slate-200 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50/80 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {templateId && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {templateEditor && (
                          <button
                            type="button"
                            onClick={() => {
                              const template = templates.find((candidate) => candidate.id === templateId);
                              if (template) setEditingTemplate(template);
                            }}
                            className="text-xs font-semibold text-indigo-700 underline cursor-pointer"
                          >
                            Rediger malen før du oppretter
                          </button>
                        )}
                        <button type="button" onClick={() => setTemplateId(null)} className="text-xs font-semibold text-slate-600 underline cursor-pointer">
                          Ikke bruk mal: opprett uten program og oppgaver
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            <section aria-labelledby="gathering-form-when" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
              <h3 id="gathering-form-when" className={sectionTitle}>
                Hva og når
              </h3>
              <div>
                <label htmlFor="gathering-title" className={label}>
                  Tittel
                </label>
                <input
                  id="gathering-title"
                  type="text"
                  value={values.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="f.eks. Søndagsgudstjeneste & dåp"
                  className={field}
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="gathering-date" className={label}>
                    Dato
                  </label>
                  <input id="gathering-date" type="date" value={values.date} onChange={(e) => set({ date: e.target.value })} className={field} />
                </div>
                <div>
                  <label htmlFor="gathering-time" className={label}>
                    Starter kl.
                  </label>
                  <input id="gathering-time" type="time" value={values.time} onChange={(e) => set({ time: e.target.value })} className={field} />
                </div>
                <div>
                  <label htmlFor="gathering-end-time" className={label}>
                    Slutter kl. (valgfritt)
                  </label>
                  <input id="gathering-end-time" type="time" value={values.endTime} onChange={(e) => set({ endTime: e.target.value })} className={field} />
                </div>
                <div>
                  <label htmlFor="gathering-end-date" className={label}>
                    Slutter en annen dag (valgfritt)
                  </label>
                  <input
                    id="gathering-end-date"
                    type="date"
                    value={values.endDate}
                    min={values.date || undefined}
                    onChange={(e) => set({ endDate: e.target.value })}
                    className={field}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="gathering-location" className={label}>
                  Sted
                </label>
                <input
                  id="gathering-location"
                  type="text"
                  value={values.location}
                  onChange={(e) => set({ location: e.target.value })}
                  placeholder={`Tomt felt vises som «${DEFAULT_LOCATION}»`}
                  className={field}
                />
              </div>
            </section>

            <section aria-labelledby="gathering-form-about" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
              <h3 id="gathering-form-about" className={sectionTitle}>
                Om arrangementet
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="gathering-theme" className={label}>
                    Tema (valgfritt)
                  </label>
                  <input id="gathering-theme" type="text" value={values.theme} onChange={(e) => set({ theme: e.target.value })} className={field} />
                </div>
                <div>
                  <label htmlFor="gathering-bible-text" className={label}>
                    Bibeltekst (valgfritt)
                  </label>
                  <input
                    id="gathering-bible-text"
                    type="text"
                    value={values.bibleText}
                    onChange={(e) => set({ bibleText: e.target.value })}
                    placeholder="f.eks. Markus 1,14–15"
                    className={field}
                  />
                </div>
              </div>
              {showGroup && (
                <div>
                  <label htmlFor="gathering-group" className={label}>
                    Ansvarlig gruppe
                  </label>
                  <select id="gathering-group" value={values.groupId} onChange={(e) => set({ groupId: e.target.value })} className={field}>
                    {groups.length === 0 && <option value="">Ingen grupper finnes ennå</option>}
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.isGudstjeneste}
                  onChange={(e) => set({ isGudstjeneste: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                />
                Dette er en gudstjeneste
              </label>
            </section>

            <section aria-labelledby="gathering-form-visibility" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
              <h3 id="gathering-form-visibility" className={sectionTitle}>
                Hvem ser arrangementet
              </h3>
              <div role="radiogroup" aria-labelledby="gathering-form-visibility" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {VISIBILITIES.map((choice) => (
                  <label
                    key={choice.id}
                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                      values.visibility === choice.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="gathering-visibility"
                      checked={values.visibility === choice.id}
                      onChange={() => set({ visibility: choice.id })}
                      className="mt-1"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        {choice.icon}
                        {choice.label}
                      </span>
                      <span className="block text-[11px] text-slate-500">{choice.says}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!isNew && (
                <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer pt-1">
                  <input type="checkbox" checked={values.cancelled} onChange={(e) => set({ cancelled: e.target.checked })} className="w-4 h-4 rounded border-slate-300" />
                  Arrangementet er avlyst
                </label>
              )}
            </section>

            <section ref={websiteSection} aria-labelledby="gathering-form-website" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
              <h3 id="gathering-form-website" className={sectionTitle}>
                <ImageIcon className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                På nettsiden
              </h3>
              <p className="text-xs text-slate-600">
                Bilde, ingress og tekst er valgfritt. Bildet og ingressen vises på kortet på forsiden og i kalenderen. Teksten og lenken vises på
                arrangementets egen side, som kortet åpner.
              </p>
              {websiteOpen ? (
                <Suspense fallback={<p className="text-xs text-slate-500">Laster …</p>}>
                  <GatheringWebsiteFields values={values} onChange={set} onReady={openAt === "website" ? showWebsiteSection : undefined} />
                </Suspense>
              ) : (
                <button
                  type="button"
                  onClick={() => setWebsiteOpen(true)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:border-indigo-400 text-sm font-bold text-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                  Legg til bilde og tekst
                </button>
              )}
            </section>

            {isNew && (
              <section aria-labelledby="gathering-form-series" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h3 id="gathering-form-series" className={sectionTitle}>
                  <Repeat className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                  Gjenta som serie
                </h3>
                <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                  <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                  Arrangementet gjentas
                </label>
                {repeats && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="gathering-frequency" className={label}>
                          Hvor ofte
                        </label>
                        <select id="gathering-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as SeriesFrequency)} className={field}>
                          {SERIES_FREQUENCIES.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="gathering-last-day" className={label}>
                          Siste dato
                        </label>
                        <input
                          id="gathering-last-day"
                          type="date"
                          value={lastDay}
                          min={values.date || undefined}
                          onChange={(e) => setLastDay(e.target.value)}
                          className={field}
                        />
                        <p className="text-[11px] text-slate-500 mt-1">Foreslått fram til sommeren.</p>
                      </div>
                    </div>
                    {allDays.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-800">
                          {days.length === 1 ? "1 arrangement opprettes" : `${days.length} arrangementer opprettes`}. Ta bort haken på en dag som skal stå over.
                        </p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {allDays.map((day) => {
                            const there = standingOn(day);
                            return (
                              <li key={day} className="text-xs text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!leftOut.includes(day)}
                                    onChange={(e) => setLeftOut((current) => (e.target.checked ? current.filter((other) => other !== day) : [...current, day]))}
                                    className="w-3.5 h-3.5 rounded border-slate-300"
                                  />
                                  <span className="font-semibold">{writtenDay(day)}</span>
                                </label>
                                {/* Said with an icon and in words: the day already holds something */}
                                {there.length > 0 && (
                                  <span className="mt-1 flex items-start gap-1 text-[11px] font-semibold text-amber-800">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                                    Ligger allerede: {there.join(", ")}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        {cutShort && <p className="text-[11px] text-slate-500">En serie har høyst {SERIES_LIMIT} arrangementer. Resten kan lages som en ny serie.</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Velg dato for arrangementet og siste dato, så vises dagene i serien her.</p>
                    )}
                  </>
                )}
              </section>
            )}
          </div>

          <div className="sticky bottom-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-8 py-4 bg-white border-t border-slate-200">
            <p role="alert" className="text-xs font-bold text-red-700 min-h-4">
              {error}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                Avbryt
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                {submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>

      {editingTemplate && templateEditor && (
        <TemplateFormDialog
          isNew={false}
          initial={editingTemplate}
          groups={groups}
          roles={templateEditor.roles}
          withPlanner={templateEditor.withPlanner}
          onSave={async (template) => {
            const saved = await templateEditor.onSave(template);
            if (saved) {
              setEditingTemplate(null);
              if (templateId === template.id) startFrom(template);
            }
            return saved;
          }}
          onClose={() => setEditingTemplate(null)}
        />
      )}
    </div>
  );
};
