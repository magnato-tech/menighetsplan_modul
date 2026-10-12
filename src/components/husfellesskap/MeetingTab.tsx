import React, { useState } from "react";
import { formatNorwegianDateTime } from "../../utils/dates";
import { HusfellesskapModel } from "./husfellesskapModel";
import {
  Calendar,
  MapPin,
  BookOpen,
  Check,
  X,
  UserCheck,
  Clock,
  Send,
  Plus,
  Edit2,
  AlertCircle,
  UserX,
  Home,
} from "lucide-react";

interface MeetingTabProps {
  model: HusfellesskapModel;
  showToast: (text: string, type?: "success" | "info") => void;
  onCreateMeeting: () => void;
  onEditMeeting: () => void;
}

export const MeetingTab: React.FC<MeetingTabProps> = ({ model, showToast, onCreateMeeting, onEditMeeting }) => {
  const { isLeader, isDeputyLeader, members, allGroupMeetings, activeMeeting, setSelectedMeetingId, hostPerson, attendingMembers, declinedMembers, unrespondedMembers, currentUserAttendance, respond, sendInvitation, currentUser } = model;

  const [submitting, setSubmitting] = useState(false);

  const isAttending = currentUserAttendance?.status === "attending";
  const isDeclined = currentUserAttendance?.status === "declined";

  const handleRespond = async (status: "attending" | "declined") => {
    if (!activeMeeting) return;
    setSubmitting(true);
    const res = await respond(status, activeMeeting.id);
    setSubmitting(false);
    if (res.success) {
      showToast(status === "attending" ? "Du er registrert som KOMMER!" : "Du er registrert som KOMMER IKKE.");
    } else {
      showToast(res.error || "Kunne ikke registrere svar.", "info");
    }
  };

  const handleSendInvitation = async () => {
    if (!activeMeeting) return;
    setSubmitting(true);
    const res = await sendInvitation(activeMeeting.id);
    setSubmitting(false);
    if (res.success) {
      showToast("Møteinnkalling er sendt ut til alle deltakerne!");
    } else {
      showToast(res.error || "Kunne ikke sende innkalling.", "info");
    }
  };

  const totalMembersCount = members.length;
  const answeredCount = attendingMembers.length + declinedMembers.length;

  return (
    <div id="section-husfellesskap-meeting" className="p-5 space-y-5">
      {/* Multi-meeting selector dropdown if group has multiple meetings */}
      {allGroupMeetings.length > 1 && (
        <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
            Velg samling:
          </span>
          <select
            id="select-active-meeting"
            value={activeMeeting?.id || ""}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="font-bold text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-emerald-600 cursor-pointer"
          >
            {allGroupMeetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({new Date(m.startsAt).toLocaleDateString("no-NO", { day: "numeric", month: "short" })})
                {m.invitationSent ? " • Sendt" : " • Utkast"}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeMeeting ? (
        <>
          {/* Meeting Status & Meta Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Neste samling
                </span>
                {/* Invitation sent status badge */}
                {activeMeeting.invitationSent ? (
                  <span
                    id={`badge-invitation-sent-${activeMeeting.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.8 rounded-full border border-emerald-200"
                  >
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span>Innkalling sendt</span>
                  </span>
                ) : (
                  <span
                    id={`badge-invitation-draft-${activeMeeting.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.8 rounded-full border border-amber-200"
                  >
                    <AlertCircle className="w-3 h-3 text-amber-700" />
                    <span>Utkast • Ikke sendt ennå</span>
                  </span>
                )}
              </div>

              {/* Leader Controls: Edit / Send */}
              {(isLeader || isDeputyLeader) && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    id="btn-edit-meeting"
                    onClick={onEditMeeting}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    title="Rediger møteinformasjon"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Endre møte</span>
                  </button>
                </div>
              )}
            </div>

            {/* Main Meeting Card (Tittel, Dato, Tid, Sted, Vert) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">{activeMeeting.title}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formatNorwegianDateTime(activeMeeting.startsAt)}</span>
                </div>

                {activeMeeting.location && (
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{activeMeeting.location}</span>
                  </div>
                )}
              </div>

              {/* Vert info */}
              {hostPerson && (
                <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                  <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Vert: <strong className="text-slate-800">{hostPerson.name}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Tema & Bibeltekst */}
            {(activeMeeting.theme || activeMeeting.bibleText) && (
              <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100/80 space-y-2">
                {activeMeeting.theme && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/80 block">
                      Tema for samlingen
                    </span>
                    <p className="text-xs font-bold text-slate-900">{activeMeeting.theme}</p>
                  </div>
                )}
                {activeMeeting.bibleText && (
                  <div className="space-y-0.5 pt-1.5 border-t border-emerald-100/60 flex items-start gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/80 block">
                        Bibeltekst
                      </span>
                      <p className="text-xs font-medium text-slate-800">{activeMeeting.bibleText}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* GRUPPELEDER-FLYTKORT: SEND INNKALLING */}
          {(isLeader || isDeputyLeader) && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 text-white space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Lederhandling: Møteinnkalling</span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-300">
                  {activeMeeting.invitationSent ? "Innkalling er aktiv" : "Klar til utsending"}
                </span>
              </div>

              <p className="text-xs text-emerald-100 leading-relaxed">
                {activeMeeting.invitationSent
                  ? "Innkallingen er sendt til gruppen. Deltakernes svar oppdateres fortløpende nedenfor."
                  : "Møtet er opprettet som et utkast. Trykk på knappen under for å sende innkalling til alle deltakerne."}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  id="btn-send-invitation"
                  disabled={submitting}
                  onClick={handleSendInvitation}
                  className="px-4 py-2.5 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {activeMeeting.invitationSent ? "Send innkalling på nytt" : "SEND INNKALLING"}
                  </span>
                </button>

                <button
                  type="button"
                  id="btn-quick-edit-meeting"
                  onClick={onEditMeeting}
                  className="px-3 py-2.5 bg-emerald-950/60 hover:bg-emerald-950/90 text-emerald-100 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Endre detaljer</span>
                </button>
              </div>
            </div>
          )}

          {/* MEDLEMMETS DELTAKELSERESPONS (Gruppeleder er også medlem!) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Ditt svar ({currentUser.name})
                </span>
                <span className="text-[11px] text-slate-500">
                  {isAttending
                    ? "Du har svart: KOMMER"
                    : isDeclined
                    ? "Du har svart: KOMMER IKKE"
                    : "Du har ikke registrert svar ennå"}
                </span>
              </div>

              {currentUserAttendance && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isAttending
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : "bg-amber-100 text-amber-800 border border-amber-200"
                  }`}
                >
                  {isAttending ? "Kommer" : "Kommer ikke"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                id={`btn-attending-${activeMeeting.id}`}
                disabled={submitting}
                onClick={() => handleRespond("attending")}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                  isAttending
                    ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600 ring-offset-1"
                    : "bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200"
                }`}
              >
                <Check className={`w-4 h-4 ${isAttending ? "text-white" : "text-emerald-600"}`} />
                <span>KOMMER</span>
              </button>

              <button
                type="button"
                id={`btn-declined-${activeMeeting.id}`}
                disabled={submitting}
                onClick={() => handleRespond("declined")}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                  isDeclined
                    ? "bg-amber-600 text-white shadow-xs ring-2 ring-amber-600 ring-offset-1"
                    : "bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-800 border border-slate-200"
                }`}
              >
                <X className={`w-4 h-4 ${isDeclined ? "text-white" : "text-amber-600"}`} />
                <span>KOMMER IKKE</span>
              </button>
            </div>
          </div>

          {/* AGGREGERT DELTAKELSE & STATUSOVERSIKT */}
          <div
            id="section-aggregated-attendance"
            className="space-y-3.5 pt-2 border-t border-slate-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Deltakelse & Svarstatus
                </h4>
                <span className="text-[11px] text-slate-500 font-medium">
                  {answeredCount} av {totalMembersCount} deltakere har svart
                </span>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                Totalt {totalMembersCount} deltakere
              </span>
            </div>

            {/* 1. Kommer */}
            <div id="box-attending-members" className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Kommer ({attendingMembers.length})</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {attendingMembers.length} {attendingMembers.length === 1 ? "person" : "personer"}
                </span>
              </div>

              {attendingMembers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {attendingMembers.map((member) => (
                    <span
                      key={member.id}
                      id={`attending-member-${member.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-xl shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {member.name}
                      {member.id === currentUser.id && " (deg)"}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Ingen har svart at de kommer ennå.</p>
              )}
            </div>

            {/* 2. Kommer ikke */}
            <div id="box-declined-members" className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5 text-amber-600" />
                  <span>Kommer ikke ({declinedMembers.length})</span>
                </span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  {declinedMembers.length} {declinedMembers.length === 1 ? "person" : "personer"}
                </span>
              </div>

              {declinedMembers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {declinedMembers.map((member) => (
                    <span
                      key={member.id}
                      id={`declined-member-${member.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-amber-900 border border-amber-200 px-2.5 py-1 rounded-xl shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="line-through text-slate-500">{member.name}</span>
                      {member.id === currentUser.id && " (deg)"}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Ingen har meldt forfall.</p>
              )}
            </div>

            {/* 3. Ikke svart */}
            <div id="box-unresponded-members" className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ikke svart ({unrespondedMembers.length})</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                  {unrespondedMembers.length} {unrespondedMembers.length === 1 ? "person" : "personer"}
                </span>
              </div>

              {unrespondedMembers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {unrespondedMembers.map((member) => (
                    <span
                      key={member.id}
                      id={`unresponded-member-${member.id}`}
                      className="inline-flex items-center text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs"
                    >
                      {member.name}
                      {member.id === currentUser.id && " (deg)"}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-700 font-semibold">
                  Alle deltakerne har svart på innkallingen!
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="p-8 text-center space-y-3 bg-slate-50 rounded-3xl border border-slate-100">
          <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-700">Ingen samlinger planlagt</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Det er for øyeblikket ingen planlagte husfellesskapssamlinger.
            </p>
          </div>
          {(isLeader || isDeputyLeader) && (
            <button
              type="button"
              id="btn-create-first-meeting"
              onClick={onCreateMeeting}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Opprett neste samling</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
