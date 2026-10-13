import React, { useMemo, useState } from "react";
import {
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { DEFAULT_VOLUNTEER_ROLE_NAMES, rolesMissingStandardInstruction } from "../../../data/defaultVolunteerRoles";
import { VolunteerRole } from "../../../types";
import {
  patchVolunteerRole,
  persistVolunteerRole,
  removeVolunteerRole,
  seedDefaultVolunteerRoles,
} from "../../../services/volunteerRoles";
import { StudioData, ShowFeedback } from "../studio";

interface RolesTabProps {
  studio: StudioData;
  showFeedback?: ShowFeedback;
}

export const RolesTab: React.FC<RolesTabProps> = ({ studio, showFeedback }) => {
  const { adminVolunteerRoles, adminGroups } = studio;

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleInstruction, setNewRoleInstruction] = useState("");
  const [newRoleGroupId, setNewRoleGroupId] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [editingRole, setEditingRole] = useState<VolunteerRole | null>(null);
  const [instructionDraft, setInstructionDraft] = useState("");
  const [teamDraft, setTeamDraft] = useState("");

  const filteredRoles = useMemo(() => {
    if (!searchTerm.trim()) return adminVolunteerRoles;
    const term = searchTerm.toLowerCase().trim();
    return adminVolunteerRoles.filter((role) => {
      return (
        role.name.toLowerCase().includes(term) ||
        (role.instruction && role.instruction.toLowerCase().includes(term))
      );
    });
  }, [adminVolunteerRoles, searchTerm]);

  const groupName = (groupId?: string) =>
    groupId ? adminGroups.find((g) => g.group.id === groupId)?.group.name || "Ukjent team" : null;

  const openInstructionEditor = (role: VolunteerRole) => {
    setEditingRole(role);
    setInstructionDraft(role.instruction || "");
    setTeamDraft(role.groupId || "");
  };

  const closeInstructionEditor = () => {
    setEditingRole(null);
    setInstructionDraft("");
    setTeamDraft("");
  };

  const handleSaveInstruction = async () => {
    if (!editingRole || isSavingRole) return;
    setIsSavingRole(true);
    try {
      await patchVolunteerRole(editingRole.id, {
        instruction: instructionDraft.trim(),
        groupId: teamDraft || undefined,
      });
      showFeedback?.(`«${editingRole.name}» er oppdatert.`);
      closeInstructionEditor();
    } catch (err) {
      showFeedback?.(err instanceof Error ? err.message : "Kunne ikke lagre instruksen", "error");
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingRole) return;
    const name = newRoleName.trim();
    if (!name) {
      showFeedback?.("Rollen må ha et navn.", "error");
      return;
    }
    const nextOrder =
      adminVolunteerRoles.reduce((max, role) => Math.max(max, role.sortOrder), -1) + 1;
    setIsSavingRole(true);
    try {
      await persistVolunteerRole({
        name,
        instruction: newRoleInstruction.trim(),
        sortOrder: nextOrder,
        groupId: newRoleGroupId || undefined,
      });
      setNewRoleName("");
      setNewRoleInstruction("");
      setNewRoleGroupId("");
      setIsCreating(false);
      showFeedback?.(`Rollen «${name}» ble opprettet.`);
    } catch (err) {
      showFeedback?.(err instanceof Error ? err.message : "Kunne ikke opprette rollen", "error");
    } finally {
      setIsSavingRole(false);
    }
  };

  // Roles without an instruction, that the standard set has one for. One press fills them in.
  const missingInstructions = useMemo(() => rolesMissingStandardInstruction(adminVolunteerRoles), [adminVolunteerRoles]);
  const [isFilling, setIsFilling] = useState(false);
  const handleFillInstructions = async () => {
    if (isFilling || missingInstructions.length === 0) return;
    setIsFilling(true);
    try {
      for (const { role, instruction } of missingInstructions) await patchVolunteerRole(role.id, { instruction });
      showFeedback?.(`Standardinstruks er lagt inn på ${missingInstructions.length} ${missingInstructions.length === 1 ? "rolle" : "roller"}.`);
    } catch (err) {
      showFeedback?.(err instanceof Error ? err.message : "Kunne ikke legge inn instruksene", "error");
    } finally {
      setIsFilling(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (isSeeding || adminVolunteerRoles.length > 0) return;
    setIsSeeding(true);
    try {
      await seedDefaultVolunteerRoles();
      showFeedback?.(`La inn ${DEFAULT_VOLUNTEER_ROLE_NAMES.length} standardroller.`);
    } catch (err) {
      showFeedback?.(err instanceof Error ? err.message : "Kunne ikke legge inn standardroller", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDeleteRole = async (role: VolunteerRole) => {
    if (!window.confirm(`Slette rollen «${role.name}»? Instruksen går også tapt.`)) return;
    try {
      await removeVolunteerRole(role.id);
      if (editingRole?.id === role.id) closeInstructionEditor();
      showFeedback?.(`Rollen «${role.name}» ble slettet.`);
    } catch (err) {
      showFeedback?.(err instanceof Error ? err.message : "Kunne ikke slette rollen", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)] flex items-center gap-2">
            <span>Roller</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--studio-surface)] text-[var(--studio-muted)] font-normal">
              {adminVolunteerRoles.length} roller
            </span>
          </h2>
          <p className="text-xs text-[var(--studio-muted)] mt-1">
            Tjenesteroller med instruks for gudstjeneste og arrangementer.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreating ? "Lukk skjema" : "Ny rolle"}</span>
        </button>
      </div>

      {adminVolunteerRoles.length === 0 && (
        <div className="p-4 rounded-2xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-5 h-5 text-[var(--studio-icon)] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[var(--studio-text)]">Legg inn standardroller</p>
              <p className="text-[var(--studio-muted)]">
                Starter med {DEFAULT_VOLUNTEER_ROLE_NAMES.length} roller som Baking, Lyd, Lovsang og Møteleder.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={isSeeding}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold shrink-0 shadow-sm cursor-pointer flex items-center gap-2"
          >
            {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{isSeeding ? "Legger inn..." : "Legg inn standardroller"}</span>
          </button>
        </div>
      )}

      {missingInstructions.length > 0 && (
        <div id="fill-standard-instructions" className="p-4 rounded-2xl bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <FileText className="w-5 h-5 text-[var(--studio-icon)] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[var(--studio-text)]">
                {missingInstructions.length} {missingInstructions.length === 1 ? "rolle mangler" : "roller mangler"} instruks
              </p>
              <p className="text-[var(--studio-muted)]">
                Standardinstruksen kan legges inn på {missingInstructions.map(({ role }) => role.name).join(", ")}. Roller som alt har en instruks, røres ikke, og
                du kan endre teksten etterpå.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFillInstructions}
            disabled={isFilling}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold shrink-0 shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            {isFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{isFilling ? "Legger inn..." : "Legg inn standardinstrukser"}</span>
          </button>
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleCreateRole} className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-3">
          <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--studio-icon)]" />
            <span>Opprett ny rolle</span>
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="f.eks. Teknikk eller Vertskap"
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs"
              required
            />
            <select
              value={newRoleGroupId}
              onChange={(e) => setNewRoleGroupId(e.target.value)}
              className="sm:w-48 px-3 py-2 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs cursor-pointer"
            >
              <option value="">Uten team</option>
              {adminGroups.map((g) => (
                <option key={g.group.id} value={g.group.id}>
                  {g.group.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isSavingRole}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
            >
              {isSavingRole ? "Lagrer..." : "Lagre rolle"}
            </button>
          </div>
          <textarea
            value={newRoleInstruction}
            onChange={(e) => setNewRoleInstruction(e.target.value)}
            rows={4}
            placeholder="Instruks for rollen (valgfritt) — hva personen skal gjøre og når de møter opp"
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs leading-relaxed resize-y"
          />
        </form>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-[var(--studio-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Søk i roller..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs placeholder:text-[var(--studio-muted)] focus:outline-hidden focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredRoles.map((role) => (
          <div
            key={role.id}
            className="p-4 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] hover:border-[var(--studio-accent-border)] shadow-xs transition-colors flex flex-col min-h-[120px]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="w-9 h-9 rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-[var(--studio-accent-text)]" />
              </div>
              <button
                type="button"
                onClick={() => handleDeleteRole(role)}
                className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer"
                title="Slett rolle"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <h3 className="font-bold text-[var(--studio-text)] text-sm mt-3 flex-1">{role.name}</h3>
            {groupName(role.groupId) && (
              <p className="text-[10px] text-[var(--studio-muted)] mt-1">{groupName(role.groupId)}</p>
            )}

            <div className="flex items-center justify-end mt-4 pt-3 border-t border-[var(--studio-border)]">
              <button
                type="button"
                onClick={() => openInstructionEditor(role)}
                className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-link)] hover:text-[var(--studio-link-hover)] flex items-center gap-1.5 cursor-pointer"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Instruks</span>
                {!role.instruction && <span className="text-[var(--studio-muted)] font-normal normal-case">(tom)</span>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredRoles.length === 0 && adminVolunteerRoles.length > 0 && (
        <p className="text-xs text-[var(--studio-muted)] text-center py-8">Ingen roller matcher søket.</p>
      )}

      {editingRole && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--studio-overlay)]"
          onClick={closeInstructionEditor}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[var(--studio-bg)] border border-[var(--studio-border)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="role-instruction-title"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--studio-border)]">
              <div>
                <h3 id="role-instruction-title" className="text-sm font-bold text-[var(--studio-text)]">
                  Instruks: {editingRole.name}
                </h3>
                <p className="text-[11px] text-[var(--studio-muted)] mt-0.5">
                  Vises for frivillige som får denne rollen på en samling.
                </p>
              </div>
              <button
                type="button"
                onClick={closeInstructionEditor}
                className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text)] hover:bg-[var(--studio-surface)] cursor-pointer"
                aria-label="Lukk"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[var(--studio-muted)] mb-1.5">Tjenesteteam (valgfritt)</label>
                <select
                  value={teamDraft}
                  onChange={(e) => setTeamDraft(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--studio-overlay)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs cursor-pointer"
                >
                  <option value="">Uten team</option>
                  {adminGroups.map((g) => (
                    <option key={g.group.id} value={g.group.id}>
                      {g.group.name}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={instructionDraft}
                onChange={(e) => setInstructionDraft(e.target.value)}
                rows={8}
                placeholder="Skriv hva personen i rollen skal gjøre, når de møter opp, og hva de trenger å vite..."
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--studio-overlay)] border border-[var(--studio-border)] text-[var(--studio-input-text)] text-xs leading-relaxed resize-y min-h-[160px]"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeInstructionEditor}
                  className="px-3.5 py-2 rounded-xl bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveInstruction()}
                  disabled={isSavingRole}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  {isSavingRole ? "Lagrer..." : "Lagre instruks"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
