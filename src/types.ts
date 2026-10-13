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
  globalRole: "member" | "admin";
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
  updatedBy?: string;
  updatedAt?: string;
}

export type GroupCategory = "tjenestegruppe" | "husgruppe" | "strategigruppe" | "ledergruppe" | "interessegruppe";

export interface MeetingSchedule {
  weekday: string;
  time: string;
  frequency: "hver uke" | "annenhver uke" | "hver måned";
}

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
  memberJoinedAt?: Record<string, string>; // ISO date when person joined group
  notificationPreferences?: Record<string, boolean>; // personId -> true/false
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
  time: string;
  title: string;
  description?: string;
  taskId?: string;
  groupId?: string;
}

export type GatheringVisibility = "intern" | "offentlig" | "fremhevet";

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
  // How the event is presented on the website (see utils/gatheringPresentation.ts). All optional.
  /** A picture: an address, or a picture from the media library. */
  imageUrl?: string;
  /** What the picture shows, for the one who does not see it. */
  imageAlt?: string;
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
