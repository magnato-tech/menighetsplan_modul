import React from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Info } from "lucide-react";
import type { CoverageNote } from "../../../../utils/churchAnalytics";
import { AnalyticsSection } from "./AnalyticsSection";
import { useOperatingMode } from "../../../../hooks/useOperatingMode";

interface CoverageSectionProps {
  coverage: CoverageNote[];
  /** Opens Database og Testdata, where a history can be simulated. */
  onOpenDatabase: () => void;
  onHide?: () => void;
}

const STATUS = {
  ok: { icon: CheckCircle2, label: "Godt grunnlag", className: "text-[var(--studio-good)]" },
  partial: { icon: AlertTriangle, label: "Delvis grunnlag", className: "text-[var(--studio-warn)]" },
  missing: { icon: CircleDashed, label: "Ikke målt", className: "text-[var(--studio-muted)]" },
} as const;

/** What the numbers on the board rest on, and what is not measured at all. */
export const CoverageSection: React.FC<CoverageSectionProps> = ({ coverage, onOpenDatabase, onHide }) => {
  // The hint to simulate a history is for a demo only; in production it would invite made-up data
  const inDemo = useOperatingMode() === "demo";
  return (
  <AnalyticsSection
    id="analyse-datagrunnlag"
    title="Datagrunnlag"
    description="Tallene over er talt fra det som er registrert. Det som ikke er registrert, er ikke anslått."
    icon={<Info className="w-5 h-5" />}
    onHide={onHide}
  >
    <ul className="space-y-2">
      {coverage.map((note) => {
        const status = STATUS[note.status];
        const Icon = status.icon;
        return (
          <li key={note.id} className="flex items-start gap-2 text-xs">
            <Icon className={`w-4 h-4 shrink-0 mt-px ${status.className}`} aria-hidden="true" />
            <span>
              <span className={`font-bold ${status.className}`}>{status.label}:</span>{" "}
              <span className="text-[var(--studio-text)]">{note.text}</span>
            </span>
          </li>
        );
      })}
    </ul>
    {inDemo && (
    <p className="text-[11px] text-[var(--studio-muted)]">
      Vil du se hvordan bordet ser ut med mer historikk? Under{" "}
      <button type="button" onClick={onOpenDatabase} className="font-bold text-[var(--studio-link)] hover:text-[var(--studio-link-hover)] cursor-pointer">
        Database og Testdata
      </button>{" "}
      kan du fylle databasen med et simulert halvår med menighetsliv.
    </p>
    )}
  </AnalyticsSection>
  );
};
