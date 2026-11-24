import React from "react";
import type { MembershipClerkTaskKind } from "../../../types";
import { taskOwnerLabel } from "../../../utils/membershipClerkTasks";

/** The small tag on a task card that says whose hat the task is (see taskOwnerLabel). */
export const TaskOwnerTag: React.FC<{ kind: MembershipClerkTaskKind }> = ({ kind }) => (
  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--studio-row)] border border-[var(--studio-border)] text-[var(--studio-muted)]">
    {taskOwnerLabel(kind)}
  </span>
);
