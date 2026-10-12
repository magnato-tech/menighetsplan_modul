import React, { useState } from "react";
import { LayoutTemplate, X } from "lucide-react";
import type { Gathering } from "../../types";
import type { GatheringDetail } from "./gatheringDetail";
import type { GatheringTemplate } from "../../utils/gatheringTemplates";
import { applyTemplateToGathering, formValuesForTemplateApply, planGathering } from "../../utils/gatheringTemplates";
import { formOfGathering } from "../../utils/gatheringForm";

interface ApplyTemplateDialogProps {
  detail: GatheringDetail;
  gathering: Gathering;
  templates: GatheringTemplate[];
  withPlanner: boolean;
  open: boolean;
  showToast: (text: string) => void;
  onClose: () => void;
}

export const ApplyTemplateDialog: React.FC<ApplyTemplateDialogProps> = ({
  detail,
  gathering,
  templates,
  withPlanner,
  open,
  showToast,
  onClose,
}) => {
  const { gatheringTasks, createTask, updateGathering, deleteTask, volunteerRoles } = detail;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const hasContent = gatheringTasks.length > 0 || (gathering.programSchedule?.length ?? 0) > 0;
  const selected = templates.find((template) => template.id === selectedId) ?? null;

  const handleApply = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      for (const task of gatheringTasks) {
        const removed = deleteTask(task.id);
        if (!removed.success) {
          showToast(removed.error || "Kunne ikke fjerne en eksisterende oppgave.");
          return;
        }
      }

      const plan = planGathering(formValuesForTemplateApply(selected, formOfGathering(gathering)), {
        template: selected,
        roles: volunteerRoles,
        withPlanner,
      });

      const result = applyTemplateToGathering(gathering.id, plan, { createTask, updateGathering });
      if (result.success) {
        showToast(`Programmet er hentet fra malen «${selected.name}».`);
        onClose();
      } else {
        showToast(result.error || "Malen kunne ikke legges inn.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/50 print:hidden">
      <div
        role="dialog"
        aria-labelledby="apply-template-title"
        className="bg-slate-50 w-full max-w-lg sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 max-h-[min(90vh,32rem)]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white">
          <h2 id="apply-template-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-indigo-600" aria-hidden="true" />
            Hent fra mal
          </h2>
          <button type="button" onClick={onClose} aria-label="Lukk" className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-slate-600">
              Ingen maler er laget ennå. Lag en mal under «Maler» i menyen, eller bruk «Lag mal» på et arrangement som alt er satt opp.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-600">
                Malen legger inn program og oppgaver på dette arrangementet. Dato, tittel og sted du allerede har satt, blir stående. Klokkeslett i programmet følger
                arrangementets start.
              </p>
              {hasContent && (
                <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Programmet og oppgavene som finnes fra før, blir erstattet når du legger inn malen.
                </p>
              )}
              <ul className="space-y-2">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(template.id)}
                      aria-pressed={selectedId === template.id}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
                        selectedId === template.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300"
                      }`}
                    >
                      <span className="block text-sm font-bold text-slate-900">{template.name}</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        {template.program.length} programpunkter · ca. {template.durationMinutes} min
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-white">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
            Avbryt
          </button>
          <button
            type="button"
            disabled={!selected || busy || templates.length === 0}
            onClick={() => void handleApply()}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl cursor-pointer"
          >
            {busy ? "Legger inn …" : "Legg inn mal"}
          </button>
        </div>
      </div>
    </div>
  );
};
