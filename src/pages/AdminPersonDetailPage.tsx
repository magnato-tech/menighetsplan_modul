import React, { useState, useEffect } from "react";
import { isServiceGroup } from "../utils/personDirectory";
import type { ExtraEmail, Person } from "../types";
import { useFirebase } from "../context/FirebaseDataContext";
import { extraEmailsOf } from "../utils/personEmails";
import { groupsToJoin } from "../utils/groupChoice";
import { personTaskOverview } from "../utils/personTasks";
import { personDeletion } from "../utils/personDeletion";
import { deletePersonWithTraces } from "../services/personDeletion";
import { reportWriteError } from "../services/writeErrors";
import { DeletePersonDialog } from "./admin/DeletePersonDialog";
import { membershipClerkBoardUrl, studioTabUrl } from "./admin/studio";
import { writeEmailHandover } from "../utils/emailLists";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAdminDetailRoute } from "../utils/adminStudioRoutes";
import { useAdminPersonDetail } from "../hooks/useAppHooks";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { StudioDetailShell, StudioDetailNotFound } from "./admin/StudioDetailShell";
import { useTimedMessage } from "../hooks/useTimedMessage";
import { toPublicProfile, publicProfileFields } from "../utils/publicProfile";
import { compressImageFile } from "../utils/imageUpload";
import { birthDateError } from "../utils/birthDate";
import { extraEmailsError, extraEmailsToStore, membershipValue } from "../utils/personForm";
import { canManageMembershipApplications } from "./admin/membershipClerk";
import { WithdrawMembershipDialog } from "./admin/membership/WithdrawMembershipDialog";
import { PersonHeader } from "./admin/person/PersonHeader";
import { PersonTabRow } from "./admin/person/PersonTabRow";
import { PersonProfileTab } from "./admin/person/PersonProfileTab";
import { PersonGroupsSection } from "./admin/person/PersonGroupsSection";
import { PersonAvailabilityCard } from "./admin/person/PersonAvailabilityCard";
import { PersonTasksSection } from "./admin/person/PersonTasksSection";
import { PersonMembershipTab } from "./admin/person/PersonMembershipTab";
import { PersonAccessTab } from "./admin/person/PersonAccessTab";
import { PersonWebsiteTab } from "./admin/person/PersonWebsiteTab";
import { PersonDeleteSection } from "./admin/person/PersonDeleteSection";
import { PERSON_TABS, personPanelId, personTabId, toPersonTab, type PersonTab } from "./admin/person/personShared";

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
  const panelId = personPanelId(activeTab);

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
    document.getElementById(personTabId(tab))?.focus();
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

  return (
    <StudioDetailShell
      backTab={fromMembershipBoard ? "planlegger-medlemskap" : "planlegger-personer"}
      backLabel={fromMembershipBoard ? "Tilbake til oppgavebord" : "Tilbake til personregister"}
      badge="Personkort"
      feedback={feedback}
    >
      {membershipBack}
      <div className="space-y-5">
        <PersonHeader
          person={person}
          clerkOnly={clerkOnly}
          avatarUrl={avatarUrl}
          showsRole={showsRole}
          roleLabel={roleLabel}
          leaderGroups={leaderGroups}
          handleImageUpload={handleImageUpload}
          sendEmail={sendEmail}
        />
        {visibleTabs.length > 1 && (
          <PersonTabRow
            visibleTabs={visibleTabs}
            activeTab={activeTab}
            panelId={panelId}
            selectTab={selectTab}
            handleTabKeyDown={handleTabKeyDown}
          />
        )}

        <div role="tabpanel" id={panelId} aria-labelledby={personTabId(activeTab)} className="space-y-5">
          {/* One form for the tab in view: the fields of every tab live in the page, so nothing is lost when the tab changes */}
          <form onSubmit={handleSave} className="space-y-4">
            {activeTab === "profil" && (
              <PersonProfileTab
                name={name}
                setName={setName}
                phone={phone}
                setPhone={setPhone}
                email={email}
                setEmail={setEmail}
                extraEmails={extraEmails}
                setExtraEmails={setExtraEmails}
                birthDate={birthDate}
                setBirthDate={setBirthDate}
                justSaved={justSaved}
              />
            )}

            {activeTab === "tjeneste" && (
              <>
                <PersonGroupsSection
                  personGroups={personGroups}
                  person={person}
                  joinChoices={joinChoices}
                  groupToJoin={groupToJoin}
                  setGroupToJoin={setGroupToJoin}
                  handleJoinGroup={handleJoinGroup}
                  handleLeaveGroup={handleLeaveGroup}
                />
                <PersonAvailabilityCard
                  unavailablePeriods={unavailablePeriods}
                  newUnavailFrom={newUnavailFrom}
                  setNewUnavailFrom={setNewUnavailFrom}
                  newUnavailTo={newUnavailTo}
                  setNewUnavailTo={setNewUnavailTo}
                  newUnavailReason={newUnavailReason}
                  setNewUnavailReason={setNewUnavailReason}
                  policeCert={policeCert}
                  setPoliceCert={setPoliceCert}
                  handleAddUnavailablePeriod={handleAddUnavailablePeriod}
                  handleRemoveUnavailablePeriod={handleRemoveUnavailablePeriod}
                  justSaved={justSaved}
                />
                <PersonTasksSection taskOverview={taskOverview} />
              </>
            )}

            {activeTab === "medlemskap" && (
              <PersonMembershipTab
                person={person}
                congregationMember={congregationMember}
                setCongregationMember={setCongregationMember}
                congregationJoinedAt={congregationJoinedAt}
                setCongregationJoinedAt={setCongregationJoinedAt}
                denominationMember={denominationMember}
                setDenominationMember={setDenominationMember}
                denominationJoinedAt={denominationJoinedAt}
                setDenominationJoinedAt={setDenominationJoinedAt}
                denominationEnrollmentType={denominationEnrollmentType}
                setDenominationEnrollmentType={setDenominationEnrollmentType}
                denominationGEndedAt={denominationGEndedAt}
                setDenominationGEndedAt={setDenominationGEndedAt}
                mayWithdraw={Boolean(mayWithdraw)}
                onWithdraw={() => setWithdrawOpen(true)}
                showMembershipLog={Boolean(clerkOnly || canManageMembershipApplications(currentUser))}
                justSaved={justSaved}
              />
            )}

            {activeTab === "tilgang" && (
              <PersonAccessTab
                isFullAdmin={isFullAdmin}
                membershipClerk={membershipClerk}
                setMembershipClerk={setMembershipClerk}
                globalRole={globalRole}
                setGlobalRole={setGlobalRole}
                justSaved={justSaved}
              />
            )}

            {activeTab === "nettside" && (
              <PersonWebsiteTab
                person={person}
                isStaff={isStaff}
                setIsStaff={setIsStaff}
                staffRole={staffRole}
                setStaffRole={setStaffRole}
                staffCategory={staffCategory}
                setStaffCategory={setStaffCategory}
                staffBio={staffBio}
                setStaffBio={setStaffBio}
                avatarUrl={avatarUrl}
                setAvatarUrl={setAvatarUrl}
                isPublicProfile={isPublicProfile}
                setIsPublicProfile={setIsPublicProfile}
                publicTitle={publicTitle}
                setPublicTitle={setPublicTitle}
                publicPhone={publicPhone}
                setPublicPhone={setPublicPhone}
                publicEmail={publicEmail}
                setPublicEmail={setPublicEmail}
                justSaved={justSaved}
              />
            )}
          </form>
        </div>

        {/* Deleting the contact: last on the card, where nobody presses it on the way to something else */}
        {!clerkOnly && <PersonDeleteSection onDelete={() => setDeleting(true)} />}
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
