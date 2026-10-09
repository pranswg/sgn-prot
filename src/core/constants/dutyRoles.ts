export const REGULAR_WORSHIP_DUTY_ROLES = [
  'oic',
  'organista',
  'organista-reserve',
]

/**
 * Duty roles the Choir Suguan builder never assigns: the printed sheet has no
 * organista slot, and organist duties belong to the Organist Suguan feature.
 * Hidden from the Special Duties panel and stripped from builder drafts.
 */
export const CHOIR_SUGUAN_EXCLUDED_DUTY_ROLE_IDS = new Set([
  'organista',
  'organista-reserve',
])