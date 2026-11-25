import React, { useEffect, useMemo, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { GatheringDetail, EditableTask } from "./gatheringDetail";
import { sortVolunteerRoles } from "../../utils/roleStaffing";
import { useConfirm } from "../ConfirmProvider";

interface EditTaskDialogProps {
  detail: GatheringDetail;
  /** The task as it was when the dialog opened. */
  task: EditableTask;
  showToast: (text: string) => void;
  onClose: () => void;
}

export const EditTaskDialog: React.FC<EditTaskDialogProps> = ({ detail, task, showToast, onClose }) => {
  const confirmInPage = useConfirm();
  const { allGroups, volunteerRoles, group, updateTask, deleteTask } = detail;

  const [editingTask, setEditingTask] = useState<EditableTask>(task);

  const preferredGroupId = group?.id;
  const sortedRoles = useMemo(
    () => sortVolunteerRoles(volunteerRoles, preferredGroupId),
    [volunteerRoles, preferredGroupId]
  );
  const selectedRole = sortedRoles.find((r) => r.id === editingTask.volunteerRoleId);
  const teamFieldVisible = Boolean(selectedRole?.groupId || editingTask.groupId);

  useEffect(() => {
    if (!selectedRole) return;
    setEditingTask((prev) => ({
      ...prev,
      title: selectedRole.name,
      groupId: selectedRole.groupId || prev.groupId,
    }));
  }, [editingTask.volunteerRoleId, selectedRole]);

  const handleSaveTaskEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask.volunteerRoleId) {
      showToast("Velg en rolle fra biblioteket.");
      return;
    }
    if (!selectedRole) {
      showToast("Rollen finnes ikke i biblioteket.");
      return;
    }

    const res = updateTask(editingTask.id, {
      title: selectedRole.name,
      volunteerRoleId: editingTask.volunteerRoleId,
      groupId: selectedRole.groupId ? editingTask.groupId : undefined,
      neededCount: editingTask.neededCount || 1,
      description: editingTask.description?.trim() || undefined,
      instruction: undefined,
    });

    if (res.success) {
      showToast("Oppgaven ble oppdatert!");
      onClose();
    } else {
      showToast(res.error || "Kunne ikke oppdatere oppgaven.");
    }
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (await confirmInPage(`Er du sikker på at du vil fjerne oppgaven «${taskTitle}» fra samlingen?`, { yes: "Fjern", danger: true })) {
      const res = deleteTask(taskId);
      if (res.success) {
        showToast(`Oppgaven «${taskTitle}» ble slettet.`);
        onClose();
      } else {
        showToast(res.error || "Kunne ikke slette oppgaven.");
      }
    }
  };

  return (
    <div
      id="modal-admin-edit-task"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={() => onClose()}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
              Administrativ oppgavekontroll
            </span>
            <h3 className="text-base font-extrabold text-slate-900 leading-tight">
              Rediger oppgave & bemanning
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveTaskEdit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Rolle fra biblioteket</label>
            <select
              value={editingTask.volunteerRoleId || ""}
              onChange={(e) =>
                setEditingTask({
                  ...editingTask,
                  volunteerRoleId: e.target.value || undefined,
                })
              }
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800 cursor-pointer"
              required
            >
              <option value="">Velg rolle...</option>
              {sortedRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          {teamFieldVisible && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Ansvarlig tjenestegruppe</label>
              <select
                value={editingTask.groupId || ""}
                onChange={(e) => setEditingTask({ ...editingTask, groupId: e.target.value || undefined })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800 cursor-pointer"
              >
                {allGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.category || "gruppe"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Bemanningsbehov (antall personer)</label>
            <input
              type="number"
              min="1"
              max="20"
              value={editingTask.neededCount}
              onChange={(e) =>
                setEditingTask({
                  ...editingTask,
                  neededCount: parseInt(e.target.value, 10) || 1,
                })
              }
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleDeleteTask(editingTask.id, editingTask.title)}
              className="text-xs text-red-600 hover:text-red-800 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Slett oppgave
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onClose()}
                className="px-3 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
              >
                Lagre endringer
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
