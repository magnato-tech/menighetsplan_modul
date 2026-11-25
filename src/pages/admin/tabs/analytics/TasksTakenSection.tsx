import React from "react";
import { ListChecks } from "lucide-react";
import type { TasksTakenSummary } from "../../../../utils/churchAnalytics";
import { AnalyticsSection, MiniStat } from "./AnalyticsSection";

interface TasksTakenSectionProps {
  tasksTaken: TasksTakenSummary;
  onOpenFollowUp: () => void;
  onHide?: () => void;
}

/**
 * Tasks people have said yes to, counted from now and back, and the open slots in the coming
 * four weeks. The figures do not follow the period chosen on the board.
 */
export const TasksTakenSection: React.FC<TasksTakenSectionProps> = ({ tasksTaken, onOpenFollowUp, onHide }) => (
  <AnalyticsSection
    id="oppgaver-tatt"
    title="Oppgaver tatt"
    description="Oppgaver noen har sagt ja til, talt fra nå og bakover. Det telles likt om personen tok oppgaven selv, svarte ja på en forespørsel eller ble satt opp av en leder. Den som har meldt forfall etterpå, telles ikke."
    icon={<ListChecks className="w-5 h-5" />}
    onHide={onHide}
  >
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MiniStat label="Siste døgn" value={String(tasksTaken.lastDay)} />
      <MiniStat label="Siste 7 dager" value={String(tasksTaken.lastWeek)} />
      <MiniStat label="Siste 30 dager" value={String(tasksTaken.lastMonth)} />
      <MiniStat label="Ledige plasser neste 4 uker" value={String(tasksTaken.openSlotsNext4Weeks)}>
        {tasksTaken.openSlotsNext4Weeks > 0 && (
          <button
            type="button"
            onClick={onOpenFollowUp}
            className="font-bold text-[var(--studio-link)] hover:text-[var(--studio-link-hover)] cursor-pointer"
          >
            Se dem i Trenger oppfølging
          </button>
        )}
      </MiniStat>
    </div>
  </AnalyticsSection>
);
