import { COLLECTIONS } from "./collections";
import type { MockDocument } from "./mockDocuments";
import type {
  Assignment,
  Gathering,
  GatheringAttendance,
  GatheringHeadcount,
  Group,
  GroupMessage,
  Person,
  Task,
  VolunteerRole,
} from "../types";
import { allGroupPersonIds } from "../utils/groups";
import { headcountIdFor } from "../utils/headcount";
import { isGroupGathering, isWorshipService } from "../utils/gatherings";
import { parseIsoToDateAndTime } from "../utils/dates";
import { taskStatusFor } from "../utils/staffing";
import { visibilityFields } from "../utils/visibility";

// A simulated history of congregation life: Sunday services with counted attendance,
// staffing with yes, no and withdrawals, home groups with answers, and group messages.
// It is demo data for trying out the analysis board, built from the persons, groups and
// roles already in the database. Every document it makes is marked so it can be removed
// again without touching anything else (see isSimulatedDocument).

export const SIMULATION_PREFIX = "sim-";

export const SIMULATION_WEEK_OPTIONS = [12, 26, 52] as const;

export interface SimulationInput {
  now: number;
  weeks: number;
  persons: Person[];
  groups: Group[];
  volunteerRoles: VolunteerRole[];
  /** Gatherings already in the database. A day that already has a service is left alone; simulated ones are ignored. */
  gatherings: Gathering[];
  seed?: number;
}

/** Whether a stored document was made by the simulation. */
export function isSimulatedDocument(id: string, data: { gatheringId?: unknown; taskId?: unknown }): boolean {
  const fromSimulation = (value: unknown) => typeof value === "string" && value.startsWith(SIMULATION_PREFIX);
  return fromSimulation(id) || fromSimulation(data.gatheringId) || fromSimulation(data.taskId);
}

/** The collections the simulation writes to. */
export const SIMULATED_COLLECTIONS = [
  COLLECTIONS.GATHERINGS,
  COLLECTIONS.TASKS,
  COLLECTIONS.ASSIGNMENTS,
  COLLECTIONS.GATHERING_ATTENDANCES,
  COLLECTIONS.GATHERING_HEADCOUNTS,
  COLLECTIONS.GROUP_MESSAGES,
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** A small seeded random generator, so the same input always gives the same history. */
function random(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p: number) => next() < p,
    between: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
  };
}

const dayKey = (ms: number) => parseIsoToDateAndTime(new Date(ms).toISOString()).date;

function atLocalTime(dayMs: number, time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(dayMs);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.getTime();
}

/** The last `count` dates (at midnight, local time) falling on `weekday` (0 = Sunday) before `now`, oldest first. */
function lastWeekdays(now: number, weekday: number, count: number, everyNthWeek = 1): number[] {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 1);
  while (date.getDay() !== weekday) date.setDate(date.getDate() - 1);
  const days: number[] = [];
  for (let i = 0; i < count; i += everyNthWeek) {
    const day = new Date(date);
    day.setDate(date.getDate() - i * 7);
    days.push(day.getTime());
  }
  return days.reverse();
}

const WEEKDAY_INDEX: Record<string, number> = {
  søndag: 0,
  mandag: 1,
  tirsdag: 2,
  onsdag: 3,
  torsdag: 4,
  fredag: 5,
  lørdag: 6,
};

/** The roles a Sunday service is staffed with in the simulation, when the role library has them. */
const SUNDAY_ROLE_NAMES = ["Møteleder", "Taler", "Lovsang", "Lyd", "Bilde", "Møtevert", "Kjøkken", "Barnekirke", "Forbønn"];

const SERVICE_TITLES = [
  "Gudstjeneste",
  "Gudstjeneste med nattverd",
  "Gudstjeneste med barnekirke",
  "Familiegudstjeneste",
  "Misjonsgudstjeneste",
];

const MESSAGES: Record<string, string[]> = {
  husgruppe: [
    "Takk for en god kveld i går!",
    "Hvem tar med kake neste gang?",
    "Husk at vi møtes en halvtime senere neste uke.",
    "Ber for dere som har det travelt om dagen.",
    "Her er bibelteksten vi snakket om.",
  ],
  tjenestegruppe: [
    "Kan noen bytte med meg på søndag?",
    "Takk for innsatsen i dag, alle sammen!",
    "Vi trenger en til på søndag. Noen som kan?",
    "Nytt oppsett er klart. Si fra om noe mangler.",
  ],
  annen: ["Neste møte er satt opp i kalenderen.", "Takk for sist!", "Kort oppdatering fra arbeidet denne uken."],
};

/** How many come relative to an ordinary Sunday: fewer in the summer, more in Advent. */
function seasonOf(month: number): number {
  if (month === 6) return 0.62;
  if (month === 5 || month === 7) return 0.85;
  if (month === 11) return 1.18;
  return 1;
}

interface Built {
  gatherings: Gathering[];
  tasks: Task[];
  assignments: Assignment[];
  attendances: GatheringAttendance[];
  headcounts: GatheringHeadcount[];
  messages: GroupMessage[];
}

/** The simulated history as documents to store. Empty when there are no persons or groups to build from. */
export function buildSimulatedChurchLife(input: SimulationInput): MockDocument[] {
  const { now, persons, groups } = input;
  const weeks = Math.max(1, Math.min(104, Math.round(input.weeks)));
  if (persons.length === 0 || groups.length === 0) return [];

  const rng = random(input.seed ?? 20261005);
  const personById = new Map(persons.map((p) => [p.id, p]));
  const firstName = (id: string) => (personById.get(id)?.name ?? "").split(" ")[0];
  const built: Built = { gatherings: [], tasks: [], assignments: [], attendances: [], headcounts: [], messages: [] };

  // An earlier simulation is replaced, so its gatherings neither block a day nor pick the group
  const realGatherings = input.gatherings.filter((g) => !isSimulatedDocument(g.id, {}));
  const takenDays = new Map<string, Set<string>>();
  for (const g of realGatherings) {
    const key = isGroupGathering(g) ? g.groupId : isWorshipService(g) ? "gudstjeneste" : "arrangement";
    const set = takenDays.get(key) ?? new Set<string>();
    set.add(dayKey(new Date(g.startsAt).getTime()));
    takenDays.set(key, set);
  }
  const isTaken = (key: string, dayMs: number) => takenDays.get(key)?.has(dayKey(dayMs)) ?? false;

  // The group that usually answers for the services, or else the first service team
  const serviceGroupCounts = new Map<string, number>();
  for (const g of realGatherings) {
    if (isWorshipService(g)) serviceGroupCounts.set(g.groupId, (serviceGroupCounts.get(g.groupId) ?? 0) + 1);
  }
  const groupIds = new Set(groups.map((g) => g.id));
  const serviceGroupId =
    [...serviceGroupCounts.entries()].filter(([id]) => groupIds.has(id)).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    groups.find((g) => g.category === "tjenestegruppe")?.id ??
    groups[0].id;

  // The roles a Sunday usually needs, as far as the role library has them. Without any of
  // them, the first roles that have a team are used instead.
  const byName = new Map(input.volunteerRoles.map((role) => [role.name.toLowerCase(), role]));
  const sundayRoles = SUNDAY_ROLE_NAMES.map((name) => byName.get(name.toLowerCase())).filter(
    (role): role is VolunteerRole => role !== undefined
  );
  const serviceRoles =
    sundayRoles.length > 0
      ? sundayRoles
      : input.volunteerRoles
          .filter((role) => role.groupId && groupIds.has(role.groupId))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "nb"))
          .slice(0, 5);

  // Who can take a role: its team; a role without a team (møteleder, taler) is taken by the
  // leaders and the staff, and a sermon by a pastor where there is one. People who lead and
  // also sit on a team are the ones who end up with two tasks on the same Sunday.
  const leaders = [
    ...new Set([
      ...groups.flatMap((g) => [...g.leaderIds, ...(g.deputyLeaderIds ?? [])]),
      ...persons.filter((p) => p.isStaff).map((p) => p.id),
    ]),
  ].filter((id) => personById.has(id));
  const pastors = persons.filter((p) => p.staffCategory === "pastor").map((p) => p.id);
  const poolOf = (role: VolunteerRole): string[] => {
    const group = role.groupId ? groups.find((g) => g.id === role.groupId) : undefined;
    if (group) return allGroupPersonIds(group);
    if (role.name.toLowerCase() === "taler" && pastors.length > 0) return pastors;
    return leaders.length > 0 ? leaders : persons.map((p) => p.id);
  };
  // Each team has someone who says yes more often than the others
  const turnByRole = new Map<string, number>();

  // 1. Sunday services, counted and staffed
  const sundays = lastWeekdays(now, 0, weeks);
  sundays.forEach((day, index) => {
    if (isTaken("gudstjeneste", day)) return;
    const startsAt = atLocalTime(day, "11:00");
    const date = new Date(startsAt);
    const id = `${SIMULATION_PREFIX}gathering-${dayKey(day)}`;
    const title = SERVICE_TITLES[index % SERVICE_TITLES.length];
    const cancelled = date.getMonth() === 6 && rng.chance(0.25);
    built.gatherings.push({
      id,
      groupId: serviceGroupId,
      title,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(startsAt + 2 * HOUR_MS).toISOString(),
      type: "arrangement",
      ...visibilityFields("offentlig"),
      isGudstjeneste: true,
      cancelled,
    });
    if (cancelled) return;

    // Attendance: a slow growth over the period, the season, and some noise.
    // The latest Sunday and about one in ten others have not been counted yet.
    const isLatest = index === sundays.length - 1;
    if (!isLatest && !rng.chance(0.1)) {
      const growth = 1 + (index / Math.max(1, sundays.length)) * 0.08;
      const season = seasonOf(date.getMonth());
      const family = title === "Familiegudstjeneste" ? 1.15 : 1;
      const noise = 0.9 + rng.next() * 0.2;
      const adults = Math.round(76 * growth * season * noise);
      const children = Math.round(19 * growth * season * (family > 1 ? 1.6 : 1) * (0.85 + rng.next() * 0.3));
      built.headcounts.push({
        id: headcountIdFor(id),
        gatheringId: id,
        adults,
        children,
        registeredAt: new Date(startsAt + rng.between(2, 30) * HOUR_MS).toISOString(),
        registeredBy: groups.find((g) => g.id === serviceGroupId)?.leaderIds[0],
      });
    }

    serviceRoles.forEach((role, roleIndex) => {
      const team = poolOf(role);
      const taskId = `${SIMULATION_PREFIX}task-${dayKey(day)}-${roleIndex}`;
      const task: Task = {
        id: taskId,
        gatheringId: id,
        groupId: role.groupId && groupIds.has(role.groupId) ? role.groupId : undefined,
        volunteerRoleId: role.id,
        title: role.name,
        status: "open",
        // A role without a team (møteleder, taler) is one person; a team role sometimes needs two
        neededCount: role.groupId && rng.chance(0.3) ? 2 : 1,
      };
      const taskAssignments: Assignment[] = [];
      const used = new Set<string>();
      const nextPerson = (): string | undefined => {
        const free = team.filter((personId) => !used.has(personId));
        if (free.length === 0) return undefined;
        const turn = turnByRole.get(role.id) ?? 0;
        turnByRole.set(role.id, turn + 1);
        const chosen = rng.chance(0.4) ? free[0] : free[turn % free.length];
        used.add(chosen);
        return chosen;
      };
      const ask = (
        personId: string,
        response: Assignment["response"],
        daysBefore: number,
        respondedAt: number
      ) => {
        taskAssignments.push({
          id: `${SIMULATION_PREFIX}assign-${dayKey(day)}-${roleIndex}-${taskAssignments.length + 1}`,
          taskId,
          personId,
          response,
          assignedAt: new Date(startsAt - daysBefore * DAY_MS).toISOString(),
          respondedAt: new Date(respondedAt).toISOString(),
        });
      };
      /** Asked `daysBefore` the service, answered `hours` later. */
      const answered = (personId: string, response: Assignment["response"], daysBefore: number, hours: number) =>
        ask(personId, response, daysBefore, startsAt - daysBefore * DAY_MS + hours * HOUR_MS);

      for (let slot = 0; slot < (task.neededCount ?? 1); slot++) {
        const first = nextPerson();
        if (!first) break;
        const roll = rng.next();
        if (roll < 0.8) {
          answered(first, "confirmed", rng.between(6, 14), rng.between(1, 40));
        } else if (roll < 0.9) {
          answered(first, "declined", rng.between(7, 14), rng.between(1, 30));
          const second = nextPerson();
          if (second) answered(second, "confirmed", rng.between(3, 6), rng.between(1, 20));
        } else if (roll < 0.97) {
          // Said yes, then had to pull out; some of it close to the day
          ask(first, "withdrawn", rng.between(8, 14), startsAt - rng.between(10, 120) * HOUR_MS);
          const stand = nextPerson();
          if (stand && rng.chance(0.6)) answered(stand, "confirmed", 1, rng.between(1, 6));
        }
        // Otherwise nobody was found for the slot
      }
      task.status = taskStatusFor(task, taskAssignments);
      built.tasks.push(task);
      built.assignments.push(...taskAssignments);
    });
  });

  // 2. A monthly worship evening, open to all
  const fridays = lastWeekdays(now, 5, weeks);
  const firstFridays = fridays.filter((day) => new Date(day).getDate() <= 7);
  for (const day of firstFridays) {
    if (isTaken("arrangement", day)) continue;
    const startsAt = atLocalTime(day, "19:00");
    const id = `${SIMULATION_PREFIX}gathering-${dayKey(day)}-kveld`;
    built.gatherings.push({
      id,
      groupId: serviceGroupId,
      title: "Lovsangskveld",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(startsAt + 2 * HOUR_MS).toISOString(),
      type: "arrangement",
      ...visibilityFields("offentlig"),
      isGudstjeneste: false,
      cancelled: false,
    });
    if (rng.chance(0.85)) {
      built.headcounts.push({
        id: headcountIdFor(id),
        gatheringId: id,
        adults: Math.round(38 * seasonOf(new Date(day).getMonth()) * (0.85 + rng.next() * 0.3)),
        children: rng.between(0, 4),
        registeredAt: new Date(startsAt + 3 * HOUR_MS).toISOString(),
      });
    }
  }

  // 3. Home groups meet every other week, and the members answer
  for (const group of groups.filter((g) => g.category === "husgruppe")) {
    const members = allGroupPersonIds(group);
    if (members.length === 0) continue;
    const weekday = WEEKDAY_INDEX[(group.meetingSchedule?.weekday ?? "onsdag").toLowerCase()] ?? 3;
    const time = group.meetingSchedule?.time || "19:30";
    lastWeekdays(now, weekday, weeks, 2).forEach((day, index) => {
      if (isTaken(group.id, day)) return;
      const startsAt = atLocalTime(day, time);
      const host = members[index % members.length];
      const id = `${SIMULATION_PREFIX}gathering-${dayKey(day)}-${group.id}`;
      built.gatherings.push({
        id,
        groupId: group.id,
        title: `${group.name} hos ${firstName(host)}`,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(startsAt + 2 * HOUR_MS).toISOString(),
        type: "gruppesamling",
        hostPersonId: host,
        ...visibilityFields("intern"),
        isGudstjeneste: false,
        cancelled: false,
        invitationSent: true,
        invitationSentAt: new Date(startsAt - 7 * DAY_MS).toISOString(),
      });
      for (const personId of members) {
        const roll = rng.next();
        if (roll > 0.82) continue; // did not answer
        built.attendances.push({
          id: `att-${id}-${personId}`,
          gatheringId: id,
          personId,
          status: roll < 0.68 ? "attending" : "declined",
          updatedAt: new Date(startsAt - rng.between(1, 6) * DAY_MS).toISOString(),
        });
      }
    });
  }

  // 4. Messages in the groups. Some groups go quiet in the most recent month.
  const weekStarts = lastWeekdays(now, 1, weeks);
  groups.forEach((group, groupIndex) => {
    const members = allGroupPersonIds(group);
    if (members.length === 0) return;
    const perWeek = group.category === "husgruppe" ? 1.4 : group.category === "tjenestegruppe" ? 0.7 : 0.35;
    const goesQuiet = groupIndex % 4 === 3;
    const texts = MESSAGES[group.category ?? ""] ?? MESSAGES.annen;
    weekStarts.forEach((weekStart, weekIndex) => {
      if (goesQuiet && weekIndex >= weekStarts.length - 6) return;
      const count = Math.floor(perWeek + rng.next());
      for (let n = 0; n < count; n++) {
        const createdAt = weekStart + rng.between(0, 6) * DAY_MS + rng.between(8, 21) * HOUR_MS;
        if (createdAt >= now) continue;
        const senderId = rng.pick(members);
        built.messages.push({
          id: `${SIMULATION_PREFIX}msg-${group.id}-${dayKey(weekStart)}-${n}`,
          groupId: group.id,
          senderPersonId: senderId,
          senderName: personById.get(senderId)?.name ?? "",
          content: rng.pick(texts),
          createdAt: new Date(createdAt).toISOString(),
        });
      }
    });
  });

  const sets: [string, { id: string }[]][] = [
    [COLLECTIONS.GATHERINGS, built.gatherings],
    [COLLECTIONS.TASKS, built.tasks],
    [COLLECTIONS.ASSIGNMENTS, built.assignments],
    [COLLECTIONS.GATHERING_ATTENDANCES, built.attendances],
    [COLLECTIONS.GATHERING_HEADCOUNTS, built.headcounts],
    [COLLECTIONS.GROUP_MESSAGES, built.messages],
  ];
  return sets.flatMap(([collection, items]) => items.map((item) => ({ collection, id: item.id, data: item })));
}
