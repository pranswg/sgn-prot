import { create } from 'zustand'
import {
  hydrateWorkspace,
  stopWorkspaceSync,
  uploadWorkspaceToServer,
} from '@/lib/workspaceSync'

/**
 * Tracks the health of the Postgres mirror.
 *
 * The stores stay the synchronous working copy; this store only says whether the
 * workspace has loaded yet and whether the last sync succeeded. The toast reads
 * `error` to offer a retry, and Settings reads `lastSyncedAt` to show freshness.
 */
interface WorkspaceState {
  ready: boolean
  hydrating: boolean
  error: string | null
  lastSyncedAt: number | null
  hydrate: () => Promise<void>
  uploadBrowserData: () => Promise<void>
  reset: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ready: false,
  hydrating: false,
  error: null,
  lastSyncedAt: null,

  hydrate: async () => {
    if (get().hydrating) return
    set({ hydrating: true, error: null })
    try {
      await hydrateWorkspace((status) => {
        if (status.ok) {
          set({ error: null, lastSyncedAt: Date.now() })
        } else {
          set({ error: status.error ?? 'The workspace could not be synced.' })
        }
      })
    } catch (error) {
      // Never strand the app on the splash: the stores still hold their
      // localStorage cache, and the toast offers a retry.
      set({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      set({ ready: true, hydrating: false })
    }
  },

  uploadBrowserData: async () => {
    set({ error: null })
    try {
      await uploadWorkspaceToServer()
      set({ lastSyncedAt: Date.now() })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  },

  reset: () => {
    stopWorkspaceSync()
    set({ ready: false, hydrating: false, error: null, lastSyncedAt: null })
  },
}))
