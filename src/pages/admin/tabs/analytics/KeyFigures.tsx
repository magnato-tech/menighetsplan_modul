import React from "react";
import { BarChart3, Gauge, HandHeart, UsersRound } from "lucide-react";
import type { ChurchAnalytics } from "../../../../utils/churchAnalytics";
import { describeChange, formatCount, formatPercent } from "../../../../utils/analyticsFormat";
import { KpiTile } from "./KpiTile";

/** The four key figures at the top of the board. */
export const KeyFigures: React.FC<{ analytics: ChurchAnalytics }> = ({ analytics }) => {
  const { period, attendance, volunteers, groups } = analytics;
  const ahead = period.direction === "ahead";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiTile
        label="Snitt på gudstjeneste"
        value={ahead ? "–" : formatCount(attendance.averageWorship)}
        icon={<BarChart3 className="w-4 h-4" />}
        change={ahead ? null : describeChange(attendance.averageWorship, attendance.previousAverageWorship)}
        previousLabel={period.previousLabel}
      >
        {ahead ? (
          <p>Oppmøte telles når gudstjenestene er holdt</p>
        ) : (
          <p>
            Talt på {attendance.worshipCounted} av {attendance.worship.length} gudstjenester
          </p>
        )}
        {!ahead && attendance.averageWorshipChildren !== null && <p>Herav i snitt {attendance.averageWorshipChildren} barn</p>}
      </KpiTile>
      <KpiTile
        label="Aktive frivillige"
        value={formatCount(volunteers.activeVolunteers)}
        icon={<HandHeart className="w-4 h-4" />}
        change={describeChange(volunteers.activeVolunteers, volunteers.previousActiveVolunteers)}
        previousLabel={period.previousLabel}
      >
        <p>
          {volunteers.shareOfRegister === null
            ? `Ingen oppgaver på ${ahead ? "arrangementene" : "samlingene"} i perioden`
            : `${formatPercent(volunteers.shareOfRegister)} av personregisteret ${ahead ? "har sagt ja til en oppgave" : "har stått på"}`}
        </p>
      </KpiTile>
      <KpiTile
        label="Bemanningsgrad"
        value={formatPercent(volunteers.fillRate)}
        icon={<Gauge className="w-4 h-4" />}
        change={describeChange(volunteers.fillRate, volunteers.previousFillRate, "rate")}
        previousLabel={period.previousLabel}
      >
        <p>
          {volunteers.slotsFilled} av {volunteers.slotsNeeded} plasser bekreftet
        </p>
      </KpiTile>
      <KpiTile label="Med i en gruppe" value={formatPercent(groups.belongingRate)} icon={<UsersRound className="w-4 h-4" />}>
        <p>
          {groups.personsInGroups} personer i minst én gruppe, {groups.withoutGroup.length} uten
        </p>
      </KpiTile>
    </div>
  );
};
