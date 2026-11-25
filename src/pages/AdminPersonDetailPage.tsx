import React, { useState, useEffect } from "react";
import { isServiceGroup } from "../utils/personDirectory";
import type { ExtraEmail, Person } from "../types";
import { useFirebase } from "../context/FirebaseDataContext";
import { ExtraEmailsEditor } from "../components/admin/ExtraEmailsEditor";
import { extraEmailsOf } from "../utils/personEmails";
import { groupsToJoin } from "../utils/groupChoice";
import { personTaskOverview, type PersonTaskRow } from "../utils/personTasks";
import { personDeletion } from "../utils/personDeletion";
import { deletePersonWithTraces } from "../services/personDeletion";
import { reportWriteError } from "../services/writeErrors";
import { DeletePersonDialog } from "./admin/DeletePersonDialog";
import { membershipClerkBoardUrl, studioTabUrl } from "./admin/studio";
import { writeEmailHandover } from "../utils/emailLists";
import { formatNorwegianDateTime } from "../utils/dates";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAdminDetailRoute } from "../utils/adminStudioRoutes";
import { useAdminPersonDetail } from "../hooks/useAppHooks";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { StudioDetailShell, StudioDetailNotFound } from "./admin/StudioDetailShell";
import {
  studioDetailCard,
  studioDetailSection,
  studioDetailInput,
  studioDetailMuted,
  studioDetailTitle,
  studioDetailLink,
  studioDetailRow,
  studioPrimaryButton,
  studioSecondaryButton,
} from "./admin/studioDetailTheme";
import { useTimedMessage } from "../hooks/useTimedMessage";
import { toPublicProfile, publicProfileFields } from "../utils/publicProfile";
import { compressImageFile } from "../utils/imageUpload";
import { ageOn, birthDateError, formatBirthDate, todayInNorway } from "../utils/birthDate";
import { extraEmailsError, extraEmailsToStore, membershipValue } from "../utils/personForm";
import { DENOMINATION_ENROLLMENT_LABELS } from "../utils/membershipView";
import { PersonMembershipLogSection } from "../components/admin/PersonMembershipLogSection";
import { canManageMembershipApplications } from "./admin/membershipClerk";
import { WithdrawMembershipDialog } from "./admin/membership/WithdrawMembershipDialog";
import {
  Check,
  Globe,
  User,
  Phone,
  Mail,
  Users,
  UserCheck,
  UserCog,
  Save,
  CheckSquare,
  BadgeCheck,
  CalendarX,
  Plus,
  Trash2,
  Shield,
  Camera,
  Briefcase,
  Cake,
} from "lucide-react";

// The tabs of the person card, in the order they are shown. The address names them with the ids on the left.
const PERSON_TABS = [
  { id: "profil", label: "Profil" },
  { id: "tjeneste", label: "Grupper og tjeneste" },
  { id: "medlemskap", label: "Medlemskap" },
  { id: "tilgang", label: "Tilgang" },
  { id: "nettside", label: "Nettside" },
] as const;
type PersonTab = (typeof PERSON_TABS)[number]["id"];
const toPersonTab = (value: string | null): PersonTab | null => PERSON_TABS.find((tab) => tab.id === value)?.id ?? null;

export const AdminPersonDetailPage: React.FC = () => {
  const detailRoute = useAdminDetailRoute();
  const personId = detailRoute?.kind === "person" ? detailRoute.id : "";
  const [searchParams, setSearchParams] = useSearchParams();
  const fromMembershipBoard = searchParams.get("fra") === "medlemskap";

  const {
    isAdmin,
    isFullAdmin,
    clerkOnly,
    currentUser,
    person,
    personGroups,
    updatePerson,
  } = useAdminPersonDetail(personId || "");
  // «Frivillig» is said of the one who is in a service group (see utils/personDirectory.ts)
  const servesInGroup = personGroups.some(isServiceGroup);

  // Form states
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [extraEmails, setExtraEmails] = useState<ExtraEmail[]>([]);
  const [birthDate, setBirthDate] = useState<string>("");
  const [congregationMember, setCongregationMember] = useState(false);
  const [denominationMember, setDenominationMember] = useState(false);
  const [congregationJoinedAt, setCongregationJoinedAt] = useState("");
  const [denominationJoinedAt, setDenominationJoinedAt] = useState("");
  const [denominationEnrollmentType, setDenominationEnrollmentType] = useState<"" | "A" | "G">("");
  const [denominationGEndedAt, setDenominationGEndedAt] = useState("");
  const [membershipClerk, setMembershipClerk] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [globalRole, setGlobalRole] = useState<Person["globalRole"]>("member");
  const [policeCert, setPoliceCert] = useState<string>("");
  const [unavailablePeriods, setUnavailablePeriods] = useState<{ from: string; to: string; reason?: string }[]>([]);
  const [newUnavailFrom, setNewUnavailFrom] = useState<string>("");
  const [newUnavailTo, setNewUnavailTo] = useState<string>("");
  const [newUnavailReason, setNewUnavailReason] = useState<string>("");
  const [isPublicProfile, setIsPublicProfile] = useState<boolean>(false);
  const [publicTitle, setPublicTitle] = useState<string>("");
  const [publicPhone, setPublicPhone] = useState<string>("");
  const [publicEmail, setPublicEmail] = useState<string>("");
  // Stabs- og bildefelter
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [isStaff, setIsStaff] = useState<boolean>(false);
  const [staffRole, setStaffRole] = useState<string>("");
  const [staffCategory, setStaffCategory] = useState<"pastor" | "stab" | "barneleder" | "diakoni" | "annet">("stab");
  const [staffBio, setStaffBio] = useState<string>("");

  const [feedback, setFeedback] = useTimedMessage<{ text: string; type: "success" | "error" }>();
  // The save button itself says that it saved: the message at the top of the page is out of sight from a low tab
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 3000);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  useEffect(() => {
    if (person) {
      setName(person.name);
      setPhone(person.phone || "");
      setEmail(person.email || "");
      setExtraEmails(extraEmailsOf(person.extraEmails));
      setBirthDate(person.birthDate || "");
      setCongregationMember(person.congregationMember === true);
      setDenominationMember(person.denominationMember === true);
      setCongregationJoinedAt(person.congregationJoinedAt || "");
      setDenominationJoinedAt(person.denominationJoinedAt || "");
      setDenominationEnrollmentType(person.denominationEnrollmentType ?? "");
      setDenominationGEndedAt(person.denominationGEndedAt ?? "");
      setMembershipClerk(person.membershipClerk === true);
      setGlobalRole(person.globalRole || "member");
      setPoliceCert(person.policeCertificateValidUntil || "");
      setUnavailablePeriods(person.unavailablePeriods || []);
      setIsPublicProfile(toPublicProfile(person) !== null);
      setPublicTitle(person.publicTitle || "");
      setPublicPhone(person.publicPhone || "");
      setPublicEmail(person.publicEmail || "");
      setAvatarUrl(person.avatarUrl || "");
      setIsStaff(Boolean(person.isStaff));
      setStaffRole(person.staffRole || person.publicTitle || "");
      setStaffCategory(person.staffCategory || "stab");
      setStaffBio(person.staffBio || "");
    }
  }, [person]);

  const showFeedback = (text: string, type: "success" | "error" = "success") => setFeedback({ text, type });

  // Putting the person into a group, and taking them out, from the person's own card
  const { groups: allGroups, gatherings: allGatherings, tasks: allTasks, assignments: allAssignments, volunteerRoles, addGroupMember, removeGroupMember } = useFirebase();
  // Deleting the person from the register: what it means is worked out here, and shown first
  const navigate = useNavigate();
  const { allPersons: everyone, currentUser: signedIn } = useFirebase();
  const [deleting, setDeleting] = useState(false);
  const [deleteWorking, setDeleteWorking] = useState(false);
  const deletion = person
    ? personDeletion(person, { persons: everyone, groups: allGroups, gatherings: allGatherings, tasks: allTasks, assignments: allAssignments, administratorId: signedIn.id })
    : null;
  const handleDeletePerson = async () => {
    if (!person || !deletion || deletion.blockedBy.length > 0) return;
    setDeleteWorking(true);
    try {
      await deletePersonWithTraces(person.id, deletion);
      navigate(studioTabUrl("planlegger-personer"));
    } catch (error) {
      setDeleting(false);
      setDeleteWorking(false);
      reportWriteError("slette personen", error);
      showFeedback("Personen kunne ikke slettes. Prøv igjen.", "error");
    }
  };

  // What the person has taken on, by role: on the events that come, and on those held lately
  const taskOverview = personTaskOverview(person?.id ?? "", { assignments: allAssignments, tasks: allTasks, gatherings: allGatherings, roles: volunteerRoles });
  const taskLine = (row: PersonTaskRow) => (
    <div key={row.assignmentId} className={studioDetailRow}>
      <Link to={`/admin/samling/${row.gatheringId}`} className="min-w-0">
        <span className="block font-semibold text-[var(--studio-text)]">{row.role}</span>
        <span className="block text-[11px] text-[var(--studio-muted)]">
          {row.gatheringTitle} · {formatNorwegianDateTime(row.startsAt)}
        </span>
      </Link>
      <span
        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${
          row.response === "confirmed" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-900 border-amber-200"
        }`}
      >
        {row.response === "confirmed" ? "Bekreftet" : "Spurt"}
      </span>
    </div>
  );
  const [groupToJoin, setGroupToJoin] = useState("");
  const joinChoices = person ? groupsToJoin(allGroups, allGatherings, person.id) : [];
  const handleJoinGroup = () => {
    const chosen = allGroups.find((candidate) => candidate.id === groupToJoin);
    if (!person || !chosen) return;
    const result = addGroupMember(chosen.id, person.id);
    setGroupToJoin("");
    if (result.success) showFeedback(`${person.name} er lagt til i ${chosen.name}.`);
    else showFeedback(result.error || "Kunne ikke legge personen til i gruppen", "error");
  };
  const handleLeaveGroup = (groupId: string, groupName: string) => {
    if (!person) return;
    const result = removeGroupMember(groupId, person.id);
    if (result.success) showFeedback(`${person.name} er tatt ut av ${groupName}.`);
    else showFeedback(result.error || "Kunne ikke ta personen ut av gruppen", "error");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, { maxDimension: 500, quality: 0.85 });
      setAvatarUrl(dataUrl);
      showFeedback("Portrettbilde klargjort! Husk å trykke lagre.");
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Kunne ikke laste bilde.", "error");
    }
  };

  const handleAddUnavailablePeriod = () => {
    if (!newUnavailFrom || !newUnavailTo) {
      showFeedback("Både fra- og til-dato må oppgis for fravær.", "error");
      return;
    }
    const updated = [
      ...unavailablePeriods,
      {
        from: newUnavailFrom,
        to: newUnavailTo,
        reason: newUnavailReason.trim() || undefined,
      },
    ];
    setUnavailablePeriods(updated);
    setNewUnavailFrom("");
    setNewUnavailTo("");
    setNewUnavailReason("");
    showFeedback("Fraværsperiode lagt til!");
  };

  const handleRemoveUnavailablePeriod = (idx: number) => {
    setUnavailablePeriods(unavailablePeriods.filter((_, i) => i !== idx));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!person) return;

    if (clerkOnly) {
      const wrongCongregation = congregationJoinedAt && birthDateError(congregationJoinedAt);
      const wrongDenomination = denominationJoinedAt && birthDateError(denominationJoinedAt);
      const wrongGEnded = denominationGEndedAt && birthDateError(denominationGEndedAt);
      if (wrongCongregation || wrongDenomination || wrongGEnded) {
        showFeedback(wrongCongregation || wrongDenomination || wrongGEnded || "Ugyldig dato", "error");
        return;
      }
      const res = updatePerson(person.id, {
        congregationMember: membershipValue(congregationMember),
        denominationMember: membershipValue(denominationMember),
        congregationJoinedAt: congregationMember && congregationJoinedAt ? congregationJoinedAt : undefined,
        denominationJoinedAt: denominationMember && denominationJoinedAt ? denominationJoinedAt : undefined,
        denominationEnrollmentType:
          denominationMember && (denominationEnrollmentType === "A" || denominationEnrollmentType === "G")
            ? denominationEnrollmentType
            : undefined,
        denominationGEndedAt: denominationMember && denominationGEndedAt ? denominationGEndedAt : undefined,
      });
      if (res.success) {
        showFeedback("Medlemskap ble lagret.");
        setJustSaved(true);
      }
      else showFeedback(res.error || "Kunne ikke lagre.", "error");
      return;
    }

    if (!name.trim()) {
      showFeedback("Navn kan ikke være tomt.", "error");
      return;
    }

    const wrongBirthDate = birthDateError(birthDate);
    if (wrongBirthDate) {
      showFeedback(wrongBirthDate, "error");
      return;
    }
    const wrongCongregation = congregationJoinedAt && birthDateError(congregationJoinedAt);
    const wrongDenomination = denominationJoinedAt && birthDateError(denominationJoinedAt);
    const wrongGEnded = denominationGEndedAt && birthDateError(denominationGEndedAt);
    if (wrongCongregation || wrongDenomination || wrongGEnded) {
      showFeedback(wrongCongregation || wrongDenomination || wrongGEnded || "Ugyldig dato", "error");
      return;
    }

    const wrongExtraEmail = extraEmailsError(extraEmails, email);
    if (wrongExtraEmail) {
      showFeedback(wrongExtraEmail, "error");
      return;
    }
    const storedExtraEmails = extraEmailsToStore(extraEmails, email);

    const res = updatePerson(person.id, {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      extraEmails: storedExtraEmails.length > 0 ? storedExtraEmails : undefined,
      birthDate: birthDate || undefined,
      congregationMember: membershipValue(congregationMember),
      denominationMember: membershipValue(denominationMember),
      congregationJoinedAt: congregationMember && congregationJoinedAt ? congregationJoinedAt : undefined,
      denominationJoinedAt: denominationMember && denominationJoinedAt ? denominationJoinedAt : undefined,
      denominationEnrollmentType:
        denominationMember && (denominationEnrollmentType === "A" || denominationEnrollmentType === "G")
          ? denominationEnrollmentType
          : undefined,
      denominationGEndedAt: denominationMember && denominationGEndedAt ? denominationGEndedAt : undefined,
      membershipClerk: membershipValue(membershipClerk),
      globalRole,
      avatarUrl: avatarUrl.trim() || undefined,
      isStaff,
      staffRole: staffRole.trim() || undefined,
      staffCategory,
      staffBio: staffBio.trim() || undefined,
      policeCertificateValidUntil: policeCert || undefined,
      unavailablePeriods,
      ...publicProfileFields(
        person,
        {
          isPublic: isPublicProfile || isStaff,
          title: (staffRole || publicTitle).trim(),
          phone: publicPhone,
          email: publicEmail,
        },
        currentUser.id
      ),
    });

    if (res.success) {
      showFeedback("Personopplysninger og tilganger ble lagret!");
      setJustSaved(true);
    } else {
      showFeedback(res.error || "Kunne ikke lagre person.", "error");
    }
  };

  if (!isAdmin) {
    return <AdminAccessRequired target="personkort i admin-flaten" />;
  }

  const membershipFields = (
    <>
      <label className="flex items-center gap-2 text-xs text-[var(--studio-text)]">
        <input
          id="check-edit-congregation"
          type="checkbox"
          checked={congregationMember}
          onChange={(event) => {
            setCongregationMember(event.target.checked);
            if (!event.target.checked) setCongregationJoinedAt("");
          }}
        />
        Medlem i menigheten
      </label>
      {congregationMember && (
        <div className="space-y-1.5 pl-6">
          <label htmlFor="input-congregation-joined" className="text-xs font-bold text-[var(--studio-muted)]">
            Innmeldt i menigheten
          </label>
          <input
            type="date"
            id="input-congregation-joined"
            value={congregationJoinedAt}
            max={todayInNorway()}
            onChange={(event) => setCongregationJoinedAt(event.target.value)}
            className={studioDetailInput}
          />
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-[var(--studio-text)]">
        <input
          id="check-edit-denomination"
          type="checkbox"
          checked={denominationMember}
          onChange={(event) => {
            setDenominationMember(event.target.checked);
            if (!event.target.checked) {
              setDenominationJoinedAt("");
              setDenominationEnrollmentType("");
            }
          }}
        />
        Medlem i kirkesamfunnet
      </label>
      {denominationMember && (
        <div className="space-y-1.5 pl-6">
          <label htmlFor="input-denomination-joined" className="text-xs font-bold text-[var(--studio-muted)]">
            Innmeldt i kirkesamfunnet
          </label>
          <input
            type="date"
            id="input-denomination-joined"
            value={denominationJoinedAt}
            max={todayInNorway()}
            onChange={(event) => setDenominationJoinedAt(event.target.value)}
            className={studioDetailInput}
          />
          <label htmlFor="select-denomination-enrollment-type" className="text-xs font-bold text-[var(--studio-muted)]">
            Type i trossamfunnet
          </label>
          <select
            id="select-denomination-enrollment-type"
            value={denominationEnrollmentType}
            onChange={(event) => setDenominationEnrollmentType(event.target.value as "" | "A" | "G")}
            className={studioDetailInput}
          >
            <option value="">Ikke valgt</option>
            <option value="A">{DENOMINATION_ENROLLMENT_LABELS.A}</option>
            <option value="G">{DENOMINATION_ENROLLMENT_LABELS.G}</option>
          </select>
          <label htmlFor="input-denomination-g-ended" className="text-xs font-bold text-[var(--studio-muted)]">
            Utmeldt som G (barn)
          </label>
          <input
            type="date"
            id="input-denomination-g-ended"
            value={denominationGEndedAt}
            max={todayInNorway()}
            onChange={(event) => setDenominationGEndedAt(event.target.value)}
            className={studioDetailInput}
          />
        </div>
      )}
    </>
  );

  const mayWithdraw =
    person &&
    canManageMembershipApplications(currentUser) &&
    (person.congregationMember === true || person.denominationMember === true);

  if (!person) {
    return (
      <StudioDetailNotFound
        backTab="planlegger-personer"
        backLabel="Tilbake til personregister"
        title="Fant ikke personen"
      />
    );
  }

  const membershipBack = fromMembershipBoard ? (
    <div className="flex flex-col gap-1 -mt-2 mb-2">
      <Link
        to={membershipClerkBoardUrl("inbox")}
        className="text-xs font-bold text-indigo-500 hover:text-indigo-600"
      >
        Tilbake til oppgavebord
      </Link>
      <Link
        to={membershipClerkBoardUrl("log")}
        className="text-xs font-semibold text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
      >
        Protokoll-logg (inn-/utmeldinger og datoer)
      </Link>
    </div>
  ) : null;

  // A protokollansvarlig without admin role has the membership tab only; everyone else has all five
  const visibleTabs = PERSON_TABS.filter((tab) => !clerkOnly || tab.id === "medlemskap");
  const requestedTab = toPersonTab(searchParams.get("fane"));
  const activeTab: PersonTab = visibleTabs.find((tab) => tab.id === requestedTab)?.id ?? visibleTabs[0].id;
  const panelId = `person-panel-${activeTab}`;
  const tabId = (tab: PersonTab) => `person-tab-${tab}`;

  // The address keeps the tab, replaced rather than pushed, so Back leaves the card and not the tab
  const selectTab = (tab: PersonTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("fane", tab);
    setSearchParams(next, { replace: true });
  };
  // Arrow keys move between the tabs, as in a tab list: left and right wrap round, Home and End go to the ends
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % visibleTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + visibleTabs.length) % visibleTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = visibleTabs.length - 1;
    else return;
    event.preventDefault();
    const tab = visibleTabs[nextIndex].id;
    selectTab(tab);
    document.getElementById(tabId(tab))?.focus();
  };

  // «Send e-post» from the card: the same handover as «Personer» uses, with this person as the only recipient
  const sendEmail = () => {
    if (!writeEmailHandover({ personIds: [person.id], label: person.name })) {
      showFeedback("E-post kunne ikke åpnes. Prøv igjen.", "error");
      return;
    }
    navigate(studioTabUrl("epost"));
  };

  const leaderGroups = personGroups.filter((group) => group.leaderIds.includes(person.id));
  const roleLabel =
    person.globalRole === "admin" ? "Global Admin" : person.globalRole === "nettredaktor" ? "Nettredaktør" : "Frivillig";
  const showsRole = person.globalRole === "admin" || person.globalRole === "nettredaktor" || servesInGroup;

  const saveButton = (
    <div className="pt-3">
      <button type="submit" id="btn-save-person-detail" className={studioPrimaryButton}>
        {justSaved ? <Check className="w-4 h-4" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
        {justSaved ? "Lagret" : "Lagre"}
      </button>
    </div>
  );

  const header = (
    <div className={studioDetailCard}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {!clerkOnly && (
            <div className="relative group shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={person.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 shadow-2xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[var(--studio-accent-bg)] border border-[var(--studio-accent-border)] flex items-center justify-center text-indigo-700 font-bold text-base">
                  {person.name.charAt(0)}
                </div>
              )}
              <label
                htmlFor="input-avatar-upload"
                className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full cursor-pointer shadow-xs"
                title="Last opp portrettbilde"
              >
                <Camera className="w-3 h-3" />
              </label>
              <input
                type="file"
                id="input-avatar-upload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <h2 className={studioDetailTitle}>{person.name}</h2>
            {clerkOnly ? (
              <p className={studioDetailMuted}>Du kan endre medlemskap i menighet og kirkesamfunn.</p>
            ) : (
              <p className="text-xs text-[var(--studio-muted)] break-words">
                {person.phone || "Ingen mobil"} · {person.email || "Ingen e-post"}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {!clerkOnly && showsRole && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    person.globalRole === "admin" || person.globalRole === "nettredaktor"
                      ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                      : "bg-slate-100 text-[var(--studio-text)] border border-[var(--studio-border)]"
                  }`}
                >
                  {roleLabel}
                </span>
              )}
              {person.congregationMember === true && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Medlem
                </span>
              )}
              {!clerkOnly &&
                leaderGroups.map((group) => (
                  <span
                    key={group.id}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-[var(--studio-text)] border border-[var(--studio-border)]"
                  >
                    Leder: {group.name}
                  </span>
                ))}
            </div>
          </div>
        </div>
        {!clerkOnly && (
          <button
            type="button"
            onClick={sendEmail}
            className={`${studioSecondaryButton} shrink-0 flex items-center gap-1.5 self-start`}
          >
            <Mail className="w-3.5 h-3.5" aria-hidden="true" />
            Send e-post
          </button>
        )}
      </div>
    </div>
  );

  const tabRow = (
    <div
      role="tablist"
      aria-label="Deler av personkortet"
      className="flex gap-1 p-1 rounded-xl bg-[var(--studio-row)] overflow-x-auto"
    >
      {visibleTabs.map((tab, index) => {
        const selected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            aria-selected={selected}
            aria-controls={selected ? panelId : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              selected
                ? "bg-[var(--studio-surface)] text-[var(--studio-text)] shadow-xs"
                : "text-[var(--studio-muted)] hover:text-[var(--studio-text)]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <StudioDetailShell
      backTab={fromMembershipBoard ? "planlegger-medlemskap" : "planlegger-personer"}
      backLabel={fromMembershipBoard ? "Tilbake til oppgavebord" : "Tilbake til personregister"}
      badge="Personkort"
      feedback={feedback}
    >
      {membershipBack}
      <div className="space-y-5">
        {header}
        {visibleTabs.length > 1 && tabRow}

        <div role="tabpanel" id={panelId} aria-labelledby={tabId(activeTab)} className="space-y-5">
          {/* One form for the tab in view: the fields of every tab live in the page, so nothing is lost when the tab changes */}
          <form onSubmit={handleSave} className="space-y-4">
            {activeTab === "profil" && (
              <div className={studioDetailCard}>
                {/* 1. Navn */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-edit-person-name"
                    className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    Fullt navn:
                  </label>
                  <input
                    type="text"
                    id="input-edit-person-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="F.eks. Kari Nordmann..."
                    className={studioDetailInput}
                  />
                </div>

                {/* 2. Mobil */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-edit-person-phone"
                    className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5 text-indigo-600" />
                    Mobilnummer:
                  </label>
                  <input
                    type="tel"
                    id="input-edit-person-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="F.eks. 912 34 567"
                    className={studioDetailInput}
                  />
                </div>

                {/* 3. E-post */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-edit-person-email"
                    className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    E-postadresse:
                  </label>
                  <input
                    type="email"
                    id="input-edit-person-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="F.eks. kari@eksempel.no"
                    className={studioDetailInput}
                  />
                  <p className="text-[11px] text-[var(--studio-muted)]">Får all e-post fra menigheten og kan logge inn.</p>
                  <div className="pt-2">
                    <ExtraEmailsEditor rows={extraEmails} onChange={setExtraEmails} />
                  </div>
                </div>

                {/* Fødselsdato */}
                <div className="space-y-1.5">
                  <label htmlFor="input-edit-person-birthdate" className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-indigo-600" />
                    Fødselsdato:
                  </label>
                  <input
                    type="date"
                    id="input-edit-person-birthdate"
                    value={birthDate}
                    max={todayInNorway()}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={studioDetailInput}
                  />
                  <p className="text-[11px] text-[var(--studio-muted)]">
                    {birthDateError(birthDate) ??
                      (ageOn(birthDate) !== null
                        ? `Født ${formatBirthDate(birthDate)}, ${ageOn(birthDate)} år. Vises ikke på nettsiden.`
                        : "Valgfritt. Vises ikke på nettsiden.")}
                  </p>
                </div>

                {saveButton}
              </div>
            )}

            {activeTab === "tjeneste" && (
              <>
                {/* Gruppetilhørighet */}
                <section
                  id="person-groups-section"
                  className={studioDetailSection}
                >
                  <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
                    <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[var(--studio-muted)]" />
                      Gruppetilhørighet ({personGroups.length})
                    </span>
                  </div>

                  {personGroups.length === 0 ? (
                    <p className="text-xs text-[var(--studio-muted)] italic py-2">
                      Personen er ikke deltaker i noen grupper ennå.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {personGroups.map((group) => {
                        const isLeader = group.leaderIds.includes(person.id);
                        const isDeputy = group.deputyLeaderIds?.includes(person.id);

                        return (
                          <div
                            key={group.id}
                            className={studioDetailRow}
                          >
                            <div>
                              <Link
                                to={`/admin/gruppe/${group.id}`}
                                className={`${studioDetailLink} transition-colors`}
                              >
                                {group.name}
                              </Link>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isLeader && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                  <UserCheck className="w-3 h-3" />
                                  Leder
                                </span>
                              )}
                              {isDeputy && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                                  <UserCog className="w-3 h-3" />
                                  Nestleder
                                </span>
                              )}
                              {!isLeader && !isDeputy && (
                                <>
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-[var(--studio-text)]">
                                    Deltaker
                                  </span>
                                  {/* A leader or deputy is changed on the group's own page, where the next one is chosen */}
                                  <button
                                    type="button"
                                    onClick={() => handleLeaveGroup(group.id, group.name)}
                                    aria-label={`Ta ut av ${group.name}`}
                                    className="text-[10px] font-bold text-red-700 hover:text-red-900 cursor-pointer"
                                  >
                                    Ta ut
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {joinChoices.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <select
                        id="person-join-group"
                        aria-label="Legg til i gruppe"
                        value={groupToJoin}
                        onChange={(event) => setGroupToJoin(event.target.value)}
                        className={`${studioDetailInput} sm:flex-1`}
                      >
                        <option value="">Legg til i gruppe …</option>
                        {joinChoices.map((choice) => (
                          <optgroup key={choice.label} label={choice.label}>
                            {choice.groups.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleJoinGroup}
                        disabled={groupToJoin === ""}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer shrink-0"
                      >
                        Legg til
                      </button>
                    </div>
                  )}
                </section>

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

                  {saveButton}
                </div>

                {/* What the person has taken on */}
                <section id="person-tasks-section" className={studioDetailSection}>
                  <div className="flex items-center justify-between border-b border-[var(--studio-border)] pb-2">
                    <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      Oppgaver
                    </span>
                    <span className="text-[11px] text-[var(--studio-muted)] font-medium">
                      {taskOverview.comingCount} framover · {taskOverview.heldCount} holdt siste 3 måneder
                      {taskOverview.askedCount > 0 ? ` · ${taskOverview.askedCount} spurt, ikke svart` : ""}
                    </span>
                  </div>

                  {taskOverview.byRole.length > 0 && (
                    <table className="w-full text-xs">
                      <caption className="sr-only">Oppgaver personen har sagt ja til, per rolle</caption>
                      <thead>
                        <tr className="text-left text-[11px] text-[var(--studio-muted)]">
                          <th className="py-1 pr-3 font-bold">Rolle</th>
                          <th className="py-1 pr-3 font-bold text-right">Kommer</th>
                          <th className="py-1 font-bold text-right">Holdt siste 3 mnd.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskOverview.byRole.map((line) => (
                          <tr key={line.role} className="border-t border-[var(--studio-border)]">
                            <td className="py-1.5 pr-3 font-semibold text-[var(--studio-text)]">{line.role}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums text-[var(--studio-text)]">{line.coming}</td>
                            <td className="py-1.5 text-right tabular-nums text-[var(--studio-text)]">{line.held}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {taskOverview.coming.length === 0 && taskOverview.held.length === 0 ? (
                    <p className="text-xs text-[var(--studio-muted)] italic py-1">Personen har ingen oppgaver framover, og hadde ingen de siste 3 månedene.</p>
                  ) : (
                    <>
                      {taskOverview.coming.length > 0 && (
                        <div className="space-y-1.5 pt-1" role="list" aria-label="Oppgaver som kommer">
                          {taskOverview.coming.map(taskLine)}
                        </div>
                      )}
                      {taskOverview.held.length > 0 && (
                        <details className="pt-1">
                          <summary className="text-xs font-bold text-[var(--studio-text)] cursor-pointer">Holdt siste 3 måneder ({taskOverview.held.length})</summary>
                          <div className="space-y-1.5 pt-2">{taskOverview.held.map(taskLine)}</div>
                        </details>
                      )}
                    </>
                  )}
                </section>
              </>
            )}

            {activeTab === "medlemskap" && (
              <>
                <div className={studioDetailCard}>
                  {membershipFields}
                  {mayWithdraw && (
                    <button
                      type="button"
                      onClick={() => setWithdrawOpen(true)}
                      className="w-full px-4 py-2 rounded-xl border border-rose-300 text-rose-800 text-xs font-bold"
                    >
                      Meld ut (oppgave til protokoll)
                    </button>
                  )}
                  {saveButton}
                </div>
                {(clerkOnly || canManageMembershipApplications(currentUser)) && <PersonMembershipLogSection person={person} />}
              </>
            )}

            {activeTab === "tilgang" && (
              <div className={studioDetailCard}>
                {isFullAdmin && (
                  <label className="flex items-center gap-2 text-xs text-[var(--studio-text)]">
                    <input
                      id="check-edit-membership-clerk"
                      type="checkbox"
                      checked={membershipClerk}
                      onChange={(event) => setMembershipClerk(event.target.checked)}
                    />
                    Protokollansvarlig (Personer i admin og Mitt medlemskap)
                  </label>
                )}

                {/* Global systemrolle (Sikrer støtte for flere co-admins) */}
                <div className="space-y-1.5 pt-1 border-t border-[var(--studio-border)]">
                  <label
                    htmlFor="select-edit-person-role"
                    className="text-xs font-bold text-[var(--studio-muted)] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-indigo-600" />
                      Global systemrolle:
                    </span>
                    <span className="text-[10px] text-[var(--studio-muted)] font-normal">
                      (Muliggjør 2+ likestilte administratorer)
                    </span>
                  </label>
                  <select
                    id="select-edit-person-role"
                    value={globalRole}
                    onChange={(e) => setGlobalRole(e.target.value as Person["globalRole"])}
                    className={studioDetailInput}
                  >
                    <option value="member">Vanlig tilgang (standard)</option>
                    <option value="nettredaktor">Nettredaktør (bare nettsiden, ikke personregisteret eller planleggingen)</option>
                    <option value="admin">Administrator (full tilgang til Admin Studio & CMS)</option>
                  </select>
                </div>

                {saveButton}
              </div>
            )}

            {activeTab === "nettside" && (
              <div className={studioDetailCard}>
                {/* Stab & Ansettelse */}
                <div className="space-y-3 pt-3 border-t border-[var(--studio-border)] bg-[var(--studio-accent-bg)] p-3.5 rounded-2xl border border-[var(--studio-accent-border)]/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--studio-text)] flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                      Stab & Ansettelse:
                    </span>
                    {isStaff ? (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                        Ansatt i staben
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--studio-muted)] font-normal">Frivillig / Ikke stab</span>
                    )}
                  </div>

                  <label htmlFor="input-edit-person-is-staff" className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="input-edit-person-is-staff"
                      checked={isStaff}
                      onChange={(e) => {
                        setIsStaff(e.target.checked);
                        if (e.target.checked && !isPublicProfile) {
                          setIsPublicProfile(true);
                        }
                      }}
                      className="w-4 h-4 mt-0.5 border border-slate-300 rounded-md cursor-pointer accent-indigo-600"
                    />
                    <span className="text-[11px] font-semibold text-slate-200">
                      Personen er ansatt i staben og kan vises i stabsseksjoner på nettsiden
                    </span>
                  </label>

                  {isStaff && (
                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)]">
                            Stillingstittel utad
                          </label>
                          <input
                            type="text"
                            value={staffRole}
                            onChange={(e) => setStaffRole(e.target.value)}
                            placeholder="f.eks. Hovedpastor, Daglig leder..."
                            className={studioDetailInput}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)]">
                            Kategori
                          </label>
                          <select
                            value={staffCategory}
                            onChange={(e) => setStaffCategory(e.target.value as any)}
                            className={studioDetailInput}
                          >
                            <option value="pastor">Pastor / Forkynner</option>
                            <option value="stab">Administrasjon & Ledelse</option>
                            <option value="barneleder">Barn & Ungdom</option>
                            <option value="diakoni">Diakoni & Omsorg</option>
                            <option value="annet">Annet</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)]">
                          Kort bio / introduksjon for nettsiden
                        </label>
                        <textarea
                          rows={2}
                          value={staffBio}
                          onChange={(e) => setStaffBio(e.target.value)}
                          placeholder="Skriv 1-3 setninger om personens ansvarsområde eller bakgrunn..."
                          className={studioDetailInput}
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1 text-xs">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--studio-muted)] shrink-0">
                          Bilde-URL:
                        </label>
                        <input
                          type="url"
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          placeholder="https://... eller bruk kamerasymbolet øverst"
                          className={studioDetailInput}
                        />
                        {avatarUrl && (
                          <button
                            type="button"
                            onClick={() => setAvatarUrl("")}
                            className="text-rose-500 hover:text-rose-700 text-xs px-1 cursor-pointer"
                            title="Fjern bilde"
                          >
                            Fjern
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Offentlig profil på nettsiden (krever samtykke) */}
                <div className="space-y-2 pt-2 border-t border-[var(--studio-border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--studio-muted)] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                      Offentlig profil på nettsiden:
                    </span>
                    {toPublicProfile(person) ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Vises offentlig
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--studio-muted)] font-normal">Vises ikke</span>
                    )}
                  </div>

                  <label htmlFor="input-edit-person-public" className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="input-edit-person-public"
                      checked={isPublicProfile}
                      onChange={(e) => setIsPublicProfile(e.target.checked)}
                      className="w-4 h-4 mt-0.5 border border-slate-300 rounded-md cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-[var(--studio-muted)]">
                      Personen har samtykket til å stå med navn på den offentlige nettsiden
                    </span>
                  </label>

                  {person.consentToPublishGivenAt && (
                    <p className={studioDetailMuted}>
                      Samtykke registrert {new Date(person.consentToPublishGivenAt).toLocaleDateString("no-NO")}.
                    </p>
                  )}

                  {isPublicProfile && (
                    <div className="space-y-2 bg-[var(--studio-row)] p-2.5 rounded-xl border border-[var(--studio-border)]">
                      <input
                        type="text"
                        id="input-edit-person-public-title"
                        aria-label="Tittel utad"
                        value={publicTitle}
                        onChange={(e) => setPublicTitle(e.target.value)}
                        placeholder="Tittel utad, f.eks. Hovedpastor"
                        className={studioDetailInput}
                      />
                      <input
                        type="tel"
                        id="input-edit-person-public-phone"
                        aria-label="Telefon utad"
                        value={publicPhone}
                        onChange={(e) => setPublicPhone(e.target.value)}
                        placeholder="Telefon utad (valgfritt)"
                        className={studioDetailInput}
                      />
                      <input
                        type="email"
                        id="input-edit-person-public-email"
                        aria-label="E-post utad"
                        value={publicEmail}
                        onChange={(e) => setPublicEmail(e.target.value)}
                        placeholder="E-post utad (valgfritt)"
                        className={studioDetailInput}
                      />
                      <p className={studioDetailMuted}>
                        Bare navnet og disse feltene vises utad. Privat mobilnummer og e-postadresse publiseres aldri.
                      </p>
                    </div>
                  )}
                </div>

                {saveButton}
              </div>
            )}
          </form>
        </div>

        {/* Deleting the contact: last on the card, where nobody presses it on the way to something else */}
        {!clerkOnly && (
          <section className="rounded-2xl border border-red-200 bg-red-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-bold text-red-900">Slett kontakten</p>
              <p className="text-red-800/80">Du får se hva som skjer før noe slettes.</p>
            </div>
            <button
              type="button"
              id="btn-delete-person"
              onClick={() => setDeleting(true)}
              className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              Slett kontakt
            </button>
          </section>
        )}
      </div>

      {withdrawOpen && (
        <WithdrawMembershipDialog
          person={person}
          onClose={() => setWithdrawOpen(false)}
          onCreated={() => showFeedback("Utmeldingsoppgave opprettet.", "success")}
        />
      )}

      {deleting && deletion && (
        <DeletePersonDialog
          personName={person.name}
          hasEmail={Boolean(person.email)}
          deletion={deletion}
          working={deleteWorking}
          onConfirm={handleDeletePerson}
          onClose={() => setDeleting(false)}
        />
      )}
    </StudioDetailShell>
  );
};
