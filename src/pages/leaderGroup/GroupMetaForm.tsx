import React, { useState } from "react";
import { GROUP_CATEGORIES } from "../../data/groupOptions";
import { GroupCategory, Group } from "../../types";
import { LeaderGroupDetail } from "./leaderGroupDetail";
import {
  Users,
} from "lucide-react";

interface GroupMetaFormProps {
  detail: LeaderGroupDetail;
  group: Group;
  showToast: (text: string) => void;
  onClose: () => void;
}

export const GroupMetaForm: React.FC<GroupMetaFormProps> = ({ detail, group, showToast, onClose }) => {
  const { members, updateGroup, isAdmin } = detail;

  // The form starts from the group as it is when it opens
  const [editName, setEditName] = useState(group.name);
  const [editCategory, setEditCategory] = useState<GroupCategory>(group.category || "tjenestegruppe");
  const [editLeaderId, setEditLeaderId] = useState<string>(group.leaderIds[0] || "");
  const [editDeputyId, setEditDeputyId] = useState<string>(group.deputyLeaderIds?.[0] || "");

  // Handle Meta Save
  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      showToast("Gruppenavn kan ikke være tomt.");
      return;
    }

    const res = updateGroup(group.id, {
      name: editName.trim(),
      category: editCategory,
      ...(isAdmin
        ? {
            leaderIds: editLeaderId ? [editLeaderId] : group.leaderIds,
            deputyLeaderIds: editDeputyId ? [editDeputyId] : [],
          }
        : {}),
    });

    if (res.success) {
      onClose();
      showToast("Gruppedetaljer ble lagret!");
    }
  };

  return (
    <section
      id="section-group-details"
      className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5"
    >
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-emerald-600" />
        <span>Rediger gruppedetaljer</span>
      </h2>

      <form onSubmit={handleSaveMeta} className="space-y-3 pt-1">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Gruppenavn
          </label>
          <input
            type="text"
            id="input-edit-group-name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Kategori
          </label>
          <select
            id="select-edit-group-category"
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value as GroupCategory)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
          >
            {GROUP_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Gruppeleder
            </label>
            <select
              id="select-edit-group-leader"
              value={editLeaderId}
              onChange={(e) => setEditLeaderId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
            >
              <option value="">Velg leder...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nestleder
            </label>
            <select
              id="select-edit-group-deputy"
              value={editDeputyId}
              onChange={(e) => setEditDeputyId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
            >
              <option value="">Ingen nestleder</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="submit"
            id="btn-save-group-meta"
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            Lagre endringer
          </button>
          <button
            type="button"
            onClick={() => onClose()}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Avbryt
          </button>
        </div>
      </form>
    </section>
  );
};
