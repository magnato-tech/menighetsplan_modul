import React, { useState } from "react";
import { Gathering } from "../../types";
import { combineDateAndTimeToIso, parseIsoToDateAndTime } from "../../utils/dates";
import { HusfellesskapModel } from "./husfellesskapModel";
import {
  Check,
  Edit2,
  Trash2,
} from "lucide-react";

interface EditMeetingDialogProps {
  model: HusfellesskapModel;
  /** The meeting being edited. */
  activeMeeting: Gathering;
  showToast: (text: string, type?: "success" | "info") => void;
  onClose: () => void;
}

export const EditMeetingDialog: React.FC<EditMeetingDialogProps> = ({ model, activeMeeting, showToast, onClose }) => {
  const { members, updateMeeting, deleteMeeting, allPersons } = model;

  // The form starts from the meeting as it is when the dialog opens
  const [formTitle, setFormTitle] = useState(activeMeeting.title || "Husfellesskap");
  const [formDate, setFormDate] = useState(() => parseIsoToDateAndTime(activeMeeting.startsAt).date);
  const [formTime, setFormTime] = useState(() => parseIsoToDateAndTime(activeMeeting.startsAt).time);
  const [formLocation, setFormLocation] = useState(activeMeeting.location || "");
  const [formHostId, setFormHostId] = useState(activeMeeting.hostPersonId || "");
  const [formTheme, setFormTheme] = useState(activeMeeting.theme || "");
  const [formBibleText, setFormBibleText] = useState(activeMeeting.bibleText || "");

  const handleSaveEditMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMeeting) return;
    const startsAt = combineDateAndTimeToIso(formDate, formTime || "19:30");
    let computedLocation = formLocation;
    if (!computedLocation && formHostId) {
      const host = allPersons.find((p) => p.id === formHostId);
      if (host) computedLocation = `Hos ${host.name}`;
    }

    const res = await updateMeeting(activeMeeting.id, {
      title: formTitle,
      startsAt,
      location: computedLocation,
      hostPersonId: formHostId || undefined,
      theme: formTheme || undefined,
      bibleText: formBibleText || undefined,
    });

    if (res.success) {
      onClose();
      showToast("Møteinformasjonen ble oppdatert!");
    } else {
      showToast(res.error || "Kunne ikke oppdatere møtet.", "info");
    }
  };

  const handleDeleteMeeting = async () => {
    if (!activeMeeting) return;
    if (window.confirm("Er du sikker på at du vil slette dette møtet?")) {
      const res = await deleteMeeting(activeMeeting.id);
      if (res.success) {
        onClose();
        showToast("Møtet ble slettet.");
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-emerald-600" />
            <span>Endre samling</span>
          </h3>
          <button
            type="button"
            onClick={() => onClose()}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSaveEditMeeting} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Tittel *
            </label>
            <input
              type="text"
              id="input-edit-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Dato *
              </label>
              <input
                type="date"
                id="input-edit-date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Klokkeslett *
              </label>
              <input
                type="time"
                id="input-edit-time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Vert (hos hvem)
              </label>
              <select
                id="select-edit-host"
                value={formHostId}
                onChange={(e) => setFormHostId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
              >
                <option value="">Velg vert blant deltakerne...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Sted / Adresse
              </label>
              <input
                type="text"
                id="input-edit-location"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Tema for samlingen
            </label>
            <input
              type="text"
              id="input-edit-theme"
              value={formTheme}
              onChange={(e) => setFormTheme(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Bibeltekst
            </label>
            <input
              type="text"
              id="input-edit-bible-text"
              value={formBibleText}
              onChange={(e) => setFormBibleText(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              id="btn-delete-meeting"
              onClick={handleDeleteMeeting}
              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Slett møte</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onClose()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="submit"
                id="btn-submit-edit-meeting"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Lagre endringer</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
