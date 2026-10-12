import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Plus,
  Tag,
} from "lucide-react";
import { usePendingProposalCounts } from "../../../hooks/useMemberProposals";
import { GroupCategory } from "../../../types";
import { StudioData, ShowFeedback } from "../studio";

interface GroupsTabProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
}

export const GroupsTab: React.FC<GroupsTabProps> = ({ studio, showFeedback }) => {
  const { adminPersons, adminGroups, createGroup } = studio;
  const waiting = usePendingProposalCounts(true);

  // ==========================================
  // NY GRUPPE FORM STATE (PLANLEGGER)
  // ==========================================
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCategory, setNewGroupCategory] = useState<GroupCategory>("tjenestegruppe");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupTags, setNewGroupTags] = useState("");
  const [newGroupLeaderId, setNewGroupLeaderId] = useState("");
  const [groupFilterCategory, setGroupFilterCategory] = useState<string>("alle");

  const handleCreateNewGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      showFeedback("Gruppen må ha et navn", "error");
      return;
    }
    const tagsArray = newGroupTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    createGroup({
      name: newGroupName.trim(),
      category: newGroupCategory,
      description: newGroupDescription.trim() || undefined,
      tags: tagsArray,
      leaderIds: newGroupLeaderId ? [newGroupLeaderId] : [],
      memberIds: newGroupLeaderId ? [newGroupLeaderId] : [],
    });

    setNewGroupName("");
    setNewGroupDescription("");
    setNewGroupTags("");
    setNewGroupLeaderId("");
    setIsCreatingGroup(false);
    showFeedback(`Gruppen "${newGroupName}" ble opprettet!`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--studio-border)] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--studio-text)]">Grupper & Fellesskap</h2>
          <p className="text-xs text-[var(--studio-muted)]">
            Administrer ledergrupper (stab/styre), strategigrupper (vekstgrupper), tjenestegrupper, husgrupper og interessegrupper.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingGroup(!isCreatingGroup)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isCreatingGroup ? "Lukk skjema" : "Opprett ny gruppe"}</span>
        </button>
      </div>

      {/* Create Group Form */}
      {isCreatingGroup && (
        <form onSubmit={handleCreateNewGroup} className="p-6 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-4">
          <h3 className="text-sm font-bold text-[var(--studio-text)] flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--studio-icon)]" />
            <span>Opprett ny gruppe</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Gruppenavn</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="f.eks. Turgruppe & Friluft eller Vekstgruppe Bønn"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Kategori</label>
              <select
                value={newGroupCategory}
                onChange={(e) => setNewGroupCategory(e.target.value as GroupCategory)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              >
                <option value="ledergruppe">Ledergruppe (Stabsgruppe, lederskapsgruppe, gruppeledere)</option>
                <option value="strategigruppe">Strategigruppe (Vekstgrupper Bønn, Kommunikasjon, Historie)</option>
                <option value="tjenestegruppe">Tjenestegruppe (Lyd, kirkekaffe, søndagsskole)</option>
                <option value="husgruppe">Husgruppe (Husfellesskap i hjemmene)</option>
                <option value="interessegruppe">Interessegruppe (Turgruppe, kor, hobby, senior)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Tagger (kommaseparert)</label>
              <input
                type="text"
                value={newGroupTags}
                onChange={(e) => setNewGroupTags(e.target.value)}
                placeholder="f.eks. vekstgruppe, menighetsskole, bønn"
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[var(--studio-muted)]">Leder</label>
              <select
                value={newGroupLeaderId}
                onChange={(e) => setNewGroupLeaderId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              >
                <option value="">Velg leder (valgfritt)...</option>
                {adminPersons.map((p) => (
                  <option key={p.person.id} value={p.person.id}>
                    {p.person.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="font-semibold text-[var(--studio-muted)]">Beskrivelse</label>
              <textarea
                rows={2}
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Kort beskrivelse av formålet med gruppen..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--studio-input)] border border-[var(--studio-border)] text-[var(--studio-input-text)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingGroup(false)}
              className="px-4 py-2 rounded-xl text-[var(--studio-muted)] hover:text-[var(--studio-text)] text-xs"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm"
            >
              Opprett gruppe
            </button>
          </div>
        </form>
      )}

      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "alle", label: `Alle (${adminGroups.length})` },
          { key: "ledergruppe", label: `Ledergrupper (${adminGroups.filter((g) => g.group.category === "ledergruppe").length})` },
          { key: "strategigruppe", label: `Strategigrupper (${adminGroups.filter((g) => g.group.category === "strategigruppe").length})` },
          { key: "tjenestegruppe", label: `Tjenestegrupper (${adminGroups.filter((g) => g.group.category === "tjenestegruppe").length})` },
          { key: "husgruppe", label: `Husgrupper (${adminGroups.filter((g) => g.group.category === "husgruppe").length})` },
          { key: "interessegruppe", label: `Interessegrupper (${adminGroups.filter((g) => g.group.category === "interessegruppe").length})` },
        ].map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setGroupFilterCategory(chip.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              groupFilterCategory === chip.key
                ? "bg-indigo-600 text-white"
                : "bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:bg-[var(--studio-hover)]"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adminGroups
          .filter((g) => {
            if (groupFilterCategory === "alle") return true;
            return g.group.category === groupFilterCategory;
          })
          .map((g) => {
            const cat = g.group.category || "tjenestegruppe";
            const catBadgeColor =
              cat === "ledergruppe"
                ? "text-[var(--studio-accent-text)] bg-[var(--studio-accent-bg)] border-[var(--studio-accent-border)]"
                : cat === "strategigruppe"
                ? "text-purple-300 bg-purple-950/80 border-purple-800"
                : cat === "husgruppe"
                ? "text-emerald-300 bg-emerald-950/80 border-emerald-800"
                : cat === "interessegruppe"
                ? "text-amber-300 bg-amber-950/80 border-amber-800"
                : "text-[var(--studio-muted)] bg-[var(--studio-bg)] border-[var(--studio-border)]";

            return (
              <div
                key={g.group.id}
                className="p-5 rounded-2xl bg-[var(--studio-surface)] border border-[var(--studio-border)] space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${catBadgeColor}`}
                    >
                      {cat}
                    </span>
                    <span className="text-xs text-[var(--studio-muted)]">{g.members.length} {g.members.length === 1 ? "deltaker" : "deltakere"}</span>
                  </div>

                  <h3 className="font-bold text-[var(--studio-text)] text-lg">{g.group.name}</h3>
                  {(waiting.get(g.group.id) ?? 0) > 0 && (
                    <p className="text-xs font-bold text-amber-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{waiting.get(g.group.id)} venter på godkjenning</span>
                    </p>
                  )}

                  {g.group.description && (
                    <p className="text-xs text-[var(--studio-muted)] line-clamp-2 leading-relaxed">
                      {g.group.description}
                    </p>
                  )}

                  {/* Tags */}
                  {g.group.tags && g.group.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {g.group.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--studio-bg)] text-[var(--studio-muted)]"
                        >
                          <Tag className="w-2.5 h-2.5 text-[var(--studio-muted)]" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-[var(--studio-muted)] pt-1">
                    Leder:{" "}
                    <strong className="text-[var(--studio-text)]">
                      {g.leaders.length > 0 ? g.leaders.map((l) => l.name).join(", ") : "Ikke satt"}
                    </strong>
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--studio-border)] flex items-center justify-between text-xs">
                  <Link
                    to={`/admin/gruppe/${g.group.id}`}
                    className="font-bold text-[var(--studio-icon)] hover:text-[var(--studio-accent-text)]"
                  >
                    Administrer gruppe →
                  </Link>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
