import { useEffect, useState } from "react";
import { subscribeGatheringTemplates } from "../services/gatheringTemplates";
import type { GatheringTemplate } from "../utils/gatheringTemplates";

/**
 * The congregation's templates for events, sorted by name, and whether they have arrived. They
 * are read where they are used (the admin), not by every page.
 */
export function useGatheringTemplates(): { templates: GatheringTemplate[]; ready: boolean } {
  const [templates, setTemplates] = useState<GatheringTemplate[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(
    () =>
      subscribeGatheringTemplates((list) => {
        setTemplates(list);
        setReady(true);
      }),
    []
  );

  return { templates, ready };
}
