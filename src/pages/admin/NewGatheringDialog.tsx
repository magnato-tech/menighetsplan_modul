import React, { useMemo } from "react";
import { GatheringFormDialog, type GatheringFormChoices } from "../../components/gathering/GatheringFormDialog";
import { useGatheringTemplates } from "../../hooks/useGatheringTemplates";
import { saveGatheringTemplate } from "../../services/gatheringTemplates";
import { useLevel } from "../../hooks/useLevel";
import { parseIsoToDateAndTime } from "../../utils/dates";
import { onDay, type GatheringFormValues } from "../../utils/gatheringForm";
import { createPlannedGathering, planGathering } from "../../utils/gatheringTemplates";
import { newId } from "../../utils/id";
import { hasPlanner } from "../../utils/level";
import type { ShowFeedback, StudioData } from "./studio";

interface NewGatheringDialogProps {
  studio: StudioData;
  showFeedback: ShowFeedback;
  /** What the form starts with: what was written in the quick form, or a template's fields. */
  initial: GatheringFormValues;
  initialTemplateId?: string;
  initialRepeat?: boolean;
  onCreated?: () => void;
  onClose: () => void;
}

/**
 * The form for a new event, as the admin opens it: with the congregation's templates to start
 * from, and with what already stands in the calendar. It stores what the form asks for: one
 * event or a whole series, each with the programme and the tasks of the template.
 */
export const NewGatheringDialog: React.FC<NewGatheringDialogProps> = ({ studio, showFeedback, initial, initialTemplateId, initialRepeat, onCreated, onClose }) => {
  const { adminGatherings, adminGroups, adminVolunteerRoles } = studio;
  const { templates } = useGatheringTemplates();
  const withPlanner = hasPlanner(useLevel());

  const existing = useMemo(
    () => adminGatherings.map(({ gathering }) => ({ day: parseIsoToDateAndTime(gathering.startsAt).date, title: gathering.title })),
    [adminGatherings]
  );

  const handleSave = (values: GatheringFormValues, { templateId, days }: GatheringFormChoices) => {
    const template = templates.find((candidate) => candidate.id === templateId) ?? null;
    const series = days.length > 1 ? days : [values.date];
    // Told apart from other events, and from other series, so the rest of it can be found again
    const seriesId = series.length > 1 ? newId("serie") : undefined;

    let made = 0;
    for (const day of series) {
      const result = createPlannedGathering(studio, planGathering(onDay(values, day), { template, roles: adminVolunteerRoles, withPlanner, seriesId }));
      if (!result.success) {
        return made === 0 ? result : { success: false, error: `${made} av ${series.length} arrangementer ble opprettet. ${result.error || "Resten kunne ikke lagres."}` };
      }
      made++;
    }

    const from = template ? ` fra malen «${template.name}»` : "";
    showFeedback(made === 1 ? `Nytt arrangement opprettet${from} og lagt i kalenderen!` : `${made} arrangementer opprettet${from} og lagt i kalenderen!`);
    onCreated?.();
    return { success: true };
  };

  return (
    <GatheringFormDialog
      isNew
      initial={initial}
      groups={adminGroups.map(({ group }) => group)}
      showGroup={withPlanner}
      templates={templates}
      initialTemplateId={initialTemplateId}
      initialRepeat={initialRepeat}
      existing={existing}
      templateEditor={{
        roles: adminVolunteerRoles,
        withPlanner,
        onSave: async (template) => {
          const saved = await saveGatheringTemplate(template);
          if (saved) showFeedback(`Malen «${template.name}» er lagret`);
          return saved;
        },
      }}
      onSave={handleSave}
      onClose={onClose}
    />
  );
};
