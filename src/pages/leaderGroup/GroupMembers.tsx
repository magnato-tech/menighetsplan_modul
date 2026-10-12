import React, { useState } from "react";
import { MemberProposals } from "../../components/groups/MemberProposals";
import { useGroupProposals } from "../../hooks/useMemberProposals";
import {
  acceptProposal,
  acceptProposalAsNew,
  dismissProposal,
  proposeMember,
  withdrawProposal,
} from "../../services/memberProposals";
import { reportWriteError } from "../../services/writeErrors";
import { Group } from "../../types";
import { leadsGroup } from "../../utils/groups";
import { LeaderGroupDetail } from "./leaderGroupDetail";
import {
  Users,
  Plus,
  Trash2,
} from "lucide-react";

interface GroupMembersProps {
  detail: LeaderGroupDetail;
  group: Group;
  showToast: (text: string) => void;
}

export const GroupMembers: React.FC<GroupMembersProps> = ({ detail, group, showToast }) => {
  const { hasLeaderAccess, isAdmin, currentUser, members, availablePersonsToAdd, addGroupMember, removeGroupMember } = detail;
  const canPropose = leadsGroup(group, currentUser.id);
  const proposals = useGroupProposals(group.id, canPropose || isAdmin);

  // Add member selector
  const [selectedPersonToAdd, setSelectedPersonToAdd] = useState<string>("");

  // Handle Add Member
  const handleAddMember = () => {
    if (!selectedPersonToAdd) return;
    const res = addGroupMember(group.id, selectedPersonToAdd);
    if (res.success) {
      setSelectedPersonToAdd("");
      showToast("Personen ble lagt til som deltaker i gruppen!");
    }
  };

  // Handle Remove Member
  const handleRemoveMember = (personId: string, personName: string) => {
    if (confirm(`Er du sikker på at du vil fjerne ${personName} fra gruppen?`)) {
      const res = removeGroupMember(group.id, personId);
      if (res.success) {
        showToast(`${personName} ble fjernet fra gruppen.`);
      }
    }
  };

  return (
    <section
      id="section-group-members"
      className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-emerald-600" />
          <span>Deltakere i gruppen ({members.length})</span>
        </h2>
      </div>

      {/* Member List */}
      <div className="space-y-2">
        {members.map((member) => {
          const isGroupLeader = group.leaderIds.includes(member.id);
          const isGroupDeputy = group.deputyLeaderIds?.includes(member.id);

          return (
            <div
              key={member.id}
              id={`member-row-${member.id}`}
              className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">{member.name}</span>
                    {isGroupLeader && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                        Leder
                      </span>
                    )}
                    {isGroupDeputy && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                        Nestleder
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {member.phone || member.email || "Ingen kontaktinfo"}
                  </p>
                </div>
              </div>

              {/* Remove Member button (disabled for non-leaders and main leader to prevent orphan group) */}
              {hasLeaderAccess && !isGroupLeader && (
                <button
                  type="button"
                  id={`btn-remove-member-${member.id}`}
                  onClick={() => handleRemoveMember(member.id, member.name)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  title="Fjern fra gruppen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <MemberProposals
        proposals={proposals}
        canPropose={canPropose}
        canDecide={isAdmin}
        candidates={availablePersonsToAdd}
        memberNames={members.map((member) => member.name)}
        proposedBy={currentUser.id}
        onPropose={(proposalName) => {
          proposeMember(group.id, currentUser.id, proposalName).catch((error) => reportWriteError("sende forslaget", error));
        }}
        onWithdraw={(proposalId) => {
          withdrawProposal(proposalId).catch((error) => reportWriteError("trekke tilbake forslaget", error));
        }}
        onAccept={(proposal, personId) => {
          acceptProposal(proposal.id, group.id, personId).catch((error) => reportWriteError("legge til deltakeren", error));
        }}
        onCreate={(proposal) => {
          acceptProposalAsNew(proposal.id, group.id, proposal.name).catch((error) => reportWriteError("opprette personen", error));
        }}
        onDismiss={(proposalId) => {
          dismissProposal(proposalId).catch((error) => reportWriteError("avvise forslaget", error));
        }}
      />

      {/* Add Member form - for leaders only */}
      {hasLeaderAccess && isAdmin && (
        availablePersonsToAdd.length > 0 ? (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="text-[11px] font-semibold text-slate-600 block">
              Legg til deltaker:
            </label>
            <div className="flex gap-2">
              <select
                id="select-add-member"
                value={selectedPersonToAdd}
                onChange={(e) => setSelectedPersonToAdd(e.target.value)}
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
              >
                <option value="">Velg person fra listen...</option>
                {availablePersonsToAdd.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                id="btn-add-member"
                onClick={handleAddMember}
                disabled={!selectedPersonToAdd}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Legg til deltaker</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic pt-1">
            Alle registrerte personer er allerede deltakere i denne gruppen.
          </p>
        )
      )}
    </section>
  );
};
