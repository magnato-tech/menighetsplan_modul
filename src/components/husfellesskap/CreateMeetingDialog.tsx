import React, { useMemo, useState } from "react";
import { combineDateAndTimeToIso } from "../../utils/dates";
import { todayInNorway } from "../../utils/birthDate";
import {
  MEETING_REPEATS,
  daysTaken,
  hostsInTurn,
  lastDayOfSeason,
  meetingDays,
  repeatOfSchedule,
  suggestedFirstDay,
  type MeetingRepeat,
} from "../../utils/meetingPlan";
import { HusfellesskapModel } from "./husfellesskapModel";
import { CalendarCheck, Check, Plus, Repeat, Users } from "lucide-react";

interface CreateMeetingDialogProps {
  model: HusfellesskapModel;
  showToast: (text: string, type?: "success" | "info") => void;
  onClose: () => void;
}

const input = "w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-emerald-600 text-slate-800";
const label = "text-xs font-semibold text-slate-700 block mb-1";

// "tor. 15. okt.": the day as a leader reads it in a list
const dayText = (day: string): string =>
  new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/**
 * Where a group leader plans the gatherings of the group: one gathering, or the same gathering
 * repeated through the season (see utils/meetingPlan.ts). The days are shown before anything is
 * created, each with its host, and a day that does not suit can be left out.
 */
export const CreateMeetingDialog: React.FC<CreateMeetingDialogProps> = ({ model, showToast, onClose }) => {
  const { group, members, createMeetings, allGroupMeetings } = model;
  const schedule = group?.meetingSchedule;

  // The form starts from the group's fixed meeting time when it has one
  const [formTitle, setFormTitle] = useState(group?.category === "husgruppe" || !group ? "Husfellesskap" : group.name);
  const [formDate, setFormDate] = useState(() => suggestedFirstDay(todayInNorway(), schedule));
  const [formTime, setFormTime] = useState(schedule?.time || "19:30");
  const [repeat, setRepeat] = useState<MeetingRepeat>(() => repeatOfSchedule(schedule));
  // The last day follows the first one until the leader has chosen one
  const [chosenLastDay, setChosenLastDay] = useState<string | null>(null);
  const lastDay = chosenLastDay ?? lastDayOfSeason(formDate);
  const [formLocation, setFormLocation] = useState("");
  // One gathering starts with the first participant as host, as before. In a plan the host is
  // open until one is chosen: who hosts is often agreed from time to time.
  const [formHostId, setFormHostId] = useState(() => (repeatOfSchedule(schedule) === "once" ? members[0]?.id || "" : ""));
  const [formTheme, setFormTheme] = useState("");
  const [formBibleText, setFormBibleText] = useState("");
  const [formSendImmediately, setFormSendImmediately] = useState(true);
  // Days the leader has left out, and days given another host than the one chosen above
  const [leftOut, setLeftOut] = useState<string[]>([]);
  const [hostOfDay, setHostOfDay] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const repeats = repeat !== "once";
  const days = useMemo(() => meetingDays(formDate, lastDay, repeat), [formDate, lastDay, repeat]);
  // A day the group already has a gathering on, is never planned twice
  const taken = useMemo(() => (repeats ? daysTaken(days, allGroupMeetings) : []), [repeats, days, allGroupMeetings]);
  const chosenDays = days.filter((day) => !leftOut.includes(day) && !taken.includes(day));
  const hostFor = (day: string): string => (repeats ? hostOfDay[day] ?? formHostId : formHostId);
  const nameOf = (personId: string): string => members.find((member) => member.id === personId)?.name ?? "";

  const takeTurns = () => {
    const hosts = hostsInTurn(chosenDays.length, members.map((member) => member.id), formHostId);
    setHostOfDay(Object.fromEntries(chosenDays.map((day, index) => [day, hosts[index]])));
  };

  const handleSaveNewMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate || !formTitle.trim()) {
      showToast("Vennligst fyll ut dato og tittel.", "info");
      return;
    }
    if (chosenDays.length === 0) {
      showToast("Velg minst én dag.", "info");
      return;
    }
    setSaving(true);
    const res = await createMeetings(
      {
        title: formTitle.trim(),
        theme: formTheme || undefined,
        bibleText: formBibleText || undefined,
        sendInvitationImmediately: formSendImmediately,
      },
      chosenDays.map((day) => {
        const hostId = hostFor(day);
        return {
          startsAt: combineDateAndTimeToIso(day, formTime || "19:30"),
          hostPersonId: hostId || undefined,
          // Without an address, the gathering is at the host's
          location: formLocation.trim() || (hostId && nameOf(hostId) ? `Hos ${nameOf(hostId)}` : ""),
        };
      })
    );
    setSaving(false);

    if (res.success) {
      onClose();
      if (res.created > 1) showToast(`${res.created} samlinger er opprettet.`);
      else showToast(formSendImmediately ? "Nytt møte opprettet og innkalling sendt!" : "Nytt møte opprettet som utkast.");
    } else {
      showToast(
        res.created > 0 ? `${res.created} samlinger ble opprettet før det stoppet: ${res.error || "ukjent feil"}` : res.error || "Kunne ikke opprette møte",
        "info"
      );
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="create-meeting-heading" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 id="create-meeting-heading" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span>Planlegg samling</span>
          </h3>
          <button type="button" onClick={() => onClose()} aria-label="Lukk" className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer">
            ×
          </button>
        </div>

        <form onSubmit={handleSaveNewMeeting} className="space-y-3.5">
          <div>
            <label htmlFor="input-create-title" className={label}>
              Tittel / Samlingsnavn *
            </label>
            <input
              type="text"
              id="input-create-title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="f.eks. Husfellesskap hos Kari"
              required
              className={input}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="input-create-date" className={label}>
                {repeats ? "Første dato *" : "Dato *"}
              </label>
              <input type="date" id="input-create-date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className={input} />
            </div>

            <div>
              <label htmlFor="input-create-time" className={label}>
                Klokkeslett *
              </label>
              <input type="time" id="input-create-time" value={formTime} onChange={(e) => setFormTime(e.target.value)} required className={input} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="select-create-repeat" className={label}>
                <span className="inline-flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  Gjenta
                </span>
              </label>
              <select
                id="select-create-repeat"
                value={repeat}
                onChange={(e) => {
                  const chosen = e.target.value as MeetingRepeat;
                  // Going from one gathering to a plan leaves the host open
                  if (repeat === "once" && chosen !== "once") {
                    setFormHostId("");
                    setHostOfDay({});
                  }
                  setRepeat(chosen);
                }}
                className={input}
              >
                {MEETING_REPEATS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {repeats && (
              <div>
                <label htmlFor="input-create-last-day" className={label}>
                  Til og med
                </label>
                <input
                  type="date"
                  id="input-create-last-day"
                  value={lastDay}
                  min={formDate}
                  onChange={(e) => setChosenLastDay(e.target.value)}
                  className={input}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="select-create-host" className={label}>
                {repeats ? "Vert for alle" : "Vert (hos hvem)"}
              </label>
              <select id="select-create-host" value={formHostId} onChange={(e) => setFormHostId(e.target.value)} className={input}>
                <option value="">{repeats ? "Avtales senere" : "Velg vert blant deltakerne..."}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="input-create-location" className={label}>
                Sted / Adresse
              </label>
              <input
                type="text"
                id="input-create-location"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder={repeats ? "Tomt: hos verten" : "f.eks. Storgata 10"}
                className={input}
              />
            </div>
          </div>

          {repeats && (
            <section aria-label="Dagene i planen" className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  <span>
                    {chosenDays.length} {chosenDays.length === 1 ? "samling" : "samlinger"} opprettes
                  </span>
                </p>
                {members.length > 1 && chosenDays.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={takeTurns}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-bold text-slate-700 hover:border-emerald-500 cursor-pointer flex items-center gap-1"
                    >
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      Bytt på
                    </button>
                    <button
                      type="button"
                      onClick={() => setHostOfDay({})}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-bold text-slate-700 hover:border-emerald-500 cursor-pointer"
                    >
                      Samme vert
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-600">
                Ta bort haken på en dag som ikke passer. Vert, sted og tema kan stå åpent og legges inn på hver samling når det nærmer seg.
              </p>

              {days.length === 0 ? (
                <p className="text-xs text-slate-600">Ingen dager mellom første dato og «Til og med».</p>
              ) : (
                <ul className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {days.map((day) => {
                    const isTaken = taken.includes(day);
                    const isChosen = !isTaken && !leftOut.includes(day);
                    return (
                      <li key={day} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2 py-1.5">
                        <input
                          type="checkbox"
                          id={`check-day-${day}`}
                          checked={isChosen}
                          disabled={isTaken}
                          onChange={() => setLeftOut((before) => (before.includes(day) ? before.filter((other) => other !== day) : [...before, day]))}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <label htmlFor={`check-day-${day}`} className={`text-xs font-semibold w-24 shrink-0 ${isChosen ? "text-slate-800" : "text-slate-400"}`}>
                          {dayText(day)}
                        </label>
                        {isTaken ? (
                          <span className="text-[11px] font-medium text-amber-800">Har alt en samling</span>
                        ) : (
                          <select
                            aria-label={`Vert ${dayText(day)}`}
                            value={hostFor(day)}
                            disabled={!isChosen}
                            onChange={(e) => setHostOfDay((before) => ({ ...before, [day]: e.target.value }))}
                            className="flex-1 min-w-0 text-[11px] px-2 py-1 border border-slate-300 rounded-lg bg-white text-slate-800 disabled:opacity-50"
                          >
                            <option value="">Avtales senere</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <div>
            <label htmlFor="input-create-theme" className={label}>
              {repeats ? "Tema for den første samlingen" : "Tema for samlingen"}
            </label>
            <input
              type="text"
              id="input-create-theme"
              value={formTheme}
              onChange={(e) => setFormTheme(e.target.value)}
              placeholder="f.eks. Nåde og tilgivelse i hverdagen"
              className={input}
            />
          </div>

          <div>
            <label htmlFor="input-create-bible-text" className={label}>
              Bibeltekst
            </label>
            <input
              type="text"
              id="input-create-bible-text"
              value={formBibleText}
              onChange={(e) => setFormBibleText(e.target.value)}
              placeholder="f.eks. Kolosserne 3, 12-17"
              className={input}
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="check-send-immediately"
              checked={formSendImmediately}
              onChange={(e) => setFormSendImmediately(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="check-send-immediately" className="text-xs text-emerald-950 font-medium cursor-pointer">
              <span className="font-bold block">{repeats ? "Send innkalling" : "Send innkalling med en gang"}</span>
              {repeats
                ? "Deltakerne blir spurt om de kommer til den neste samlingen. De senere står i kalenderen til det er deres tur."
                : "Deltakerne vil umiddelbart kunne svare KOMMER / KOMMER IKKE."}
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
              disabled={saving || chosenDays.length === 0}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>{chosenDays.length > 1 ? `Opprett ${chosenDays.length} samlinger` : "Opprett samling"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
