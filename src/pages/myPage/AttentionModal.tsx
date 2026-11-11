import React, { useState } from "react";
import { formatNorwegianDateTime } from "../../utils/dates";
import { MyPageModel } from "./useMyPage";
import { attentionListItems, attentionTags, attentionText, withAttentionTags } from "./attention";
import { repeatsTitle } from "../../utils/labels";
import { MIN_SIDE_DIALOG_OVERLAY, MIN_SIDE_DIALOG_PANEL } from "../../utils/minSideFrame";
import {
  AlertCircle,
  Check,
  Clock,
  X,
} from "lucide-react";

interface AttentionModalProps {
  page: MyPageModel;
  onClose: () => void;
}

export const AttentionModal: React.FC<AttentionModalProps> = ({ page, onClose }) => {
  const { handleAttentionAnswer } = page;
  // The requests first, so what is asked of the user is seen before the free tasks
  const attentionItems = attentionListItems(page.attentionItems);
  const hasRequests = attentionItems.some((item) => item.type === "task_request");
  const hasOpen = attentionItems.some((item) => item.type === "open_task");
  const heading = hasRequests && hasOpen ? "Forespurte og ledige oppgaver" : hasRequests ? "Forespurte oppgaver" : "Ledige oppgaver";
  // The roles pressed in. What is shown, has one of them; with none pressed, everything is shown.
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const tags = attentionTags(attentionItems);
  // A tag whose last item has been answered, no longer narrows anything
  const active = new Set([...chosen].filter((tag) => tags.some((entry) => entry.tag === tag)));
  const shown = withAttentionTags(attentionItems, active);
  const toggle = (tag: string) => {
    const next = new Set(active);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setChosen(next);
  };

  return (
    <div
      id="modal-attention-actions"
      className={`${MIN_SIDE_DIALOG_OVERLAY} animate-in fade-in`}
    >
      <div className={`${MIN_SIDE_DIALOG_PANEL} bg-slate-50`}>
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm text-slate-900">
              {heading} ({active.size > 0 ? `${shown.length} av ${attentionItems.length}` : attentionItems.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {tags.length > 1 && (
          <div className="px-4 py-3 bg-white border-b border-slate-200 space-y-2">
            <p className="text-[11px] text-slate-600">Trykk på det du vil se. Du kan velge flere.</p>
            <div role="group" aria-label="Vis bare disse" className="flex flex-wrap gap-1.5">
              {tags.map(({ tag, count }) => {
                const pressed = active.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => toggle(tag)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${
                      pressed ? "bg-emerald-700 border-emerald-700 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {tag} <span className={pressed ? "text-emerald-100" : "text-slate-500"}>{count}</span>
                  </button>
                );
              })}
              {active.size > 0 && (
                <button type="button" onClick={() => setChosen(new Set())} className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 underline underline-offset-2 cursor-pointer">
                  Vis alle
                </button>
              )}
            </div>
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-1">
          {attentionItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
              <p className="font-bold text-slate-700">Ingen utestående handlinger</p>
              <p>Du har håndtert alle dine saker!</p>
            </div>
          ) : (
            <div className="grid gap-2.5 lg:grid-cols-2">
              {shown.map((item) => {
                const text = attentionText(item);

                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                        {text.label}
                      </span>
                      {item.groupName && !repeatsTitle(item.groupName, item.title) && (
                        <span className="text-xs font-semibold text-slate-600">
                          {item.groupName}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                    {item.startsAt && (
                      <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatNorwegianDateTime(item.startsAt)}</span>
                      </div>
                    )}
                    {text.note && (
                      <p className="text-[11px] text-slate-500 italic">
                        {text.note}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleAttentionAnswer(item, true)}
                        className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{text.yes}</span>
                      </button>
                      {text.no && (
                        <button
                          type="button"
                          onClick={() => handleAttentionAnswer(item, false)}
                          className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-slate-500" />
                          <span>{text.no}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
