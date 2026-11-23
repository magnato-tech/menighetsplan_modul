/** Person fields a protokollansvarlig may change in the register (matches firestore.rules). */
export const MEMBERSHIP_CLERK_PERSON_FIELDS = [
  "congregationMember",
  "denominationMember",
  "congregationJoinedAt",
  "denominationJoinedAt",
  "denominationEnrollmentType",
  "denominationGEndedAt",
  "congregationEndedAt",
  "denominationEndedAt",
  "membershipLog",
] as const;