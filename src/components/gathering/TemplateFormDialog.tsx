import React, { Suspense, lazy, useState } from "react";
import { ArrowDown, ArrowUp, Clock, GripVertical, Image as ImageIcon, LayoutTemplate, ListChecks, Plus, Save, Trash2, X } from "lucide-react";
import type { GatheringVisibility, VolunteerRole } from "../../types";
import { DEFAULT_LOCATION } from "../../utils/gatherings";
import { itemClock, minutesOf, roleNameOf, tasksOfTemplate, type GatheringTemplate, type TemplateProgramItem } from "../../utils/gatheringTemplates";
import { newId } from "../../utils/id";

// The picture chooser brings the media library with it, so it is fetched when the part is opened
const GatheringWebsiteFields = lazy(() => import("./GatheringWebsiteFields"));

interface TemplateFormDialogProps {
  isNew: boolean;
  initial: GatheringTemplate;
  groups: { id: string; name: string }[];
  roles: VolunteerRole[];
  /** False on the level without the planner: the template then has no programme and no staffing. */
  withPlanner: boolean;
  /** Stores the template. The form closes itself when it went well. */
  onSave: (template: GatheringTemplate) => Promise<boolean>;
  onClose: () => void;
}

const field = "w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const small = "w-full px-2 py-2 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const label = "block text-xs font-bold text-slate-700 mb-1";
const sectionTitle = "text-sm font-black text-slate-900 flex items-center gap-2";
const iconButton = "p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer disabled:opacity-30 disabled:cursor-default";

const byTime = (a: TemplateProgramItem, b: TemplateProgramItem) => a.offsetMinutes - b.offsetMinutes;

/**
 * The form a template for events is made and changed in (see utils/gatheringTemplates.ts): what
 * an event from the template is called and when it is held, its programme with a role on each
 * item, the tasks it needs beyond those, and how it is presented on the website.
 */
export const TemplateFormDialog: React.FC<TemplateFormDialogProps> = ({ isNew, initial, groups, roles, withPlanner, onSave, onClose }) => {
  const [template, setTemplate] = useState<GatheringTemplate>({ ...initial, program: [...initial.program].sort(byTime) });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [websiteOpen, setWebsiteOpen] = useState(Boolean(initial.imageUrl || initial.summary || initial.content || initial.linkUrl));
  const [draggedProgramIndex, setDraggedProgramIndex] = useState<number | null>(null);
  const [dragOverProgramIndex, setDragOverProgramIndex] = useState<number | null>(null);
  const set = (changes: Partial<GatheringTemplate>) => setTemplate((current) => ({ ...current, ...changes }));

  // ---------- The programme ----------
  const setItem = (id: string, changes: Partial<TemplateProgramItem>) =>
    set({ program: template.program.map((item) => (item.id === id ? { ...item, ...changes } : item)) });
  const setItemClock = (id: string, clock: string) => {
    const at = minutesOf(clock);
    const start = minutesOf(template.time);
    if (at !== null && start !== null) setItem(id, { offsetMinutes: at - start });
  };
  const setItemRole = (id: string, roleId: string) => {
    const role = roles.find((candidate) => candidate.id === roleId);
    setItem(id, { roleId: role?.id, roleName: role?.name });
  };
  const addItem = () => {
    const last = template.program.at(-1);
    set({ program: [...template.program, { id: newId("item"), offsetMinutes: last ? last.offsetMinutes + last.durationMinutes : 0, durationMinutes: 5, title: "" }] });
  };
  const removeItem = (id: string) => set({ program: template.program.filter((item) => item.id !== id) });
  /** Moves an item one place: the two swap times, so the programme still runs in the order shown. */
  const moveItem = (index: number, by: -1 | 1) => {
    const other = index + by;
    if (other < 0 || other >= template.program.length) return;
    reorderProgram(index, other);
  };
  /** Moves a row in the list; the clock times on each row stay put, like when using the arrows. */
  const reorderProgram = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= template.program.length || to >= template.program.length) return;
    const program = [...template.program];
    const offsets = program.map((item) => item.offsetMinutes);
    const [moved] = program.splice(from, 1);
    program.splice(to, 0, moved);
    set({ program: program.map((item, index) => ({ ...item, offsetMinutes: offsets[index] })) });
  };
  const handleProgramDragStart = (event: React.DragEvent, index: number) => {
    setDraggedProgramIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };
  const handleProgramDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverProgramIndex !== index) setDragOverProgramIndex(index);
  };
  const handleProgramDrop = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    if (draggedProgramIndex !== null) reorderProgram(draggedProgramIndex, index);
    setDraggedProgramIndex(null);
    setDragOverProgramIndex(null);
  };
  const handleProgramDragEnd = () => {
    setDraggedProgramIndex(null);
    setDragOverProgramIndex(null);
  };
  const sortProgram = () => set({ program: [...template.program].sort(byTime) });

  // ---------- The tasks beyond the programme ----------
  const addExtra = (roleId: string) => {
    const role = roles.find((candidate) => candidate.id === roleId);
    if (role) set({ extraStaffing: [...template.extraStaffing, { id: newId("vakt"), roleId: role.id, roleName: role.name, neededCount: 1 }] });
  };
  const setExtraCount = (id: string, neededCount: number) =>
    set({ extraStaffing: template.extraStaffing.map((extra) => (extra.id === id ? { ...extra, neededCount: Math.max(1, neededCount || 1) } : extra)) });
  const removeExtra = (id: string) => set({ extraStaffing: template.extraStaffing.filter((extra) => extra.id !== id) });
  const tasks = tasksOfTemplate(template, roles);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!template.name.trim()) return setError("Malen må ha et navn.");
    if (!template.title.trim()) return setError("Arrangementene fra malen må ha en tittel.");
    if (minutesOf(template.time) === null) return setError("Malen må ha et klokkeslett.");
    if (template.program.some((item) => !item.title.trim())) return setError("Hvert punkt i programmet må ha en tittel. Ta bort de tomme.");

    setSaving(true);
    const saved = await onSave({
      ...template,
      name: template.name.trim(),
      title: template.title.trim(),
      program: [...template.program].sort(byTime).map((item) => ({ ...item, title: item.title.trim() })),
    });
    setSaving(false);
    if (saved) onClose();
    else setError("Malen kunne ikke lagres.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-form-heading"
        className="bg-slate-50 w-full max-w-4xl sm:rounded-3xl sm:max-h-[calc(100vh-2rem)] shadow-2xl flex flex-col overflow-hidden text-slate-800"
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 bg-white border-b border-slate-200">
          <h2 id="template-form-heading" className="text-lg font-black text-slate-900 flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-indigo-600" aria-hidden="true" />
            {isNew ? "Ny mal" : "Rediger mal"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Lukk" className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 sm:px-8 py-6 space-y-6">
            <section aria-labelledby="template-form-event" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
              <h3 id="template-form-event" className={sectionTitle}>
                Malen og arrangementet
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="template-name" className={label}>
                    Navn på malen
                  </label>
                  <input id="template-name" type="text" value={template.name} onChange={(e) => set({ name: e.target.value })} placeholder="f.eks. Gudstjeneste" className={field} />
                </div>
                <div>
                  <label htmlFor="template-title" className={label}>
                    Tittel på arrangementene
                  </label>
                  <input id="template-title" type="text" value={template.title} onChange={(e) => set({ title: e.target.value })} className={field} />
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="template-time" className={label}>
                    Starter kl.
                  </label>
                  <input id="template-time" type="time" value={template.time} onChange={(e) => set({ time: e.target.value })} className={field} />
                </div>
                <div>
                  <label htmlFor="template-length" className={label}>
                    Varer (minutter)
                  </label>
                  <input
                    id="template-length"
                    type="number"
                    min={0}
                    step={1}
                    value={template.durationMinutes}
                    onChange={(e) => set({ durationMinutes: Math.max(0, Number(e.target.value) || 0) })}
                    className={field}
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="template-location" className={label}>
                    Sted
                  </label>
                  <input
                    id="template-location"
                    type="text"
                    value={template.location ?? ""}
                    onChange={(e) => set({ location: e.target.value || undefined })}
                    placeholder={`Tomt felt vises som «${DEFAULT_LOCATION}»`}
                    className={field}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {withPlanner && (
                  <div>
                    <label htmlFor="template-group" className={label}>
                      Ansvarlig gruppe
                    </label>
                    <select id="template-group" value={template.groupId ?? ""} onChange={(e) => set({ groupId: e.target.value || undefined })} className={field}>
                      <option value="">Velges når arrangementet opprettes</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="template-visibility" className={label}>
                    Hvem ser arrangementene
                  </label>
                  <select id="template-visibility" value={template.visibility} onChange={(e) => set({ visibility: e.target.value as GatheringVisibility })} className={field}>
                    <option value="offentlig">Offentlig: står i kalenderen på nettsiden</option>
                    <option value="fremhevet">Fremhevet: løftes fram på forsiden</option>
                    <option value="intern">Kun intern: vises bare i planleggeren</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input type="checkbox" checked={template.isGudstjeneste} onChange={(e) => set({ isGudstjeneste: e.target.checked })} className="w-4 h-4 rounded border-slate-300" />
                Dette er en gudstjeneste
              </label>
            </section>

            {withPlanner && (
              <section aria-labelledby="template-form-program" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h3 id="template-form-program" className={sectionTitle}>
                  <Clock className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                  Program
                </h3>
                <p className="text-xs text-slate-600">
                  Klokkeslettene gjelder når arrangementet starter kl. {template.time}. Starter et arrangement til en annen tid, flytter hele programmet seg
                  etter. Rollen på et punkt blir en oppgave som skal bemannes. Dra i håndtaket for å flytte et punkt opp eller ned.
                </p>
                {template.program.length === 0 ? (
                  <p className="text-xs text-slate-500">Malen har ikke noe program ennå.</p>
                ) : (
                  <ol className="space-y-2">
                    {template.program.map((item, index) => (
                      <li
                        key={item.id}
                        onDragOver={(event) => handleProgramDragOver(event, index)}
                        onDrop={(event) => handleProgramDrop(event, index)}
                        className={`grid grid-cols-[auto_5.5rem_4.5rem_1fr] lg:grid-cols-[auto_6rem_5rem_1fr_11rem_auto] gap-2 items-center p-2 rounded-xl border transition-colors ${
                          draggedProgramIndex === index ? "opacity-50" : ""
                        } ${dragOverProgramIndex === index ? "border-indigo-400 bg-indigo-50/60" : "bg-slate-50 border-slate-200"}`}
                      >
                        <button
                          type="button"
                          draggable
                          aria-label={`Flytt programpunkt ${index + 1}`}
                          onDragStart={(event) => handleProgramDragStart(event, index)}
                          onDragEnd={handleProgramDragEnd}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 cursor-grab active:cursor-grabbing touch-none"
                        >
                          <GripVertical className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <input
                          type="time"
                          aria-label={`Klokkeslett for punkt ${index + 1}`}
                          value={itemClock(template.time, item)}
                          onChange={(e) => setItemClock(item.id, e.target.value)}
                          onBlur={sortProgram}
                          className={small}
                        />
                        <input
                          type="number"
                          min={0}
                          aria-label={`Minutter for punkt ${index + 1}`}
                          value={item.durationMinutes}
                          onChange={(e) => setItem(item.id, { durationMinutes: Math.max(0, Number(e.target.value) || 0) })}
                          className={small}
                        />
                        <input
                          type="text"
                          aria-label={`Tittel på punkt ${index + 1}`}
                          value={item.title}
                          onChange={(e) => setItem(item.id, { title: e.target.value })}
                          placeholder="Hva skjer"
                          className={small}
                        />
                        <select
                          aria-label={`Rolle for punkt ${index + 1}`}
                          value={roles.find((role) => role.id === item.roleId)?.id ?? ""}
                          onChange={(e) => setItemRole(item.id, e.target.value)}
                          className={`${small} col-span-2 lg:col-span-1`}
                        >
                          <option value="">{item.roleName && !roles.some((role) => role.id === item.roleId) ? `${roleNameOf(item, roles)} (ikke i rollelisten)` : "Ingen rolle"}</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center justify-end">
                          <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label={`Flytt punkt ${index + 1} opp`} className={iconButton}>
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, 1)}
                            disabled={index === template.program.length - 1}
                            aria-label={`Flytt punkt ${index + 1} ned`}
                            className={iconButton}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => removeItem(item.id)} aria-label={`Ta bort punkt ${index + 1}`} className={iconButton}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <button
                  type="button"
                  onClick={addItem}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:border-indigo-400 text-sm font-bold text-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                  Legg til punkt
                </button>
              </section>
            )}

            {withPlanner && (
              <section aria-labelledby="template-form-staffing" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h3 id="template-form-staffing" className={sectionTitle}>
                  <ListChecks className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                  Oppgaver som skal bemannes
                </h3>
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-500">Ingen ennå. Sett en rolle på et punkt i programmet, eller legg til en vakt her.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {tasks.map((task) => {
                      const extra = template.extraStaffing.find((candidate) => roleNameOf(candidate, roles) === task.title);
                      return (
                        <li key={task.key} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                          <span>
                            <span className="font-bold text-slate-900">{task.title}</span>
                            <span className="block text-[11px] text-slate-500">{task.from === "program" ? "Fra programmet" : "Ekstra vakt"}</span>
                          </span>
                          {extra ? (
                            <span className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                aria-label={`Antall på ${task.title}`}
                                value={extra.neededCount}
                                onChange={(e) => setExtraCount(extra.id, Number(e.target.value))}
                                className={`${small} w-20`}
                              />
                              <button type="button" onClick={() => removeExtra(extra.id)} aria-label={`Ta bort ekstra vakt ${task.title}`} className={iconButton}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">1 person</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div>
                  <label htmlFor="template-extra" className={label}>
                    Legg til en vakt som ikke står i programmet, eller en rolle som trenger flere enn én
                  </label>
                  <select
                    id="template-extra"
                    value=""
                    onChange={(e) => addExtra(e.target.value)}
                    className={`${field} max-w-sm`}
                  >
                    <option value="">Velg rolle …</option>
                    {roles
                      .filter((role) => !template.extraStaffing.some((extra) => extra.roleId === role.id))
                      .map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                  </select>
                </div>
              </section>
            )}

            <section aria-labelledby="template-form-website" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
              <h3 id="template-form-website" className={sectionTitle}>
                <ImageIcon className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                På nettsiden
              </h3>
              <p className="text-xs text-slate-600">Bildet og teksten her følger med hvert arrangement fra malen, og kan byttes på det enkelte arrangementet.</p>
              {websiteOpen ? (
                <Suspense fallback={<p className="text-xs text-slate-500">Laster …</p>}>
                  <GatheringWebsiteFields
                    values={{
                      imageUrl: template.imageUrl ?? "",
                      imageAlt: template.imageAlt ?? "",
                      summary: template.summary ?? "",
                      content: template.content ?? "",
                      linkUrl: template.linkUrl ?? "",
                      linkLabel: template.linkLabel ?? "",
                    }}
                    onChange={(changes) => set(Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value || undefined])))}
                  />
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
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                Lagre mal
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
