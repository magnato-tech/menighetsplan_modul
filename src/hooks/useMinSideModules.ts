import { useCms } from "../context/CmsContext";
import { isMinSideModuleOn, type MinSideModuleId } from "../utils/minSideModules";

/** Whether a Min side module is on, including the module it needs (see utils/minSideModules.ts). */
export function useMinSideModules(): { isOn: (id: MinSideModuleId) => boolean } {
  const { minSideModules } = useCms();
  return { isOn: (id) => isMinSideModuleOn(minSideModules, id) };
}
