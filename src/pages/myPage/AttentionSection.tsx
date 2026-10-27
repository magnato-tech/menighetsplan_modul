import React from "react";
import { formatNorwegianDateTime } from "../../utils/dates";
import { MyPageModel } from "./useMyPage";
import { AttentionItem, attentionText } from "./attention";
import { repeatsTitle } from "../../utils/labels";
import {
  Check,
  ChevronRight,
  Clock,
  MapPin,
  X,
} from "lucide-react";

interface AttentionSectionProps {
  page: MyPageModel;
  /** Opens the list of the requests and the free tasks. */
  onShowAll: () => void;
  /** While a semester plan waits, the free tasks give way to it: the button is a plain link. */
  quiet?: boolean;
}

/** From this many free tasks, they are gathered behind the button instead of shown one by one. */
const OPEN_AS_BUTTON_FROM = 3;

export const AttentionSection: React.FC<AttentionSectionProps> = ({ page, onShowAll, quiet = false }) => {
  const { attentionItems, handleAttentionAnswer } = page;
  // A call to a gathering is always shown. Of the requests, one stands on top at a time (the nearest);
  // when it is answered, the next takes its place. Everything else is behind one button.
  const invitations = attentionItems.filter((item) => item.type === "unanswered_invitation");
  const requests = attentionItems.filter((item) => item.type === "task_request");
  const openTasks = attentionItems.filter((item) => item.type === "open_task");
  const firstRequest = requests[0];
  // A free task or two show as cards only when nothing is asked of the user; else the request has the focus
  const openAsCards = !quiet && !firstRequest && openTasks.length > 0 && openTasks.length < OPEN_AS_BUTTON_FROM;
  const hasMore = requests.length > 1 || (openTasks.length > 0 && !openAsCards);
  const buttonText = openTasks.length > 0 ? `Se ledige oppgaver (${openTasks.length})` : `Se alle forespørsler (${requests.length})`;

  const renderCard = (item: AttentionItem, counter?: string) => {
    const text = attentionText(item);

    return (
      <div
        key={item.id}
        className="p-4 bg-gradient-to-br from-amber-50/90 to-amber-100/40 border border-amber-300/80 rounded-2xl shadow-xs space-y-3"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
              {text.label}
            </span>
            {counter && <span className="text-[10px] font-bold text-amber-900">{counter}</span>}
            {item.groupName && !repeatsTitle(item.groupName, item.title) && (
              <span className="text-xs font-semibold text-slate-700">
                {item.groupName}
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {item.title}
          </h3>
        </div>

        <div className="space-y-1 text-xs text-slate-700">
          {item.startsAt && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="font-semibold">
                {formatNorwegianDateTime(item.startsAt)}
              </span>
            </div>
          )}
          {item.location && (
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>{item.location}</span>
            </div>
          )}
          {text.note && (
            <p className="text-[11px] text-slate-600 italic pt-0.5">
              {text.note}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
          <button
            type="button"
            id={`btn-yes-${item.id}`}
            onClick={() => handleAttentionAnswer(item, true)}
            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{text.yes}</span>
          </button>
          {text.no && (
            <button
              type="button"
              id={`btn-no-${item.id}`}
              onClick={() => handleAttentionAnswer(item, false)}
              className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              <span>{text.no}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section
      id="section-trenger-oppmerksomhet"
      className="space-y-2.5 animate-in fade-in duration-200"
    >
      {invitations.length > 0 && <div className="space-y-3">{invitations.map((item) => renderCard(item))}</div>}

      {/* One request at a time, so it has the user's attention; the count says that more will come */}
      {firstRequest && renderCard(firstRequest, requests.length > 1 ? `1 av ${requests.length}` : undefined)}

      {openAsCards && <div className="space-y-3">{openTasks.map((item) => renderCard(item))}</div>}

      {hasMore && quiet && (
        <button type="button" id="btn-see-and-handle-attention" onClick={() => onShowAll()} className="block mx-auto text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 cursor-pointer">
          {buttonText}
        </button>
      )}

      {hasMore && !quiet && (
        /* Everything else in one list: the requests first, then the free tasks */
        <button
          type="button"
          id="btn-see-and-handle-attention"
          onClick={() => onShowAll()}
          className="w-full py-3 px-4 bg-amber-700 hover:bg-amber-800 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <span>{buttonText}</span>
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      )}
    </section>
  );
};
