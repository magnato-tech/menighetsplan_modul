import React, { useEffect, useState } from "react";
import { formatNorwegianDateTime } from "../../utils/dates";
import { MyPageModel } from "./useMyPage";
import { ATTENTION_DATES_SHOWN, attentionByDate, attentionListItems, attentionTags, attentionText, withAttentionTags } from "./attention";
import { repeatsTitle } from "../../utils/labels";
import { MIN_SIDE_DIALOG_OVERLAY, MIN_SIDE_DIALOG_PANEL } from "../../utils/minSideFrame";
import {
  AlertCircle,
  Check,
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
  // Only the first few dates are shown, until the user asks for the rest
  const [showAll, setShowAll] = useState(false);
  const groups = attentionByDate(shown);
  const visibleGroups = showAll ? groups : groups.slice(0, ATTENTION_DATES_SHOWN);
  const hiddenCount = groups.slice(ATTENTION_DATES_SHOWN).reduce((sum, group) => sum + group.items.length, 0);
  const toggle = (tag: string) => {
    const next = new Set(active);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setChosen(next);
  };

  // Escape closes the window
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
            <div>
              {visibleGroups.map((group) => (
                <React.Fragment key={group.startsAt || "uten-dato"}>
                  <h4 className="text-xs font-bold text-slate-600 px-1 mt-3 first:mt-0">
                    {group.startsAt ? formatNorwegianDateTime(group.startsAt) : "Uten dato"}
                  </h4>
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const text = attentionText(item);
                      const showsPill = text.label === "Trenger vikar" || text.label === "Forespørsel til deg";

                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="text-xs font-bold text-slate-900">{item.title}</h5>
                              {showsPill && (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                                  {text.label}
                                </span>
                              )}
                            </div>
                            {item.groupName && !repeatsTitle(item.groupName, item.title) && (
                              <p className="text-[11px] text-slate-600">{item.groupName}</p>
                            )}
                            {text.note && (
                              <p className="text-[11px] text-slate-500 italic">
                                {text.note}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAttentionAnswer(item, true)}
                              className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
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
                </React.Fragment>
              ))}
              {!showAll && groups.length > ATTENTION_DATES_SHOWN && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-3 mx-auto block text-xs font-bold text-emerald-800 underline underline-offset-2 cursor-pointer"
                >
                  Vis flere datoer ({hiddenCount} oppgaver)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
