import {
  Person,
  Group,
  Gathering,
  GatheringVisibility,
  Task,
  Assignment,
  GatheringAttendance,
  GatheringHeadcount,
  GroupMessage,
  MemberProposal,
  GroupCategory,
  MeetingSchedule,
  VolunteerRole,
} from "../types";
import type { CmsMedia, CmsMediaVariants } from "./cmsData";
import { newId } from "../utils/id";
import { visibilityFields } from "../utils/visibility";
import { isWorshipService } from "../utils/gatherings";
import { headcountIdFor, type HeadcountInput } from "../utils/headcount";
import { proposalName } from "../utils/memberProposals";

// Each new document is built here exactly once, so its id and its defaults are decided in one place.

export interface NewPersonInput {
  name: string;
  phone?: string;
  email?: string;
  /** A calendar day, "1980-03-12". Left out when the form is empty. */
  birthDate?: string;
  congregationMember?: boolean;
  denominationMember?: boolean;
  globalRole?: "member" | "admin";
}

export interface NewGroupInput {
  name: string;
  description?: string;
  category?: GroupCategory;
  tags?: string[];
  isPublic?: boolean;
  leaderIds?: string[];
  deputyLeaderIds?: string[];
  memberIds?: string[];
  meetingSchedule?: MeetingSchedule;
}

export interface NewGatheringInput {
  /** The group responsible for the gathering. */
  groupId: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  type?: "arrangement" | "gruppesamling";
  theme?: string;
  bibleText?: string;
  hostPersonId?: string;
  visibility?: GatheringVisibility;
  isGudstjeneste?: boolean;
  cancelled?: boolean;
  sendInvitationImmediately?: boolean;
  /** How the event is presented on the website (see utils/gatheringPresentation.ts). */
  imageUrl?: string;
  imageAlt?: string;
  summary?: string;
  content?: string;
  linkUrl?: string;
  linkLabel?: string;
  /** The template the event is made from, and the series it is part of. */
  templateId?: string;
  seriesId?: string;
}

export interface NewTaskInput {
  gatheringId: string;
  groupId?: string;
  volunteerRoleId?: string;
  title: string;
  description?: string;
  instruction?: string;
  status?: Task["status"];
  neededCount?: number;
}

export interface NewVolunteerRoleInput {
  name: string;
  instruction?: string;
  groupId?: string;
  sortOrder?: number;
}

/**
 * A leader's proposal that an administrator add someone to a group.
 * Null when the name is empty or too long: the document would not be one the rules accept.
 */
export function buildMemberProposal(data: {
  groupId: string;
  proposedBy: string;
  name: string;
}): MemberProposal | null {
  const name = proposalName(data.name);
  if (!name || data.groupId === "" || data.proposedBy === "") return null;
  return {
    id: newId("proposal"),
    groupId: data.groupId,
    name,
    proposedBy: data.proposedBy,
    proposedAt: new Date().toISOString(),
    status: "pending",
  };
}

export function buildPerson(data: NewPersonInput): Person {
  return {
    id: newId("person"),
    name: data.name.trim(),
    phone: data.phone?.trim() || "",
    email: data.email?.trim() || "",
    birthDate: data.birthDate?.trim() || undefined,
    ...(data.congregationMember ? { congregationMember: true as const } : {}),
    ...(data.denominationMember ? { denominationMember: true as const } : {}),
    globalRole: data.globalRole || "member",
  };
}

export function buildGroup(data: NewGroupInput): Group {
  return {
    id: newId("group"),
    name: data.name.trim(),
    description: data.description?.trim(),
    category: data.category || "tjenestegruppe",
    tags: data.tags || [],
    isPublic: data.isPublic !== false,
    leaderIds: data.leaderIds || [],
    deputyLeaderIds: data.deputyLeaderIds || [],
    memberIds: data.memberIds || [],
    meetingSchedule: data.meetingSchedule,
  };
}

export function buildGathering(data: NewGatheringInput): Gathering {
  // `visibility` is the single source of truth; `isPublic` only mirrors it for older readers.
  const visibility = data.visibility || (data.type === "gruppesamling" ? "intern" : "offentlig");
  return {
    id: newId("gathering"),
    groupId: data.groupId,
    title: data.title.trim(),
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    location: data.location?.trim() || undefined,
    type: data.type || "arrangement",
    theme: data.theme,
    bibleText: data.bibleText,
    hostPersonId: data.hostPersonId,
    invitationSent: !!data.sendInvitationImmediately,
    invitationSentAt: data.sendInvitationImmediately ? new Date().toISOString() : undefined,
    ...visibilityFields(visibility),
    // Said outright by the form when it asks; otherwise the title decides, as it does for older documents
    isGudstjeneste: data.isGudstjeneste ?? isWorshipService({ title: data.title }),
    cancelled: data.cancelled ?? false,
    imageUrl: data.imageUrl,
    imageAlt: data.imageAlt,
    summary: data.summary,
    content: data.content,
    linkUrl: data.linkUrl,
    linkLabel: data.linkLabel,
    templateId: data.templateId,
    seriesId: data.seriesId,
  };
}

export function buildTask(data: NewTaskInput): Task {
  return {
    id: newId("task"),
    gatheringId: data.gatheringId,
    groupId: data.groupId,
    volunteerRoleId: data.volunteerRoleId,
    title: data.title.trim(),
    description: data.description,
    instruction: data.instruction,
    status: data.status || "open",
    neededCount: data.neededCount || 1,
  };
}

export function buildAssignment(
  taskId: string,
  personId: string,
  response: "confirmed" | "pending",
  place?: {
    personName: string;
    gatheringId: string;
    gatheringGroupId: string;
    gatheringPublic: boolean;
    nameGroupId?: string;
  }
): Assignment {
  return {
    id: newId(`assign-${taskId}-${personId}`),
    taskId,
    personId,
    response,
    assignedAt: new Date().toISOString(),
    ...(place
      ? {
          personName: place.personName,
          gatheringId: place.gatheringId,
          gatheringGroupId: place.gatheringGroupId,
          gatheringPublic: place.gatheringPublic,
          ...(place.nameGroupId ? { nameGroupId: place.nameGroupId } : {}),
        }
      : {}),
  };
}

/**
 * A person's answer to a gathering. The id is made from the two, so each person
 * has one answer per gathering and a new answer replaces the old one.
 */
export function buildAttendance(
  gatheringId: string,
  personId: string,
  status: GatheringAttendance["status"]
): GatheringAttendance {
  return {
    id: `att-${gatheringId}-${personId}`,
    gatheringId,
    personId,
    status,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * The headcount registered for a gathering. The id is made from the gathering, so a
 * corrected count replaces the first one instead of being counted twice.
 */
export function buildHeadcount(
  gatheringId: string,
  input: HeadcountInput,
  registeredBy?: string
): GatheringHeadcount {
  return {
    id: headcountIdFor(gatheringId),
    gatheringId,
    adults: input.adults,
    children: input.children,
    note: input.note?.trim() || undefined,
    registeredAt: new Date().toISOString(),
    registeredBy,
  };
}

export function buildVolunteerRole(data: NewVolunteerRoleInput): VolunteerRole {
  return {
    id: newId("volrole"),
    name: data.name.trim(),
    instruction: data.instruction?.trim() || "",
    groupId: data.groupId,
    sortOrder: data.sortOrder ?? 0,
  };
}

export interface NewCmsMediaInput {
  id?: string;
  title: string;
  altText: string;
  tags?: string[];
  source: CmsMedia["source"];
  sourcePath: string;
  variants: CmsMediaVariants;
  width: number;
  height: number;
  byteSize: number;
  approvedForAi?: boolean;
  status?: CmsMedia["status"];
}

export function buildCmsMedia(data: NewCmsMediaInput): CmsMedia {
  return {
    id: data.id || newId("media"),
    title: data.title.trim() || "Uten tittel",
    altText: data.altText.trim(),
    tags: (data.tags || []).map((tag) => tag.trim()).filter(Boolean),
    status: data.status || "ready",
    approvedForAi: data.approvedForAi === true,
    source: data.source,
    sourcePath: data.sourcePath,
    variants: data.variants,
    width: data.width,
    height: data.height,
    byteSize: data.byteSize,
    updatedAt: new Date().toISOString(),
  };
}

export function buildGroupMessage(
  groupId: string,
  sender: Pick<Person, "id" | "name">,
  content: string,
  imageUrl?: string
): GroupMessage {
  return {
    id: newId("msg"),
    groupId,
    senderPersonId: sender.id,
    senderName: sender.name,
    content: content.trim(),
    imageUrl,
    createdAt: new Date().toISOString(),
  };
}
