import { BadgeCheck, CalendarX, Plus, Trash2 } from "lucide-react";
import { studioDetailCard, studioDetailInput, studioDetailMuted } from "../studioDetailTheme";
import { PersonSaveButton } from "./PersonSaveButton";
import type { Setter, UnavailablePeriod } from "./personShared";

interface PersonAvailabilityCardProps {
  unavailablePeriods: UnavailablePeriod[];
  newUnavailFrom: string;
  setNewUnavailFrom: Setter<string>;
  newUnavailTo: string;
  setNewUnavailTo: Setter<string>;
  newUnavailReason: string;
  setNewUnavailReason: Setter<string>;
  policeCert: string;
  setPoliceCert: Setter<string>;
  handleAddUnavailablePeriod: () => void;
  handleRemoveUnavailablePeriod: (idx: number) => void;
  justSaved: boolean;
}

// The part of the tab «Grupper og tjeneste» with «Borte fra–til», the police certificate and the save button
export function PersonAvailabilityCard({
  unavailablePeriods,
  newUnavailFrom,
  setNewUnavailFrom,
  newUnavailTo,
  setNewUnavailTo,
  newUnavailReason,
  setNewUnavailReason,
  policeCert,
  setPoliceCert,
  handleAddUnavailablePeriod,
  handleRemoveUnavailablePeriod,
  justSaved,
}: PersonAvailabilityCardProps) {
  return (
    <div className={studioDetailCard}>
      {/* Utilgjengelighetskalender ("Borte fra–til") */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5">
            <CalendarX className="w-3.5 h-3.5 text-amber-600" />
            Utilgjengelig / Bortreist:
          </span>
          <span className="text-[10px] text-[var(--studio-muted)]">
            {unavailablePeriods.length} perioder registrert
          </span>
        </div>

        {unavailablePeriods.length > 0 && (
          <div className="space-y-1.5 bg-[var(--studio-row)] p-2.5 rounded-xl border border-[var(--studio-border)]">
            {unavailablePeriods.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-1 px-2 bg-[var(--studio-row)] rounded-lg border border-[var(--studio-border)] text-slate-200"
              >
                <div>
                  <strong className="text-white">
                    {p.from} til {p.to}
                  </strong>
                  {p.reason && <span className="text-[var(--studio-muted)] ml-1.5">({p.reason})</span>}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveUnavailablePeriod(idx)}
                  className="text-rose-500 hover:text-rose-700 text-[11px] p-1 cursor-pointer"
                  title="Fjern fraværsperiode"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Period Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
          <input
            type="date"
            value={newUnavailFrom}
            onChange={(e) => setNewUnavailFrom(e.target.value)}
            placeholder="Fra dato"
            className={studioDetailInput}
          />
          <input
            type="date"
            value={newUnavailTo}
            onChange={(e) => setNewUnavailTo(e.target.value)}
            placeholder="Til dato"
            className={studioDetailInput}
          />
          <div className="flex gap-1">
            <input
              type="text"
              value={newUnavailReason}
              onChange={(e) => setNewUnavailReason(e.target.value)}
              placeholder="Årsak (f.eks. Ferie)"
              className={`w-full ${studioDetailInput}`}
            />
            <button
              type="button"
              onClick={handleAddUnavailablePeriod}
              className="px-2 py-1.5 bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-white rounded-lg shrink-0 cursor-pointer"
              title="Legg til fravær"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Politiattest for barne- og ungdomsarbeid */}
      <div className="space-y-1.5 pt-1 border-t border-[var(--studio-border)]">
        <label
          htmlFor="input-edit-person-police"
          className="text-xs font-bold text-[var(--studio-muted)] flex items-center justify-between"
        >
          <span className="flex items-center gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
            Politiattest (gyldig til dato):
          </span>
          {policeCert ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Registrert ({policeCert})
            </span>
          ) : (
            <span className="text-[10px] text-[var(--studio-muted)] font-normal">Ikke registrert</span>
          )}
        </label>
        <input
          type="date"
          id="input-edit-person-police"
          value={policeCert}
          onChange={(e) => setPoliceCert(e.target.value)}
          className={studioDetailInput}
        />
        <p className={studioDetailMuted}>
          Påkrevd for frivillige som arbeider med mindreårige (søndagsskole og barneleir).
        </p>
      </div>

      <PersonSaveButton justSaved={justSaved} />
    </div>
  );
}
