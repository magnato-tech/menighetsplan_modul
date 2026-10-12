import React from "react";
import { MemberProposals } from "../groups/MemberProposals";
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
import { HusfellesskapModel } from "./husfellesskapModel";

interface MembersTabProps {
  model: HusfellesskapModel;
  group: Group;
}

export const MembersTab: React.FC<MembersTabProps> = ({ model, group }) => {
  const { members, currentUser, allPersons } = model;
  const canPropose = leadsGroup(group, currentUser.id);
  const canDecide = currentUser.globalRole === "admin";
  const proposals = useGroupProposals(group.id, canPropose || canDecide);

  return (
    <div id="section-husfellesskap-members" className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Gruppens medlemmer ({members.length})
        </span>
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const isGroupLeader = group.leaderIds.includes(member.id);
          const isGroupDeputy = group.deputyLeaderIds?.includes(member.id);

          return (
            <div
              key={member.id}
              id={`hus-member-row-${member.id}`}
              className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-2"
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
                    {member.id === currentUser.id && (
                      <span className="text-[10px] font-medium text-slate-400">(deg)</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {member.phone || member.email || "Ingen kontaktinfo"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <MemberProposals
        proposals={proposals}
        canPropose={canPropose}
        canDecide={canDecide}
        candidates={allPersons.filter((person) => !members.some((member) => member.id === person.id))}
        memberNames={members.map((member) => member.name)}
        proposedBy={currentUser.id}
        onPropose={(proposalName) => {
          proposeMember(group.id, currentUser.id, proposalName).catch((error) => reportWriteError("sende forslaget", error));
        }}
        onWithdraw={(proposalId) => {
          withdrawProposal(proposalId).catch((error) => reportWriteError("trekke tilbake forslaget", error));
        }}
        onAccept={(proposal, personId) => {
          acceptProposal(proposal.id, group.id, personId).catch((error) => reportWriteError("legge til medlemmet", error));
        }}
        onCreate={(proposal) => {
          acceptProposalAsNew(proposal.id, group.id, proposal.name).catch((error) => reportWriteError("opprette personen", error));
        }}
        onDismiss={(proposalId) => {
          dismissProposal(proposalId).catch((error) => reportWriteError("avvise forslaget", error));
        }}
      />
    </div>
  );
};
