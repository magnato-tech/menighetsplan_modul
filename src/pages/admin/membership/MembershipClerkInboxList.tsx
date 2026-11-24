import React from "react";
import type { MembershipApplication, MembershipClerkTask } from "../../../types";
import { clerkTaskHeadline } from "../../../utils/membershipClerkTasks";
import { formatBirthDate } from "../../../utils/birthDate";

export const MembershipClerkInboxList: React.FC<{
  tasks: readonly MembershipClerkTask[];
  applications: readonly MembershipApplication[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}> = ({ tasks, applications, selectedId, onSelect }) => {
  if (tasks.length === 0) {
    return (
      <p className="text-xs text-[var(--studio-muted)] px-3 py-6 text-center rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)]">
        Ingen åpne oppgaver.
      </p>
    );
  }

  return (
    <ul className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] divide-y divide-[var(--studio-border)] overflow-hidden max-h-[min(70vh,640px)] overflow-y-auto">
      {tasks.map((task) => {
        const active = task.id === selectedId;
        const application =
          task.applicationId != null ? applications.find((a) => a.id === task.applicationId) ?? null : null;
        const headline = clerkTaskHeadline(task, application);
        const date =
          task.kind === "withdrawal" && task.withdrawalDate
            ? formatBirthDate(task.withdrawalDate)
            : formatBirthDate(task.createdAt.slice(0, 10));
        return (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onSelect(task.id)}
              className={`w-full text-left px-3 py-2.5 transition-colors ${
                active ? "bg-indigo-600/15 border-l-2 border-l-indigo-500" : "hover:bg-[var(--studio-hover)]"
              }`}
            >
              <p className="text-xs font-bold text-indigo-600 leading-snug">{headline}</p>
              <p className="text-sm font-semibold text-[var(--studio-text)] truncate mt-0.5">
                {task.kind === "loginUnknownEmail" ? task.loginAddress : task.personName}
              </p>
              <p className="text-[10px] text-[var(--studio-muted)] mt-0.5">{date}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
};