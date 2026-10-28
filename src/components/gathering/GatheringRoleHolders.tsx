import React from "react";
import { AlertTriangle } from "lucide-react";
import type { Assignment, Person, Task, VolunteerRole } from "../../types";
import { LEADER_ROLE_NAMES, SPEAKER_ROLE_NAMES, roleHolderNamesOf, roleTasksOf } from "../../utils/gatherings";

interface GatheringRoleHoldersProps {
  gatheringId: string;
  tasks: Pick<Task, "id" | "gatheringId" | "volunteerRoleId" | "title">[];
  assignments: Pick<Assignment, "taskId" | "personId" | "response" | "personName">[];
  roles: Pick<VolunteerRole, "id" | "name">[];
  persons: Pick<Person, "id" | "name">[];
}

/**
 * Who leads and who speaks at the gathering, in one line under the header. Each part is there only when the
 * gathering has such a task. A task with nobody who has said yes is «ledig», with a warning.
 */
export const GatheringRoleHolders: React.FC<GatheringRoleHoldersProps> = ({ gatheringId, tasks, assignments, roles, persons }) => {
  const parts = [
    { label: "Møteleder", roleNames: LEADER_ROLE_NAMES },
    { label: "Taler", roleNames: SPEAKER_ROLE_NAMES },
  ]
    .filter(({ roleNames }) => roleTasksOf(gatheringId, roleNames, tasks, roles).length > 0)
    .map(({ label, roleNames }) => ({ label, names: roleHolderNamesOf(gatheringId, roleNames, tasks, assignments, roles, persons) }));

  if (parts.length === 0) return null;

  return (
    <p className="text-xs text-slate-700 mt-1 flex flex-wrap items-center gap-x-1.5">
      {parts.map((part, index) => (
        <React.Fragment key={part.label}>
          {index > 0 && <span aria-hidden="true" className="text-slate-400">·</span>}
          <span>
            <span className="text-slate-500">{part.label}:</span>{" "}
            {part.names.length > 0 ? (
              part.names.join(", ")
            ) : (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
                ledig
              </span>
            )}
          </span>
        </React.Fragment>
      ))}
    </p>
  );
};
