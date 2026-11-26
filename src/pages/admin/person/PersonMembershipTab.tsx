import { DENOMINATION_ENROLLMENT_LABELS } from "../../../utils/membershipView";
import { todayInNorway } from "../../../utils/birthDate";
import { PersonMembershipLogSection } from "../../../components/admin/PersonMembershipLogSection";
import type { Person } from "../../../types";
import { studioDetailCard, studioDetailInput } from "../studioDetailTheme";
import { PersonSaveButton } from "./PersonSaveButton";
import type { Setter } from "./personShared";

interface PersonMembershipTabProps {
  person: Person;
  congregationMember: boolean;
  setCongregationMember: Setter<boolean>;
  congregationJoinedAt: string;
  setCongregationJoinedAt: Setter<string>;
  denominationMember: boolean;
  setDenominationMember: Setter<boolean>;
  denominationJoinedAt: string;
  setDenominationJoinedAt: Setter<string>;
  denominationEnrollmentType: "" | "A" | "G";
  setDenominationEnrollmentType: Setter<"" | "A" | "G">;
  denominationGEndedAt: string;
  setDenominationGEndedAt: Setter<string>;
  mayWithdraw: boolean;
  onWithdraw: () => void;
  showMembershipLog: boolean;
  justSaved: boolean;
}

// The tab «Medlemskap»: membership fields, withdrawal, and the membership log
export function PersonMembershipTab({
  person,
  congregationMember,
  setCongregationMember,
  congregationJoinedAt,
  setCongregationJoinedAt,
  denominationMember,
  setDenominationMember,
  denominationJoinedAt,
  setDenominationJoinedAt,
  denominationEnrollmentType,
  setDenominationEnrollmentType,
  denominationGEndedAt,
  setDenominationGEndedAt,
  mayWithdraw,
  onWithdraw,
  showMembershipLog,
  justSaved,
}: PersonMembershipTabProps) {
  const membershipFields = (
    <>
      <label className="flex items-center gap-2 text-xs text-[var(--studio-text)]">
        <input
          id="check-edit-congregation"
          type="checkbox"
          checked={congregationMember}
          onChange={(event) => {
            setCongregationMember(event.target.checked);
            if (!event.target.checked) setCongregationJoinedAt("");
          }}
        />
        Medlem i menigheten
      </label>
      {congregationMember && (
        <div className="space-y-1.5 pl-6">
          <label htmlFor="input-congregation-joined" className="text-xs font-bold text-[var(--studio-muted)]">
            Innmeldt i menigheten
          </label>
          <input
            type="date"
            id="input-congregation-joined"
            value={congregationJoinedAt}
            max={todayInNorway()}
            onChange={(event) => setCongregationJoinedAt(event.target.value)}
            className={studioDetailInput}
          />
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-[var(--studio-text)]">
        <input
          id="check-edit-denomination"
          type="checkbox"
          checked={denominationMember}
          onChange={(event) => {
            setDenominationMember(event.target.checked);
            if (!event.target.checked) {
              setDenominationJoinedAt("");
              setDenominationEnrollmentType("");
            }
          }}
        />
        Medlem i kirkesamfunnet
      </label>
      {denominationMember && (
        <div className="space-y-1.5 pl-6">
          <label htmlFor="input-denomination-joined" className="text-xs font-bold text-[var(--studio-muted)]">
            Innmeldt i kirkesamfunnet
          </label>
          <input
            type="date"
            id="input-denomination-joined"
            value={denominationJoinedAt}
            max={todayInNorway()}
            onChange={(event) => setDenominationJoinedAt(event.target.value)}
            className={studioDetailInput}
          />
          <label htmlFor="select-denomination-enrollment-type" className="text-xs font-bold text-[var(--studio-muted)]">
            Type i trossamfunnet
          </label>
          <select
            id="select-denomination-enrollment-type"
            value={denominationEnrollmentType}
            onChange={(event) => setDenominationEnrollmentType(event.target.value as "" | "A" | "G")}
            className={studioDetailInput}
          >
            <option value="">Ikke valgt</option>
            <option value="A">{DENOMINATION_ENROLLMENT_LABELS.A}</option>
            <option value="G">{DENOMINATION_ENROLLMENT_LABELS.G}</option>
          </select>
          <label htmlFor="input-denomination-g-ended" className="text-xs font-bold text-[var(--studio-muted)]">
            Utmeldt som G (barn)
          </label>
          <input
            type="date"
            id="input-denomination-g-ended"
            value={denominationGEndedAt}
            max={todayInNorway()}
            onChange={(event) => setDenominationGEndedAt(event.target.value)}
            className={studioDetailInput}
          />
        </div>
      )}
    </>
  );

  return (
    <>
      <div className={studioDetailCard}>
        {membershipFields}
        {mayWithdraw && (
          <button
            type="button"
            onClick={() => onWithdraw()}
            className="w-full px-4 py-2 rounded-xl border border-rose-300 text-rose-800 text-xs font-bold"
          >
            Meld ut (oppgave til protokoll)
          </button>
        )}
        <PersonSaveButton justSaved={justSaved} />
      </div>
      {showMembershipLog && <PersonMembershipLogSection person={person} />}
    </>
  );
}
