import { create } from 'zustand'
import { hydrateWorkspace, stopWorkspaceSync } from '@/lib/workspaceSync'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * Owns the one-time workspace hydration after sign-in.
 *
 * The data stores keep their synchronous APIs; this store just tracks whether
 * the server contents have been loaded and the mirror is live. `App` holds the
 * shell back until `ready`, the same way it waits on `authStore.ready`.
 */
interface WorkspaceState {
  ready: boolean
  hydrating: boolean
  error: string | null
  hydrate: () => Promise<void>
  reset: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  ready: false,
  hydrating: false,
  error: null,

  hydrate: async () => {
    if (get().hydrating || get().ready) return
    if (!isSupabaseConfigured) {
      set({ ready: true })
      return
    }
    set({ hydrating: true, error: null })
    try {
      await hydrateWorkspace()
      set({ ready: true, hydrating: false })
    } catch (cause) {
      // Never strand the app on the splash; the stores fall back to their
      // local cache and a later reload can retry.
      console.error('Could not hydrate the workspace:', cause)
      set({ ready: true, hydrating: false, error: String(cause) })
    }
  },

  reset: () => {
    stopWorkspaceSync()
    set({ ready: false, hydrating: false, error: null })
  },
}))
