import React, { useState } from "react";
import { Clock, Edit2, LayoutTemplate, ListChecks, Plus, Repeat, Trash2 } from "lucide-react";
import { TemplateFormDialog } from "../../../components/gathering/TemplateFormDialog";
import { useGatheringTemplates } from "../../../hooks/useGatheringTemplates";
import { useLevel } from "../../../hooks/useLevel";
import { deleteGatheringTemplate, saveGatheringTemplate } from "../../../services/gatheringTemplates";
import { defaultGroupId, newGatheringForm } from "../../../utils/gatheringForm";
import { formValuesFromTemplate, standardServiceTemplate, tasksOfTemplate, type GatheringTemplate } from "../../../utils/gatheringTemplates";
import { newId } from "../../../utils/id";
import { hasPlanner } from "../../../utils/level";
import { NewGatheringDialog } from "../NewGatheringDialog";
import { ShowFeedback, StudioData } from "../studio";
import { studioCard } from "../studioTheme";

interface TemplatesTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

const emptyTemplate = (): GatheringTemplate => ({
  id: newId("mal"),
  name: "",
  title: "",
  time: "11:00",
  durationMinutes: 90,
  isGudstjeneste: false,
  visibility: "offentlig",
  program: [],
  extraStaffing: [],
});

/**
 * «Maler»: the congregation's templates for events (see utils/gatheringTemplates.ts). A template
 * is made here, or of an event that is already set up, and a series is planned from one.
 */
export const TemplatesTab: React.FC<TemplatesTabProps> = ({ studio, showFeedback }) => {
  const { adminGroups, adminVolunteerRoles } = studio;
  const { templates, ready } = useGatheringTemplates();
  const withPlanner = hasPlanner(useLevel());
  const groups = adminGroups.map(({ group }) => group);

  const [editing, setEditing] = useState<{ template: GatheringTemplate; isNew: boolean } | null>(null);
  const [planning, setPlanning] = useState<GatheringTemplate | null>(null);

  const addStandard = async () => {
    if (await saveGatheringTemplate(standardServiceTemplate(adminVolunteerRoles))) showFeedback("Standardmalen for gudstjeneste er lagt inn. Tilpass den til deres egen gudstjeneste.");
  };
  const remove = async (template: GatheringTemplate) => {
    if (!confirm(`Vil du slette malen «${template.name}»? Arrangementer som er laget fra den, blir stående.`)) return;
    if (await deleteGatheringTemplate(template.id)) showFeedback("Malen ble slettet");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Maler for arrangementer</h2>
          <p className="text-xs text-[var(--studio-muted)]">
            En mal er oppskriften på et arrangement som holdes igjen og igjen: tid, sted, program og oppgaver. Planlegg en serie fra malen, så ligger
            arrangementene klare i kalenderen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addStandard}
            className="px-4 py-2 rounded-xl bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[var(--studio-text)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <LayoutTemplate className="w-4 h-4 text-[var(--studio-icon)]" />
            <span>Legg inn standardmal for gudstjeneste</span>
          </button>
          <button
            type="button"
            onClick={() => setEditing({ template: emptyTemplate(), isNew: true })}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ny mal</span>
          </button>
        </div>
      </div>

      {!ready ? (
        <p className="text-sm text-[var(--studio-muted)]">Laster malene …</p>
      ) : templates.length === 0 ? (
        <div className={`${studioCard} p-8 text-center space-y-2`}>
          <p className="text-sm font-bold text-[var(--studio-text)]">Ingen maler ennå</p>
          <p className="text-xs text-[var(--studio-muted)]">
            Legg inn standardmalen for gudstjeneste og tilpass den, lag en ny mal fra bunnen, eller åpne et arrangement som alt er satt opp, og velg «Lag mal».
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {templates.map((template) => {
            const tasks = withPlanner ? tasksOfTemplate(template, adminVolunteerRoles) : [];
            return (
              <li
                key={template.id}
                className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <h3 className="font-bold text-[var(--studio-text)] text-base">{template.name}</h3>
                  <p className="text-xs text-[var(--studio-muted)]">
                    «{template.title}» · kl. {template.time}
                    {template.durationMinutes > 0 && ` · ${template.durationMinutes} minutter`}
                    {template.location && ` · ${template.location}`}
                  </p>
                  {withPlanner && (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--studio-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[var(--studio-icon)]" aria-hidden="true" />
                        {template.program.length} programpunkter
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="w-3.5 h-3.5 text-[var(--studio-icon)]" aria-hidden="true" />
                        {tasks.length} oppgaver: {tasks.map((task) => task.title).join(", ") || "ingen"}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setPlanning(template)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Planlegg serie</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ template, isNew: false })}
                    className="px-3 py-1.5 rounded-lg bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[var(--studio-text)] font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Rediger</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(template)}
                    aria-label={`Slett malen ${template.name}`}
                    className="p-2 rounded-lg bg-[var(--studio-bg)] hover:bg-red-950 text-[var(--studio-muted)] hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <TemplateFormDialog
          isNew={editing.isNew}
          initial={editing.template}
          groups={groups}
          roles={adminVolunteerRoles}
          withPlanner={withPlanner}
          onSave={async (template) => {
            const saved = await saveGatheringTemplate(template);
            if (saved) showFeedback(`Malen «${template.name}» er lagret`);
            return saved;
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {planning && (
        <NewGatheringDialog
          studio={studio}
          showFeedback={showFeedback}
          initial={formValuesFromTemplate(planning, newGatheringForm({ groupId: defaultGroupId(groups, withPlanner) }))}
          initialTemplateId={planning.id}
          initialRepeat
          onClose={() => setPlanning(null)}
        />
      )}
    </div>
  );
};
