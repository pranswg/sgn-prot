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

/**
 * The OIC ranking. A Suguan stores its chosen OIC under this exact id
 * (`dutyRoleId: 'oic'`), and the printed sheets suffix that member's row with
 * ` - OIC` when it matches.
 */
export const OIC_DUTY_ROLE_ID = 'oic'

/**
 * The configured duty role that represents the OIC ranking.
 *
 * The canonical `'oic'` id is preferred, because that is what the stored
 * `dutyRoleId` and the sheet renderers key on. Duty roles created in Settings
 * carry a generated id, though, so a role the user simply named "OIC" is
 * accepted as well.
 */
export function resolveOicDutyRole<T extends { id: string; name: string }>(
  roles: readonly T[],
): T | undefined {
  return (
    roles.find((role) => role.id === OIC_DUTY_ROLE_ID) ??
    roles.find((role) => role.name.trim().toLowerCase() === OIC_DUTY_ROLE_ID)
  )
}