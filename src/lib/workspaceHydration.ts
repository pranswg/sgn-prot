/**
 * Pure hydration decisions for the workspace sync layer.
 *
 * Kept free of Supabase and React so `node:test` can cover the branch that
 * decides whether a collection is seeded up from the browser or replaced by the
 * server's copy.
 *
 * `initialized` is the workspace-wide marker from `workspace_meta`. While it is
 * false the first device may seed empty collections from its local cache; once
 * it is true (a live workspace, or after a factory reset) the server always
 * wins, so a stale device cannot push wiped data back.
 */

export type HydrationMode = 'seed' | 'replace'

/**
 * The server wins on load, with one exception: before the workspace is
 * initialised, a collection that is empty on the server but populated in the
 * browser is pushed up once so the first upgrade does not drop local data.
 */
export function resolveHydrationMode(
  remoteCount: number,
  localCount: number,
  initialized: boolean,
): HydrationMode {
  if (initialized) return 'replace'
  return remoteCount === 0 && localCount > 0 ? 'seed' : 'replace'
}

export type SettingHydrationMode = 'seed' | 'replace' | 'clear'

/**
 * Settings are a singleton document, so "empty on the server" is a missing row.
 * Before initialisation a missing row is seeded from the browser; afterwards it
 * means the workspace was reset, so the local settings are cleared to empty
 * rather than uploaded.
 */
export function resolveSettingHydration(
  remoteExists: boolean,
  initialized: boolean,
): SettingHydrationMode {
  if (remoteExists) return 'replace'
  return initialized ? 'clear' : 'seed'
}
