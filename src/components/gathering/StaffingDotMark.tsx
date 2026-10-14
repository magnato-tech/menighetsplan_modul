import React from "react";
import type { StaffingDot } from "../../utils/staffing";

const LABELS: Record<StaffingDot, string> = {
  red: "Mangler folk",
  yellow: "Ikke fullt bemannet",
};

/** The small dot a group leader sees where their own group lacks people. */
export const StaffingDotMark: React.FC<{ dot: StaffingDot }> = ({ dot }) => (
  <span
    role="img"
    aria-label={LABELS[dot]}
    title={LABELS[dot]}
    className={`inline-block w-2 h-2 rounded-full shrink-0 ${dot === "red" ? "bg-red-500" : "bg-amber-400"}`}
  />
);
