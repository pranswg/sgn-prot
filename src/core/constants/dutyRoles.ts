/** Case- and punctuation-insensitive key for comparing role names. */
export function normalizeRoleName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * The configured duty role whose name matches, ignoring case, spacing and
 * punctuation. Duty roles created in Settings carry a generated id, so a name
 * is the stable way to find the one that plays a known part.
 */
export function findDutyRoleByName<T extends { name: string }>(
  roles: readonly T[],
  name: string,
): T | undefined {
  const key = normalizeRoleName(name)
  if (!key) return undefined
  return roles.find((role) => normalizeRoleName(role.name) === key)
}

/**
 * The key a Suguan stores its OIC assignment under (`dutyRoleId`). It
 * identifies the OIC slot on a saved record and the ` - OIC` suffix the sheet
 * prints; it is not a configured role id. The configured OIC role is whichever
 * the administrator named "OIC".
 */
export const OIC_DUTY_ROLE_ID = 'oic'

/** Name a configured role must carry to be treated as the OIC ranking. */
export const OIC_DUTY_ROLE_NAME = 'OIC'

/** The configured duty role that represents the OIC ranking, matched by name. */
export function resolveOicDutyRole<T extends { id: string; name: string }>(
  roles: readonly T[],
): T | undefined {
  return findDutyRoleByName(roles, OIC_DUTY_ROLE_NAME)
}

/**
 * Name a configured role must carry to be treated as the Pangulong Mang-aawit
 * ranking, which the printed signatures draw on.
 */
export const PM_DUTY_ROLE_NAME = 'Pangulong Mang-aawit'

/** The configured duty role that represents the Pangulong Mang-aawit ranking. */
export function resolvePmDutyRole<T extends { id: string; name: string }>(
  roles: readonly T[],
): T | undefined {
  return findDutyRoleByName(roles, PM_DUTY_ROLE_NAME)
}

/**
 * Name a configured role must carry to be treated as the Organista ranking.
 * The Organist Suguan pickers and the Extra Occasion organista slots read it,
 * so a member the administrator ranked as Organista is available there even
 * when their membership category is plain "Mang-aawit".
 */
export const ORGANISTA_DUTY_ROLE_NAME = 'Organista'

/** The configured duty role that represents the Organista ranking. */
export function resolveOrganistaDutyRole<
  T extends { id: string; name: string },
>(roles: readonly T[]): T | undefined {
  return findDutyRoleByName(roles, ORGANISTA_DUTY_ROLE_NAME)
}
