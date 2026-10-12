import React, { Suspense, lazy, useRef, useState } from "react";
import { CalendarPlus, Edit3, EyeOff, Globe, Image as ImageIcon, LayoutTemplate, Plus, Repeat, Save, Star, X } from "lucide-react";
import { TEMPLATE_MOCKUPS, type TemplateMockup } from "../../data/templateMockup";
import type { GatheringVisibility } from "../../types";
import { gatheringFormError, hasPresentation, type GatheringFormValues } from "../../utils/gatheringForm";
import { DEFAULT_LOCATION } from "../../utils/gatherings";
import { SERIES_FREQUENCIES, seriesDays, type SeriesFrequency } from "../../utils/series";

// The picture chooser brings the media library with it, so it is fetched when the part is opened
const GatheringWebsiteFields = lazy(() => import("./GatheringWebsiteFields"));

interface GatheringFormDialogProps {
  /** A new event, or one that exists. A new one can start from a template and be repeated. */
  isNew: boolean;
  initial: GatheringFormValues;
  groups: { id: string; name: string }[];
  /** Whether the responsible group is chosen here. It is not on the level without the planner. */
  showGroup: boolean;
  /** Set when the form is opened to fill in how the event is presented on the website: that part is then open, and in view. */
  openAt?: "website";
  /** Stores the event. The form closes itself when it went well. */
  onSave: (values: GatheringFormValues) => { success: boolean; error?: string };
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

const field = "w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const label = "block text-xs font-bold text-slate-700 mb-1";
const sectionTitle = "text-sm font-black text-slate-900 flex items-center gap-2";
const mockupMark = "text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded";

/**
 * The form an event is made and changed in, on a surface large enough for all of it (see
 * utils/gatheringForm.ts for what its fields hold). Starting from a template and repeating the
 * event are mock-ups until they are built: they are marked as such, and store nothing.
 */
export const GatheringFormDialog: React.FC<GatheringFormDialogProps> = ({ isNew, initial, groups, showGroup, openAt, onSave, onClose }) => {
  const [values, setValues] = useState<GatheringFormValues>(initial);

  // The part about the website is folded while it is empty, so the form is no longer than it has to be
  const [websiteOpen, setWebsiteOpen] = useState(openAt === "website" || hasPresentation(initial));
  // Brought into view once its fields are there: before that it is shorter than it will be
  const websiteSection = useRef<HTMLElement>(null);
  const showWebsiteSection = () => websiteSection.current?.scrollIntoView?.({ block: "start" });
  const [error, setError] = useState<string | null>(null);
  const set = (changes: Partial<GatheringFormValues>) => setValues((current) => ({ ...current, ...changes }));

  // Mock-ups: the template the form was filled in from, and the series the event would be the first of
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [repeats, setRepeats] = useState(false);
  const [frequency, setFrequency] = useState<SeriesFrequency>("weekly");
  const [lastDay, setLastDay] = useState("");
  const days = repeats && values.date && lastDay ? seriesDays(values.date, lastDay, frequency) : [];

  const startFrom = (template: TemplateMockup) => {
    setTemplateId(template.id);
    set({ title: template.title, time: template.time, endTime: template.endTime, isGudstjeneste: template.isGudstjeneste });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = gatheringFormError(values);
    if (problem) {
      setError(problem);
      return;
    }
    const result = onSave(values);
    if (result.success) onClose();
    else setError(result.error || "Arrangementet kunne ikke lagres.");
  };

  const heading = isNew ? "Nytt arrangement" : "Rediger arrangement";

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
                  <span className={mockupMark}>Prøveutgave</span>
                </h3>
                <p className="text-xs text-slate-600">
                  En mal fyller inn tittel og klokkeslett. Maler med bemanning og kjøreplan kommer senere. Disse fire er eksempler.
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {TEMPLATE_MOCKUPS.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={templateId === template.id}
                      onClick={() => startFrom(template)}
                      className={`text-left px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                        templateId === template.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300"
                      }`}
                    >
                      <span className="block text-sm font-bold text-slate-900">{template.name}</span>
                      <span className="block text-[11px] text-slate-500">{template.rhythm}</span>
                    </button>
                  ))}
                </div>
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
                  <span className={mockupMark}>Prøveutgave</span>
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
                      </div>
                    </div>
                    {days.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-800">
                          Serien gir {days.length} {days.length === 1 ? "arrangement" : "arrangementer"}:
                        </p>
                        <ul className="flex flex-wrap gap-1.5">
                          {days.map((day) => (
                            <li key={day} className="text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                              {writtenDay(day)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Velg dato for arrangementet og siste dato, så vises dagene i serien her.</p>
                    )}
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      Serier er ikke bygget ennå. Når du lagrer, opprettes bare det første arrangementet.
                    </p>
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
                {isNew ? "Opprett arrangement" : "Lagre endringer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
