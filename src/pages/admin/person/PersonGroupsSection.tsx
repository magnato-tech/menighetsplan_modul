import { Link } from "react-router-dom";
import { UserCheck, UserCog, Users } from "lucide-react";
import type { Group, Person } from "../../../types";
import type { GroupChoices } from "../../../utils/groupChoice";
import { studioDetailInput, studioDetailLink, studioDetailRow, studioDetailSection } from "../studioDetailTheme";
import type { Setter } from "./personShared";

interface PersonGroupsSectionProps {
  personGroups: Group[];
  person: Person;
  joinChoices: GroupChoices[];
  groupToJoin: string;
  setGroupToJoin: Setter<string>;
  handleJoinGroup: () => void;
  handleLeaveGroup: (groupId: string, groupName: string) => void;
}

// Gruppetilhørighet: the groups the person is in, and adding to or taking out of a group
export function PersonGroupsSection({
  personGroups,
  person,
  joinChoices,
  groupToJoin,
  setGroupToJoin,
  handleJoinGroup,
  handleLeaveGroup,
}: PersonGroupsSectionProps) {
  return (
    <section
      id="person-groups-section"
      className={studioDetailSection}
    >
      <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
        <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[var(--studio-muted)]" />
          Gruppetilhørighet ({personGroups.length})
        </span>
      </div>

      {personGroups.length === 0 ? (
        <p className="text-xs text-[var(--studio-muted)] italic py-2">
          Personen er ikke deltaker i noen grupper ennå.
        </p>
      ) : (
        <div className="space-y-2">
          {personGroups.map((group) => {
            const isLeader = group.leaderIds.includes(person.id);
            const isDeputy = group.deputyLeaderIds?.includes(person.id);

            return (
              <div
                key={group.id}
                className={studioDetailRow}
              >
                <div>
                  <Link
                    to={`/admin/gruppe/${group.id}`}
                    className={`${studioDetailLink} transition-colors`}
                  >
                    {group.name}
                  </Link>
                </div>

                <div className="flex items-center gap-1.5">
                  {isLeader && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      Leder
                    </span>
                  )}
                  {isDeputy && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                      <UserCog className="w-3 h-3" />
                      Nestleder
                    </span>
                  )}
                  {!isLeader && !isDeputy && (
                    <>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-[var(--studio-text)]">
                        Deltaker
                      </span>
                      {/* A leader or deputy is changed on the group's own page, where the next one is chosen */}
                      <button
                        type="button"
                        onClick={() => handleLeaveGroup(group.id, group.name)}
                        aria-label={`Ta ut av ${group.name}`}
                        className="text-[10px] font-bold text-red-700 hover:text-red-900 cursor-pointer"
                      >
                        Ta ut
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {joinChoices.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <select
            id="person-join-group"
            aria-label="Legg til i gruppe"
            value={groupToJoin}
            onChange={(event) => setGroupToJoin(event.target.value)}
            className={`${studioDetailInput} sm:flex-1`}
          >
            <option value="">Legg til i gruppe …</option>
            {joinChoices.map((choice) => (
              <optgroup key={choice.label} label={choice.label}>
                {choice.groups.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            onClick={handleJoinGroup}
            disabled={groupToJoin === ""}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer shrink-0"
          >
            Legg til
          </button>
        </div>
      )}
    </section>
  );
}
