import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ChevronDown, Clock, Phone, Trash2, X } from "lucide-react";
import type { Assignment, Person } from "../../types";
import { RESPONSE_LABELS } from "../../utils/staffing";

const MENU_HEIGHT = 230;
const MENU_WIDTH = 200;

export type PersonResponse = Assignment["response"];

interface PersonAssignmentMenuProps {
  assignment: Assignment;
  person?: Person;
  response: PersonResponse;
  open: boolean;
  /** May change the status: an admin, or the leader of the task's group. */
  canIntervene: boolean;
  onToggle: () => void;
  onStatusChange: (assignmentId: string, response: PersonResponse, personName?: string) => void;
  onRemovePerson: (assignmentId: string, personName?: string) => void;
  /** chip: the small status chip (other pages). row: a line in «Bemanning» with initials. */
  variant?: "chip" | "row";
}

const CHIP_STYLE: Record<PersonResponse, string> = {
  confirmed: "bg-emerald-50 text-emerald-900 border-emerald-300",
  pending: "bg-amber-50 text-amber-900 border-amber-300",
  withdrawn: "bg-red-50 text-red-900 border-red-300",
  declined: "bg-slate-100 text-slate-600 border-slate-300",
};

/** Two letters for the initials circle: first and last name, or the first letter of one name. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0];
  return letters.toUpperCase();
}

/** The status of one person, with an icon so it is not told by colour alone. */
export const ResponseIcon: React.FC<{ response: PersonResponse; className?: string }> = ({ response, className = "w-3.5 h-3.5" }) => {
  if (response === "confirmed") return <Check className={`${className} text-emerald-600`} aria-hidden />;
  if (response === "pending") return <Clock className={`${className} text-amber-500`} aria-hidden />;
  if (response === "withdrawn") return <AlertTriangle className={`${className} text-red-600`} aria-hidden />;
  return <X className={`${className} text-slate-500`} aria-hidden />;
};

const OPTIONS: { response: "confirmed" | "pending" | "withdrawn"; label: string; style: string }[] = [
  { response: "confirmed", label: "Bekreftet", style: "text-emerald-800 hover:bg-emerald-50" },
  { response: "pending", label: "Forespurt", style: "text-amber-800 hover:bg-amber-50" },
  { response: "withdrawn", label: "Forfall", style: "text-red-700 hover:bg-red-50" },
];

/**
 * One person on a task, as a chip with their status. Pressed, it opens the menu that changes the
 * status: Bekreftet, Forespurt, Forfall, Slett. The name at the top calls the person when the
 * register has their number. Rendered in a portal so it is not clipped at the bottom of the screen.
 */
export const PersonAssignmentMenu: React.FC<PersonAssignmentMenuProps> = ({
  assignment,
  person,
  response,
  open,
  canIntervene,
  onToggle,
  onStatusChange,
  onRemovePerson,
  variant = "chip",
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const name = person?.name || assignment.personName || "Ukjent person";
  const phone = person?.phone?.trim();

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const button = buttonRef.current;
    if (!button) return;

    const place = () => {
      const rect = button.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < MENU_HEIGHT ? Math.max(8, rect.top - MENU_HEIGHT - 4) : rect.bottom + 4;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
      setMenuStyle({ position: "fixed", top, left, width: MENU_WIDTH, zIndex: 100 });
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <>
      {variant === "row" ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={onToggle}
          disabled={!canIntervene}
          aria-haspopup={canIntervene ? "menu" : undefined}
          aria-expanded={canIntervene ? open : undefined}
          className={`w-full min-h-11 flex items-center gap-3 px-4 py-2 text-left border-t border-slate-100 first:border-t-0 disabled:cursor-default ${
            canIntervene ? "cursor-pointer hover:bg-slate-50" : ""
          }`}
        >
          <span className="w-[30px] h-[30px] rounded-full bg-indigo-50 text-indigo-900 text-xs font-bold flex items-center justify-center shrink-0" aria-hidden>
            {initialsOf(name)}
          </span>
          <span
            className={`flex-1 min-w-0 truncate text-sm font-semibold ${
              response === "confirmed" || response === "pending" ? "text-slate-900" : "text-slate-500"
            } ${response === "declined" ? "line-through" : ""}`}
          >
            {name}
          </span>
          {response === "confirmed" && (
            <span className="shrink-0 inline-flex">
              <Check className="w-4 h-4 text-emerald-700" aria-hidden />
              <span className="sr-only">Bekreftet</span>
            </span>
          )}
          {response === "pending" && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
              <Clock className="w-3.5 h-3.5 text-amber-500" aria-hidden />
              Venter
            </span>
          )}
          {response === "withdrawn" && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
              Forfall
            </span>
          )}
          {response === "declined" && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
              <X className="w-3.5 h-3.5" aria-hidden />
              Sa nei
            </span>
          )}
          {canIntervene && <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400 print:hidden" aria-hidden />}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={onToggle}
          disabled={!canIntervene}
          aria-haspopup={canIntervene ? "menu" : undefined}
          aria-expanded={canIntervene ? open : undefined}
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${CHIP_STYLE[response]} ${
            response === "declined" ? "line-through" : ""
          } ${canIntervene ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
        >
          <ResponseIcon response={response} />
          <span>{name}</span>
          {response !== "confirmed" && <span className="text-[10px] font-bold opacity-80">{RESPONSE_LABELS[response]}</span>}
          {canIntervene && <ChevronDown className="w-3 h-3 opacity-50 print:hidden" aria-hidden />}
        </button>
      )}

      {open &&
        menuStyle &&
        createPortal(
          <>
            {/* A press outside closes the menu */}
            <div className="fixed inset-0 z-[99]" onClick={onToggle} aria-hidden />
            <div
              role="menu"
              aria-label={name}
              style={menuStyle}
              className="bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 space-y-0.5 text-sm animate-fadeIn print:hidden"
            >
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s+/g, "")}`}
                  className="px-2 py-2 flex items-center gap-2 font-bold text-slate-900 rounded-lg hover:bg-slate-50 border-b border-slate-100"
                  aria-label={`Ring ${name}, ${phone}`}
                >
                  <Phone className="w-4 h-4 text-indigo-600" aria-hidden />
                  <span className="truncate">{name}</span>
                </a>
              ) : (
                <div className="px-2 py-2 font-bold text-slate-900 border-b border-slate-100 truncate">{name}</div>
              )}
              {OPTIONS.map((option) => (
                <button
                  key={option.response}
                  type="button"
                  role="menuitemradio"
                  aria-checked={response === option.response}
                  onClick={() => onStatusChange(assignment.id, option.response, name)}
                  className={`w-full text-left px-2 py-2 rounded-lg font-medium flex items-center justify-between cursor-pointer ${option.style} ${
                    response === option.response ? "bg-slate-100 font-bold" : ""
                  }`}
                >
                  <span>{option.label}</span>
                  <ResponseIcon response={option.response} className="w-4 h-4" />
                </button>
              ))}
              <div className="border-t border-slate-100 pt-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onRemovePerson(assignment.id, name)}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-red-50 text-red-600 font-semibold flex items-center justify-between cursor-pointer"
                >
                  <span>Slett</span>
                  <Trash2 className="w-4 h-4 text-red-500" aria-hidden />
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
};
