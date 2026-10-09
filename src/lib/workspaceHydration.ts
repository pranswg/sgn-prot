/**
 * Pure hydration decisions for the workspace sync layer.
 *
 * Kept free of Supabase and React so `node:test` can cover the branch that
 * decides whether a collection is seeded up from the browser or replaced by the
 * server's copy.
 */

export type HydrationMode = 'seed' | 'replace'

/**
 * The server wins on load, with one exception: when a collection is empty on the
 * server and the browser has rows, the browser's rows are pushed up once so the
 * first upgrade does not drop existing local data.
 */
export function resolveHydrationMode(remoteCount: number, localCount: number): HydrationMode {
  return remoteCount === 0 && localCount > 0 ? 'seed' : 'replace'
}
