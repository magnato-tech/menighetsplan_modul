// Exact Domain Models requested for Menighetsplan

export interface UnavailablePeriod {
  from: string; // ISO date YYYY-MM-DD
  to: string;   // ISO date YYYY-MM-DD
  reason?: string;
}

export interface Person {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  /** The date of birth, a calendar day: "1980-03-12" (see utils/birthDate.ts). Never part of what the website shows. */
  birthDate?: string;
  /** Whether the person belongs to this congregation. Absent means they do not. Only on the register. */
  congregationMember?: boolean;
  /** Whether the person belongs to its denomination. Absent means they do not. Only on the register. */
  denominationMember?: boolean;
  /** Calendar day the person joined the congregation, when known: "1980-03-12". Only on the register. */
  congregationJoinedAt?: string;
  /** Calendar day the person joined the denomination, when known. Only on the register. */
  denominationJoinedAt?: string;
  /** Calendar day the person left the congregation, when known. Only on the register. */
  congregationEndedAt?: string;
  /** Calendar day the person left the denomination, when known. Only on the register. */
  denominationEndedAt?: string;
  /** How the person is enrolled in the denomination: adult (A) or child with parents (G). Only on the register. */
  denominationEnrollmentType?: "A" | "G";
  /** Calendar day G membership ended when the person confirms adult (A) membership. Only on the register. */
  denominationGEndedAt?: string;
  /** References to membership forms this person has sent; protokollansvarlig may read the list. */
  membershipLog?: MembershipLogEntry[];
  /** May open «Mitt medlemskap» on Min side and work with the membership protocol. An administrator may have this too. */
  membershipClerk?: true;
  /** «nettredaktor»: the website part of the admin only, never the register or the planning (see utils/session.ts). */
  globalRole: "member" | "admin" | "nettredaktor";
  policeCertificateValidUntil?: string; // ISO date YYYY-MM-DD
  unavailablePeriods?: UnavailablePeriod[];
  // GDPR & Public Stabs-profil
  isPublicProfile?: boolean;
  publicTitle?: string;
  publicPhone?: string;
  publicEmail?: string;
  avatarUrl?: string;
  consentToPublishGivenAt?: string; // ISO timestamp
  consentGivenBy?: string; // UID of admin who registered consent
  // Stab og ansettelse
  isStaff?: boolean;
  staffRole?: string; // f.eks. "Hovedpastor", "Daglig leder", "Barne- og ungdomsarbeider"
  staffCategory?: "pastor" | "stab" | "barneleder" | "diakoni" | "annet";
  staffBio?: string;
  staffOrder?: number;
  /** Modules this person has hidden on the analysis board (see utils/analyticsModules.ts). */
  analyticsHiddenModules?: string[];
  /** Secret token for the personal iCal feed at /api/min/kalender.ics (not the person's id). */
  calendarFeedToken?: string;
  /** The key in the person's link to unsubscribe from the newsletter (see utils/newsletter.ts). Written the first time a newsletter is sent to them. */
  newsletterToken?: string;
  /** More e-mail addresses than `email`, each with its own choices (see utils/personEmails.ts). Absent means none. */
  extraEmails?: ExtraEmail[];
  updatedBy?: string;
  updatedAt?: string;
}

/**
 * An e-mail address a person has besides the main one. `copy`: gets a copy of e-mail from the
 * administration, as the main address does. `login`: can be used to sign in.
 */
export interface ExtraEmail {
  address: string;
  copy: boolean;
  login: boolean;
}

export type GroupCategory = "tjenestegruppe" | "husgruppe" | "strategigruppe" | "ledergruppe" | "interessegruppe";

export interface MeetingSchedule {
  weekday: string;
  time: string;
  frequency: "hver uke" | "annenhver uke" | "hver måned";
}

/** «Spør om oppmøte»: never, or this many days before a meeting. */
export type AttendanceQuestion = "off" | 2 | 3 | 7 | 14;

export interface Group {
  id: string;
  name: string;
  description?: string;
  category?: GroupCategory;
  tags?: string[];
  isPublic?: boolean;
  memberIds: string[];
  leaderIds: string[];
  deputyLeaderIds?: string[];
  meetingSchedule?: MeetingSchedule;
  /**
   * Whether the participants are asked on Min side if they are coming to a meeting, and how many days
   * before: "off" never, a number of days before the meeting. Absent: ATTENDANCE_QUESTION_DAYS (utils/meetingPlan.ts).
   */
  attendanceQuestion?: AttendanceQuestion;
  memberJoinedAt?: Record<string, string>; // ISO date when person joined group
  notificationPreferences?: Record<string, boolean>; // personId -> true/false
}

export type MembershipApplicationKind =
  | "congregationApply"
  | "denominationAdultEnroll"
  | "denominationChildEnroll"
  | "denominationGToA";

export type MembershipApplicationStatus =
  | "submitted"
  | "received"
  | "cornerstoneDone"
  | "completed"
  | "dismissed";

/** Extra lines on the person log besides Min-side søknader. */
export type MembershipLogExtraKind = "withdrawal" | "enrollmentDateCorrection";

export type MembershipLogKind = MembershipApplicationKind | MembershipLogExtraKind;

/** A line on the person card: archived form or protokollansvarlig-handling. */
export interface MembershipLogEntry {
  applicationId?: string;
  taskId?: string;
  kind: MembershipLogKind;
  submittedAt: string;
  status: MembershipApplicationStatus | "completed";
  updatedAt: string;
  /** Short note for utmelding eller datoretting. */
  note?: string;
}

/**
 * A congregation membership application or denomination enrollment, sent from Min side.
 * Stored confidentially for protokollansvarlig; national id is never copied to the person card.
 */
export interface MembershipApplication {
  id: string;
  kind: MembershipApplicationKind;
  personId: string;
  submittedAt: string;
  status: MembershipApplicationStatus;
  /** Name shown in protokollansvarligens liste. */
  applicantName: string;
  lastName: string;
  firstNames: string;
  address: string;
  phone: string;
  email: string;
  /** Eleven digits when given. Only on this document. */
  nationalId: string;
  baptized: boolean;
  baptizedDate?: string;
  congregationName?: string;
  alsoDenomination?: boolean;
  notOtherDenomination: boolean;
  childrenToEnroll?: boolean;
  signaturePlace: string;
  signatureDate: string;
  /** Child enrollment (vedlegg). */
  childLastName?: string;
  childFirstNames?: string;
  childNationalId?: string;
  childBirthPlace?: string;
  childBaptized?: boolean;
  childBaptizedDate?: string;
  parent2Name?: string;
  childFromOtherDenomination?: boolean;
  childAttestationAttached?: boolean;
  parent2ConfirmNoOther?: boolean;
  parent2SignaturePlace?: string;
  parent2SignatureDate?: string;
  receivedAt?: string;
  receivedBy?: string;
  cornerstoneAt?: string;
  cornerstoneBy?: string;
  completedAt?: string;
  completedBy?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  /** Filled by protokollansvarlig when completing a G→A transition (reference log). */
  transitionGEndedAt?: string;
  transitionAStartedAt?: string;
  /** When the protokollansvarlig and administrators were e-mailed about it (server/applicationNotice.ts). Set by the server only. */
  noticeSentAt?: string;
}

export type MembershipClerkTaskKind = "correctEnrollmentDate" | "application" | "withdrawal" | "loginUnknownEmail";

/** Why someone's sign-in was stopped by an address the register does not know: nobody has it, or several persons share it. */
export type LoginProblemReason = "noMatch" | "shared";

export type MembershipClerkTaskStatus = "open" | "done";

/** Work item on the membership clerk task board. */
export interface MembershipClerkTask {
  id: string;
  kind: MembershipClerkTaskKind;
  status: MembershipClerkTaskStatus;
  createdAt: string;
  personId: string;
  personName: string;
  instruction: string;
  comment?: string;
  doneAt?: string;
  doneBy?: string;
  /** For correctEnrollmentDate: which date field must be corrected. */
  enrollmentField?: "congregationJoinedAt" | "denominationJoinedAt";
  /** Set when the task is completed with a new enrollment date. */
  correctedEnrollmentDate?: string;
  applicationId?: string;
  withdrawCongregation?: boolean;
  withdrawDenomination?: boolean;
  withdrawalDate?: string;
  cornerstoneUpdated?: boolean;
  /** Innmelding: signert skjema er lagt i arkivet (steg 2). */
  applicationArchiveConfirmed?: boolean;
  /** @deprecated Bruk attestationEmailedAt eller attestationPosted. */
  attestationSent?: boolean;
  attestationPosted?: boolean;
  attestationEmailedAt?: string;
  attestationEmailedBy?: string;
  /** loginUnknownEmail: the address (lower-cased) that a sign-in was stopped with. */
  loginAddress?: string;
  loginReason?: LoginProblemReason;
  /** loginUnknownEmail: how many times the address has tried since the task was made. */
  attempts?: number;
  /** loginUnknownEmail: when the address last tried, as an ISO time. */
  lastAttemptAt?: string;
}

/** A name a leader has asked an administrator to add to a group. Nothing but the name. */
export interface MemberProposal {
  id: string;
  groupId: string;
  name: string;
  /** The person in the register who sent it. */
  proposedBy: string;
  proposedAt: string;
  status: "pending" | "added" | "dismissed";
  /** When an administrator dealt with it. Outcomes are kept for 30 days from here. */
  decidedAt?: string;
}

export interface ProgramItem {
  id?: string;
  /** The clock time the post starts. Worked out from the gathering's start and the durations before it (see utils/programTiming.ts). */
  time: string;
  /** How long the post lasts, in minutes. Absent on programmes made before durations: then read from the clock times. */
  durationMinutes?: number;
  title: string;
  description?: string;
  taskId?: string;
  groupId?: string;
}

/**
 * The meeting leader who last changed the programme. The assignment is what the database rules
 * check: it must be that person's confirmed task on this very gathering.
 */
export interface ProgramEditedBy {
  assignmentId: string;
  personId: string;
  personName: string;
}

export type GatheringVisibility ="intern" | "offentlig" | "fremhevet";

export interface Gathering {
  id: string;
  groupId: string;
  title: string;
  startsAt: string; // ISO date
  endsAt?: string; // ISO date, optional end time
  location?: string;
  type?: "arrangement" | "gruppesamling";
  theme?: string;
  bibleText?: string;
  hostPersonId?: string;
  invitationSent?: boolean;
  invitationSentAt?: string;
  // Unified single source of visibility
  visibility: GatheringVisibility;
  isPublic?: boolean; // backwards compatibility alias for visibility !== "intern"
  isGudstjeneste?: boolean; // Whether this is a church service
  cancelled?: boolean; // Whether event is cancelled
  programSchedule?: ProgramItem[];
  /** Who last changed the programme from Min side, as meeting leader (see utils/programEditor.ts). */
  programEditedBy?: ProgramEditedBy;
  /** When the programme was last changed from Min side. ISO date. */
  programEditedAt?: string;
  // How the event is presented on the website (see utils/gatheringPresentation.ts). All optional.
  /** A picture: an address, or a picture from the media library. */
  imageUrl?: string;
  /** What the picture shows, for the one who does not see it. */
  imageAlt?: string;
  /** The place in the picture that stays in view when it is cut to fit a card, "x% y%" (see utils/focusPoint.ts). */
  imageFocus?: string;
  /** The lead: a sentence or two, shown on the event's card. */
  summary?: string;
  /** The longer text about the event, written as the text of a page is. */
  content?: string;
  /** Where the button on the event leads, e.g. to a sign-up form, and what the button says. */
  linkUrl?: string;
  linkLabel?: string;
  /** The template the event was made from, and the series it was made as part of (see utils/gatheringTemplates.ts and utils/series.ts). */
  templateId?: string;
  seriesId?: string;
  /** iCal UID when the event is linked to the congregation's external calendar. */
  externalCalendarUid?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export type Event = Gathering;

export interface GatheringAttendance {
  id: string;
  gatheringId: string;
  personId: string;
  status: "attending" | "declined"; // "attending" = KOMMER, "declined" = KOMMER IKKE
  updatedAt?: string;
}

/**
 * How many were actually there, counted on the day and registered afterwards.
 * A response ("Kommer") says who planned to come; this says who came. One count per
 * gathering: the id is derived from the gathering, so registering again replaces it.
 */
export interface GatheringHeadcount {
  id: string;
  gatheringId: string;
  adults: number;
  children: number;
  note?: string;
  registeredAt: string; // ISO timestamp
  registeredBy?: string; // person id
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderPersonId: string;
  senderName: string;
  content: string;
  imageUrl?: string; // Optional attached photo
  createdAt: string; // ISO date
}

export interface Task {
  id: string;
  gatheringId: string;
  /** Team responsible for staffing. Absent for roles without a team (e.g. Taler, Møteleder). */
  groupId?: string;
  /** When set, title and instruction come from the role library. */
  volunteerRoleId?: string;
  title: string;
  description?: string;
  /** Legacy per-task instruction. Used when volunteerRoleId is not set. */
  instruction?: string;
  status: "open" | "assigned" | "confirmed" | "vacant" | "cancelled";
  // Absent when an admin has reset the need to "not set"; readers then count it as 1
  neededCount?: number;
  lastReminded?: string; // ISO timestamp when reminder was sent/copied
  updatedBy?: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  taskId: string;
  personId: string;
  response: "pending" | "confirmed" | "declined" | "withdrawn";
  assignedAt?: string;
  respondedAt?: string;
  /** The person's name, so a run sheet can show it without the register. */
  personName?: string;
  /** The gathering the task belongs to. Copied onto the assignment so the rules can read it. */
  gatheringId?: string;
  /** The gathering's group. A member of that group may read the names on its tasks. */
  gatheringGroupId?: string;
  /** Whether the gathering is open to everyone. Copied so a member may read a public run sheet. */
  gatheringPublic?: boolean;
  /** The group whose directory the name was taken from, when a leader assigns someone else. */
  nameGroupId?: string;
}

/** Named volunteer slot on a gathering, e.g. Lyd or Kjøkken, with its own instruction. */
export interface VolunteerRole {
  id: string;
  name: string;
  instruction?: string;
  /** Default tjenesteteam for the role. Absent when the role has no team. */
  groupId?: string;
  sortOrder: number;
  updatedAt?: string;
}
