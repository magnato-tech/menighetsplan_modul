import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAdminDetailRoute } from "../utils/adminStudioRoutes";
import {
  useAdminGroupDetail,
  GROUP_CATEGORIES,
  MEETING_FREQUENCIES,
  WEEKDAYS,
  formatNorwegianDateTime,
} from "../hooks/useAppHooks";
import { GroupCategory } from "../types";
import { isGroupPublic } from "../utils/visibility";
import { useTimedMessage } from "../hooks/useTimedMessage";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { StudioDetailShell, StudioDetailNotFound } from "./admin/StudioDetailShell";
import { MemberProposals } from "../components/groups/MemberProposals";
import { useGroupProposals } from "../hooks/useMemberProposals";
import {
  acceptProposal,
  acceptProposalAsNew,
  dismissProposal,
  proposeMember,
  withdrawProposal,
} from "../services/memberProposals";
import { reportWriteError } from "../services/writeErrors";
import { leadsGroup, withLeaders } from "../utils/groups";
import {
  studioDetailCard,
  studioDetailSection,
  studioDetailInput,
  studioDetailTitle,
  studioDetailLink,
  studioDetailRow,
  studioPrimaryButton,
} from "./admin/studioDetailTheme";
import {
  Users,
  UserCheck,
  UserCog,
  Calendar,
  Clock,
  MapPin,
  FolderKanban,
  Save,
  Tag,
  Repeat,
} from "lucide-react";

export const AdminGroupDetailPage: React.FC = () => {
  const detailRoute = useAdminDetailRoute();
  const groupId = detailRoute?.kind === "group" ? detailRoute.id : "";

  const {
    isAdmin,
    currentUser,
    group,
    members,
    availablePersonsToAdd,
    allPersons,
    groupGatherings,
    updateGroup,
    addGroupMember,
    removeGroupMember,
  } = useAdminGroupDetail(groupId || "");
  const canPropose = Boolean(group && leadsGroup(group, currentUser.id));
  const proposals = useGroupProposals(groupId || "", isAdmin && groupId !== "");

  // Form states
  const [name, setName] = useState<string>("");
  const [category, setCategory] = useState<GroupCategory>("tjenestegruppe");
  const [description, setDescription] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>("");
  const [selectedDeputyId, setSelectedDeputyId] = useState<string>("");
  const [isPublic, setIsPublic] = useState<boolean>(true);
  // A group without fixed meetings must not get a schedule just because the form was saved
  const [hasSchedule, setHasSchedule] = useState<boolean>(false);
  const [weekday, setWeekday] = useState<string>("Søndag");
  const [time, setTime] = useState<string>("11:00");
  const [frequency, setFrequency] = useState<"hver uke" | "annenhver uke" | "hver måned">("hver uke");
  const [selectedPersonToAdd, setSelectedPersonToAdd] = useState<string>("");

  const [feedback, setFeedback] = useTimedMessage<{ text: string; type: "success" | "error" }>();

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description || "");
      setTags((group.tags || []).join(", "));
      setCategory(group.category || "tjenestegruppe");
      setSelectedLeaderId(group.leaderIds[0] || "");
      setSelectedDeputyId(group.deputyLeaderIds?.[0] || "");
      setIsPublic(isGroupPublic(group));
      setHasSchedule(Boolean(group.meetingSchedule));
      if (group.meetingSchedule) {
        setWeekday(group.meetingSchedule.weekday);
        setTime(group.meetingSchedule.time);
        setFrequency(group.meetingSchedule.frequency);
      }
    }
  }, [group]);

  const showFeedback = (text: string, type: "success" | "error" = "success") => setFeedback({ text, type });

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!group) return;

    if (!name.trim()) {
      showFeedback("Gruppenavn kan ikke være tomt.", "error");
      return;
    }

    const tagsArray = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const res = updateGroup(group.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      tags: tagsArray,
      category,
      isPublic,
      leaderIds: selectedLeaderId ? [selectedLeaderId] : [],
      deputyLeaderIds: selectedDeputyId ? [selectedDeputyId] : [],
      // A leader is a member: the list of members is never without those who lead the group
      memberIds: withLeaders(group.memberIds, [selectedLeaderId, selectedDeputyId]),
      meetingSchedule: hasSchedule ? { weekday, time, frequency } : undefined,
    });

    if (res.success) {
      showFeedback("Gruppeinformasjon og møteplan ble lagret!");
    } else {
      showFeedback(res.error || "Kunne ikke lagre gruppe.", "error");
    }
  };

  const handleAddMember = () => {
    if (!group || !selectedPersonToAdd) return;
    const res = addGroupMember(group.id, selectedPersonToAdd);
    if (res.success) {
      const addedPerson = allPersons.find((p) => p.id === selectedPersonToAdd);
      showFeedback(`${addedPerson?.name || "Personen"} ble lagt til som medlem i gruppen!`);
      setSelectedPersonToAdd("");
    } else {
      showFeedback(res.error || "Kunne ikke legge til medlem.", "error");
    }
  };

  const handleRemoveMember = (personId: string, memberName: string) => {
    if (!group) return;
    const res = removeGroupMember(group.id, personId);
    if (res.success) {
      showFeedback(`${memberName} ble fjernet fra gruppen.`);
    } else {
      showFeedback(res.error || "Kunne ikke fjerne medlem.", "error");
    }
  };

  // Friendly access denied screen if user is not admin
  if (!isAdmin) {
    return <AdminAccessRequired target="denne admin-siden" />;
  }

  if (!group) {
    return (
      <StudioDetailNotFound
        backTab="planlegger-grupper"
        backLabel="Tilbake til grupper"
        title="Fant ikke gruppen"
      />
    );
  }

  const currentCategoryLabel =
    GROUP_CATEGORIES.find((c) => c.id === (group.category || "tjenestegruppe"))?.label ||
    "Tjenestegruppe";

  return (
    <StudioDetailShell
      backTab="planlegger-grupper"
      backLabel="Tilbake til grupper"
      badge="Gruppeadministrasjon"
      feedback={feedback}
    >
      <div className="space-y-5">
        {/* Main Group Edit Card */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className={studioDetailCard}>
            {/* Header info */}
            <div className="flex items-start justify-between border-b border-[var(--studio-border)] pb-3">
              <div>
                <h3 className={studioDetailTitle}>{group.name}</h3>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {currentCategoryLabel}
              </span>
            </div>

            {/* 1. Gruppenavn */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-edit-group-name"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
              >
                <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                Gruppenavn:
              </label>
              <input
                type="text"
                id="input-edit-group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. Lyd og bilde..."
                className={studioDetailInput}
              />
            </div>

            {/* 2. Gruppekategori */}
            <div className="space-y-1.5">
              <label
                htmlFor="select-edit-group-category"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                Gruppekategori:
              </label>
              <select
                id="select-edit-group-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as GroupCategory)}
                className={studioDetailInput}
              >
                {GROUP_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tagger */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-edit-group-tags"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                Tagger (kommaseparert, f.eks. vekstgruppe, menighetsskole, bønn):
              </label>
              <input
                type="text"
                id="input-edit-group-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="f.eks. vekstgruppe, menighetsskole, bønn"
                className={studioDetailInput}
              />
            </div>

            {/* Beskrivelse */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-edit-group-description"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
              >
                <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                Beskrivelse / formål:
              </label>
              <textarea
                id="input-edit-group-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beskriv gruppens formål og målgruppe..."
                className={studioDetailInput}
              />
            </div>

            {/* Synlighet utad */}
            <label
              htmlFor="input-edit-group-public"
              className="flex items-start gap-2.5 p-3 bg-[var(--studio-row)] rounded-xl border border-[var(--studio-border)] cursor-pointer"
            >
              <input
                type="checkbox"
                id="input-edit-group-public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-0"
              />
              <span className="text-xs">
                <span className="font-bold text-[var(--studio-text)] block">Vis gruppen på nettsiden</span>
                <span className="text-[11px] text-[var(--studio-muted)]">
                  Uten krysset vises gruppen bare i planleggeren, ikke på nettsiden og ikke for eksterne nettsider som henter grupper herfra.
                </span>
              </span>
            </label>

            {/* 3. Leder & 4. Nestleder */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[var(--studio-border)]">
              {/* Leder */}
              <div className="space-y-1.5">
                <label
                  htmlFor="select-edit-group-leader"
                  className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Leder:
                </label>
                <select
                  id="select-edit-group-leader"
                  value={selectedLeaderId}
                  onChange={(e) => setSelectedLeaderId(e.target.value)}
                  className={studioDetailInput}
                >
                  {/* Without this option the list would show the first member as leader of a group that has none */}
                  <option value="">
                    {members.length === 0 ? "Ingen medlemmer i gruppen" : "-- Ingen leder valgt --"}
                  </option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--studio-muted)]">
                  Styrer hvem som har lederadgang på /leder
                </p>
              </div>

              {/* Nestleder */}
              <div className="space-y-1.5">
                <label
                  htmlFor="select-edit-group-deputy"
                  className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
                >
                  <UserCog className="w-3.5 h-3.5 text-blue-600" />
                  Nestleder:
                </label>
                <select
                  id="select-edit-group-deputy"
                  value={selectedDeputyId}
                  onChange={(e) => setSelectedDeputyId(e.target.value)}
                  className={studioDetailInput}
                >
                  <option value="">-- Ingen nestleder valgt --</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--studio-muted)]">
                  Vises som nestleder for gruppen
                </p>
              </div>
            </div>

            {/* 5. Møteplan */}
            <div className="pt-2 border-t border-[var(--studio-border)] space-y-3">
              <label
                htmlFor="input-edit-group-has-schedule"
                className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  id="input-edit-group-has-schedule"
                  checked={hasSchedule}
                  onChange={(e) => setHasSchedule(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
                />
                <Repeat className="w-3.5 h-3.5 text-indigo-600" />
                Gruppen har fast møtetid
              </label>

              {hasSchedule && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Ukedag */}
                    <div className="space-y-1">
                      <label
                        htmlFor="select-schedule-weekday"
                        className="text-[11px] font-semibold text-[var(--studio-muted)] block"
                      >
                        Ukedag:
                      </label>
                      <select
                        id="select-schedule-weekday"
                        value={weekday}
                        onChange={(e) => setWeekday(e.target.value)}
                        className={studioDetailInput}
                      >
                        {WEEKDAYS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Klokkeslett */}
                    <div className="space-y-1">
                      <label
                        htmlFor="input-schedule-time"
                        className="text-[11px] font-semibold text-[var(--studio-muted)] block"
                      >
                        Klokkeslett:
                      </label>
                      <input
                        type="text"
                        id="input-schedule-time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        placeholder="19:00"
                        className={studioDetailInput}
                      />
                    </div>

                    {/* Frekvens */}
                    <div className="space-y-1">
                      <label
                        htmlFor="select-schedule-frequency"
                        className="text-[11px] font-semibold text-[var(--studio-muted)] block"
                      >
                        Frekvens:
                      </label>
                      <select
                        id="select-schedule-frequency"
                        value={frequency}
                        onChange={(e) =>
                          setFrequency(
                            e.target.value as "hver uke" | "annenhver uke" | "hver måned"
                          )
                        }
                        className={studioDetailInput}
                      >
                        {MEETING_FREQUENCIES.map((freq) => (
                          <option key={freq.id} value={freq.id}>
                            {freq.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Formatted Meeting Plan Preview */}
                  <div className={studioDetailRow}>
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] uppercase font-bold text-[var(--studio-muted)] block">
                        Aktiv møteplan:
                      </span>
                      <p className="font-bold text-[var(--studio-text)]">
                        {weekday} kl. {time}, {frequency}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="btn-save-group-detail"
                className={studioPrimaryButton}
              >
                <Save className="w-4 h-4" />
                Lagre endringer for gruppen
              </button>
            </div>
          </div>
        </form>

        {/* Medlemmer Section */}
        <section
          id="admin-group-members-section"
          className={studioDetailSection}
        >
          <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
            <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[var(--studio-muted)]" />
              Medlemmer i gruppen ({members.length})
            </span>
          </div>

          <div className="space-y-2">
            {members.map((member) => {
              const isLeader = group.leaderIds.includes(member.id);
              const isDeputy = group.deputyLeaderIds?.includes(member.id);

              return (
                <div
                  key={member.id}
                  id={`group-member-row-${member.id}`}
                  className={studioDetailRow}
                >
                  <div>
                    <Link
                      to={`/admin/person/${member.id}`}
                      className={`${studioDetailLink} transition-colors`}
                    >
                      {member.name}
                    </Link>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isLeader && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Leder
                      </span>
                    )}
                    {isDeputy && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                        Nestleder
                      </span>
                    )}
                    {!isLeader && !isDeputy && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-[var(--studio-text)]">
                        Medlem
                      </span>
                    )}

                    {!isLeader && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.id, member.name)}
                        className="text-[10px] text-[var(--studio-muted)] hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Fjern fra gruppe"
                      >
                        Fjern
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {group && (
            <MemberProposals
              proposals={proposals}
              canPropose={canPropose}
              canDecide
              candidates={availablePersonsToAdd}
              memberNames={members.map((member) => member.name)}
              proposedBy={currentUser.id}
              onPropose={(proposalName) => {
                proposeMember(group.id, currentUser.id, proposalName).catch((error) => reportWriteError("sende forslaget", error));
              }}
              onWithdraw={(proposalId) => {
                withdrawProposal(proposalId).catch((error) => reportWriteError("trekke tilbake forslaget", error));
              }}
              onAccept={(proposal, personId) => {
                acceptProposal(proposal.id, group.id, personId).catch((error) => reportWriteError("legge til medlemmet", error));
              }}
              onCreate={(proposal) => {
                acceptProposalAsNew(proposal.id, group.id, proposal.name).catch((error) => reportWriteError("opprette personen", error));
              }}
              onDismiss={(proposalId) => {
                dismissProposal(proposalId).catch((error) => reportWriteError("avvise forslaget", error));
              }}
            />
          )}

          {/* Add member selector */}
          {availablePersonsToAdd.length > 0 && (
            <div className="pt-2 border-t border-[var(--studio-border)] flex items-center gap-2">
              <select
                id="select-add-group-member"
                value={selectedPersonToAdd}
                onChange={(e) => setSelectedPersonToAdd(e.target.value)}
                className={studioDetailInput}
              >
                <option value="">-- Velg person å legge til --</option>
                {availablePersonsToAdd.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} ({person.phone || person.email || person.globalRole})
                  </option>
                ))}
              </select>
              <button
                type="button"
                id="btn-add-group-member"
                onClick={handleAddMember}
                disabled={!selectedPersonToAdd}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Legg til
              </button>
            </div>
          )}
        </section>

        {/* Konkrete kommende samlinger (Separate from meeting schedule) */}
        <section
          id="admin-group-gatherings-section"
          className={studioDetailSection}
        >
          <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
            <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Konkrete samlinger for gruppen ({groupGatherings.length})
            </span>
            <span className="text-[10px] text-[var(--studio-muted)] font-medium">Eksisterende Gathering</span>
          </div>

          <p className="text-[11px] text-[var(--studio-muted)] leading-relaxed">
            Dette er faktiske, planlagte samlinger knyttet til gruppen (uavhengig av den generelle møteplanen over).
          </p>

          {groupGatherings.length === 0 ? (
            <p className="text-xs text-[var(--studio-muted)] italic py-2">
              Ingen konkrete samlinger opprettet for denne gruppen ennå.
            </p>
          ) : (
            <div className="space-y-2">
              {groupGatherings.map(({ gathering, tasks: gTasks, staffing }) => (
                <div
                  key={gathering.id}
                  id={`group-gathering-card-${gathering.id}`}
                  className="p-3 bg-[var(--studio-row)] rounded-xl border border-[var(--studio-border)] space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="text-xs font-bold text-[var(--studio-text)]">{gathering.title}</h5>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--studio-muted)] mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[var(--studio-muted)]" />
                          {formatNorwegianDateTime(gathering.startsAt)}
                        </span>
                        {gathering.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[var(--studio-muted)]" />
                            {gathering.location}
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        staffing.color === "red"
                          ? "bg-red-100 text-red-700"
                          : staffing.color === "yellow"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {staffing.badgeText} ({staffing.coveredCount}/{staffing.totalTasks})
                    </span>
                  </div>

                  {/* Task list preview */}
                  <div className="pt-1.5 border-t border-[var(--studio-border)]/60 text-[11px] space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[var(--studio-muted)] block">
                      Tilknyttede oppgaver ({gTasks.length}):
                    </span>
                    {gTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between py-0.5">
                        <Link
                          to={`/admin/oppgave/${task.id}`}
                          className="text-[var(--studio-text)] hover:text-indigo-600 font-medium transition-colors"
                        >
                          {task.title}
                        </Link>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              task.status === "confirmed"
                                ? "bg-emerald-50 text-emerald-700"
                                : task.status === "vacant"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-800"
                            }`}
                          >
                            {task.status === "confirmed"
                              ? "Dekket"
                              : task.status === "vacant"
                              ? "Trenger vikar"
                              : "Ledig"}
                          </span>
                          <Link
                            to={`/admin/oppgave/${task.id}`}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                          >
                            Kort →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </StudioDetailShell>
  );
};
