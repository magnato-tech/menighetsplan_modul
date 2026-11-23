/** Fields protokollansvarlig may change on a membership application (see firestore.rules). */
export const MEMBERSHIP_APPLICATION_CLERK_FIELDS = [
  "status",
  "receivedAt",
  "receivedBy",
  "cornerstoneAt",
  "cornerstoneBy",
  "completedAt",
  "completedBy",
  "dismissedAt",
  "dismissedBy",
  "transitionGEndedAt",
  "transitionAStartedAt",
] as const;