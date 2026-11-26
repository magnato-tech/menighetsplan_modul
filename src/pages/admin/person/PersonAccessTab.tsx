import { Shield } from "lucide-react";
import type { Person } from "../../../types";
import { studioDetailCard, studioDetailInput } from "../studioDetailTheme";
import { PersonSaveButton } from "./PersonSaveButton";
import type { Setter } from "./personShared";

interface PersonAccessTabProps {
  isFullAdmin: boolean;
  membershipClerk: boolean;
  setMembershipClerk: Setter<boolean>;
  globalRole: Person["globalRole"];
  setGlobalRole: Setter<Person["globalRole"]>;
  justSaved: boolean;
}

// The tab «Tilgang»: the clerk role and the global system role
export function PersonAccessTab({ isFullAdmin, membershipClerk, setMembershipClerk, globalRole, setGlobalRole, justSaved }: PersonAccessTabProps) {
  return (
    <div className={studioDetailCard}>
      {isFullAdmin && (
        <label className="flex items-center gap-2 text-xs text-[var(--studio-text)]">
          <input
            id="check-edit-membership-clerk"
            type="checkbox"
            checked={membershipClerk}
            onChange={(event) => setMembershipClerk(event.target.checked)}
          />
          Protokollansvarlig (Personer i admin og Mitt medlemskap)
        </label>
      )}

      {/* Global systemrolle (Sikrer støtte for flere co-admins) */}
      <div className="space-y-1.5 pt-1 border-t border-[var(--studio-border)]">
        <label
          htmlFor="select-edit-person-role"
          className="text-xs font-bold text-[var(--studio-muted)] flex items-center justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            Global systemrolle:
          </span>
          <span className="text-[10px] text-[var(--studio-muted)] font-normal">
            (Muliggjør 2+ likestilte administratorer)
          </span>
        </label>
        <select
          id="select-edit-person-role"
          value={globalRole}
          onChange={(e) => setGlobalRole(e.target.value as Person["globalRole"])}
          className={studioDetailInput}
        >
          <option value="member">Vanlig tilgang (standard)</option>
          <option value="nettredaktor">Nettredaktør (bare nettsiden, ikke personregisteret eller planleggingen)</option>
          <option value="admin">Administrator (full tilgang til Admin Studio & CMS)</option>
        </select>
      </div>

      <PersonSaveButton justSaved={justSaved} />
    </div>
  );
}
