import React, { useState } from "react";
import { combineDateAndTimeToIso, parseIsoToDateAndTime } from "../../utils/dates";
import { HusfellesskapModel } from "./husfellesskapModel";
import {
  Check,
  Plus,
} from "lucide-react";

interface CreateMeetingDialogProps {
  model: HusfellesskapModel;
  showToast: (text: string, type?: "success" | "info") => void;
  onClose: () => void;
}

export const CreateMeetingDialog: React.FC<CreateMeetingDialogProps> = ({ model, showToast, onClose }) => {
  const { members, createMeeting, allPersons } = model;

  // The form starts with next week's date, the usual time and the first member as host
  const [formTitle, setFormTitle] = useState("Husfellesskap");
  const [formDate, setFormDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return parseIsoToDateAndTime(nextWeek.toISOString()).date;
  });
  const [formTime, setFormTime] = useState("19:30");
  const [formLocation, setFormLocation] = useState("");
  const [formHostId, setFormHostId] = useState(members[0]?.id || "");
  const [formTheme, setFormTheme] = useState("");
  const [formBibleText, setFormBibleText] = useState("");
  const [formSendImmediately, setFormSendImmediately] = useState(true);

  const handleSaveNewMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate || !formTitle) {
      showToast("Vennligst fyll ut dato og tittel.", "info");
      return;
    }
    const startsAt = combineDateAndTimeToIso(formDate, formTime || "19:30");
    let computedLocation = formLocation;
    if (!computedLocation && formHostId) {
      const host = allPersons.find((p) => p.id === formHostId);
      if (host) computedLocation = `Hos ${host.name}`;
    }

    const res = await createMeeting({
      title: formTitle,
      startsAt,
      location: computedLocation,
      hostPersonId: formHostId || undefined,
      theme: formTheme || undefined,
      bibleText: formBibleText || undefined,
      sendInvitationImmediately: formSendImmediately,
    });

    if (res.success) {
      onClose();
      showToast(
        formSendImmediately
          ? "Nytt møte opprettet og innkalling sendt!"
          : "Nytt møte opprettet som utkast."
      );
    } else {
      showToast(res.error || "Kunne ikke opprette møte", "info");
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
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Opprett neste husfellesskap</span>
          </h3>
          <button
            type="button"
            onClick={() => onClose()}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSaveNewMeeting} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Tittel / Samlingsnavn *
            </label>
            <input
              type="text"
              id="input-create-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="f.eks. Husfellesskap hos Kari"
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
                id="input-create-date"
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
                id="input-create-time"
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
                id="select-create-host"
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
                id="input-create-location"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="f.eks. Storgata 10"
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
              id="input-create-theme"
              value={formTheme}
              onChange={(e) => setFormTheme(e.target.value)}
              placeholder="f.eks. Nåde og tilgivelse i hverdagen"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Bibeltekst
            </label>
            <input
              type="text"
              id="input-create-bible-text"
              value={formBibleText}
              onChange={(e) => setFormBibleText(e.target.value)}
              placeholder="f.eks. Kolosserne 3, 12-17"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800"
            />
          </div>

          {/* Checkbox for sending invitation immediately */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="check-send-immediately"
              checked={formSendImmediately}
              onChange={(e) => setFormSendImmediately(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label
              htmlFor="check-send-immediately"
              className="text-xs text-emerald-950 font-medium cursor-pointer"
            >
              <span className="font-bold block">Send innkalling med en gang</span>
              Deltakerne vil umiddelbart kunne svare KOMMER / KOMMER IKKE.
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Avbryt
            </button>
            <button
              type="submit"
              id="btn-submit-create-meeting"
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Opprett samling</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
