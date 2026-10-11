import { create } from 'zustand'
import { isSupabaseConfigured } from '@/lib/supabase'
import { readServerData, type ServerDataSnapshot } from '@/lib/serverData'
import { applySettingsRow } from '@/lib/settingsSync'
import { useMemberStore } from '@/store/memberStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useOrganistaSuguanStore } from '@/store/organistaSuguanStore'

type ServerDataStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ServerDataState {
  status: ServerDataStatus
  error: string | null
  load: () => Promise<void>
  reset: () => void
}

/**
 * Phase 3 read path: fetch every read-only table once after sign-in, then
 * replace the persisted stores (server wins, empty if empty). The `persist`
 * middleware writes the fetched data back to localStorage, which becomes the
 * offline cache Phase 4/6 build on.
 */
function applyServerData(snapshot: ServerDataSnapshot) {
  // Settings must land first: `suguanStore.importData` reads `allVoices()` from
  // the settings store to normalise each record, so restoring the Suguan list
  // against the previous session's voices would derive the wrong groups.
  if (snapshot.settings) applySettingsRow(snapshot.settings)

  useMemberStore.getState().importData(snapshot.members, snapshot.trainees)
  useSuguanStore.getState().importData(snapshot.suguan)
  useOrganistaSuguanStore.getState().importData(snapshot.organistaSuguan)
}

/**
 * Memoised so React StrictMode's double mount (and any caller) runs the fetch
 * once. `reset` clears it on sign-out so the next sign-in re-fetches.
 */
let loadPromise: Promise<void> | null = null

export const useServerDataStore = create<ServerDataState>()((set) => ({
  status: 'idle',
  error: null,

  load: () => {
    // Without env vars there is no server to read; leave the localStorage data
    // untouched and let the app run exactly as it did before Phase 3.
    if (!isSupabaseConfigured()) {
      set({ status: 'ready', error: null })
      return Promise.resolve()
    }
    loadPromise ??= (async () => {
      set({ status: 'loading', error: null })
      try {
        applyServerData(await readServerData())
        set({ status: 'ready', error: null })
      } catch (cause) {
        console.error('Server data load failed:', cause)
        // Keep whatever is in localStorage and let the user retry; a network
        // failure is not an authoritative empty response.
        set({
          status: 'error',
          error:
            cause instanceof Error
              ? cause.message
              : 'Could not load data from the server.',
        })
        loadPromise = null
      }
    })()
    return loadPromise
  },

  reset: () => {
    loadPromise = null
    set({ status: 'idle', error: null })
  },
}))
