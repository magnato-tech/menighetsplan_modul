import { defaultSurfaces } from "../../src/utils/surfaces";
import type { AddonsState } from "../../src/context/CmsContext";

/** Fields tests should add when mocking `useCms`, after surfaces were added to the provider. */
export const cmsSurfacesMock = {
  surfaces: defaultSurfaces(),
  surfacesState: "ready" as AddonsState,
  saveSurfaces: async () => true,
};
