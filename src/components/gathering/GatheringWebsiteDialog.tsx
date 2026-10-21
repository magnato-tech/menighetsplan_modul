import React, { Suspense, lazy, useState } from "react";
import { Image as ImageIcon, Save, X } from "lucide-react";
import type { Gathering } from "../../types";
import { formOfGathering, websiteUpdatesOf, type GatheringFormValues } from "../../utils/gatheringForm";
import { formatNorwegianDateTime } from "../../utils/dates";

const GatheringWebsiteFields = lazy(() => import("./GatheringWebsiteFields"));

interface GatheringWebsiteDialogProps {
  gathering: Gathering;
  /** Stores the presentation; the answer says whether it went well. */
  onSave: (updates: Partial<Gathering>) => { success: boolean; error?: string };
  onClose: () => void;
}

/**
 * «Bilde og tekst» for a web editor: the picture, the lead, the text and the link of an event, and
 * nothing of its time, place or staffing, which are the planning's. What is stored is the presentation
 * only (websiteUpdatesOf).
 */
export const GatheringWebsiteDialog: React.FC<GatheringWebsiteDialogProps> = ({ gathering, onSave, onClose }) => {
  const [values, setValues] = useState<GatheringFormValues>(() => formOfGathering(gathering));
  const [error, setError] = useState("");

  const save = () => {
    const result = onSave(websiteUpdatesOf(values));
    if (result.success) onClose();
    else setError(result.error || "Kunne ikke lagre. Prøv igjen.");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="gathering-website-title">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl my-4">
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="gathering-website-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              Bilde og tekst: {gathering.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatNorwegianDateTime(gathering.startsAt)}. Tid, sted og bemanning endres i planleggingen.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Lukk" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <Suspense fallback={<p className="text-sm text-slate-500">Henter feltene …</p>}>
            <GatheringWebsiteFields values={values} onChange={(changes) => setValues((current) => ({ ...current, ...changes }))} />
          </Suspense>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
            Avbryt
          </button>
          <button type="button" onClick={save} className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 cursor-pointer">
            <Save className="w-4 h-4" aria-hidden="true" />
            Lagre endringer
          </button>
        </div>
      </div>
    </div>
  );
};
