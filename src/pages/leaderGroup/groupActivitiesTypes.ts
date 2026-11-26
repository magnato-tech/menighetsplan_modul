import type { useConfirm } from "../../components/ConfirmProvider";
import type { otherLoadsSameDay } from "../../utils/sameDayLoads";
import type { LeaderGroupDetail } from "./leaderGroupDetail";

// Types shared by the parts of GroupActivities

export type GroupGathering = LeaderGroupDetail["groupGatherings"][number];
export type GroupMember = LeaderGroupDetail["members"][number];
export type ConfirmFn = ReturnType<typeof useConfirm>;

// A task the person already has on the same day
export type SameDayLoad = ReturnType<typeof otherLoadsSameDay>[number];
export type SameDayOf = (personId: string, startsAt: string, taskId: string) => SameDayLoad[];

export type StatusFilter = "all" | "red" | "yellow" | "green";
export type ViewMode = "kort" | "tabell";

export type QuickAssignFn = (taskId: string, personId: string, personName: string, response: "confirmed" | "pending") => void;

// What the gathering cards and their task rows need from GroupActivities
export interface GroupActivityActions {
  hasLeaderAccess: boolean;
  members: GroupMember[];
  quickAssignTaskId: string | null;
  onToggleQuickAssign: (taskId: string) => void;
  sameDayOf: SameDayOf;
  sameDayTexts: (loads: SameDayLoad[]) => string[];
  quickAssign: QuickAssignFn;
  canGiveBack: LeaderGroupDetail["canGiveBack"];
  giveTaskBack: LeaderGroupDetail["giveTaskBack"];
  volunteerRoles: LeaderGroupDetail["volunteerRoles"];
  confirm: ConfirmFn;
  showToast: (text: string) => void;
}
