import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import { diffCollection, resolveBatch, type CollectionSnapshot } from '@/lib/workspaceDiff'
import type { Member, Trainee } from '@/core/types/member'
import type { Suguan } from '@/core/types/suguan'
import type { OrganistaSuguanRecord } from '@/core/types/organistaSuguan'
import type { KoroDocument } from '@/core/types/koro'
import { useMemberStore } from '@/store/memberStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useOrganistaSuguanStore } from '@/store/organistaSuguanStore'
import { useKoroStore } from '@/store/koroStore'
import { useAssignmentPresetStore, type AssignmentPreset } from '@/store/assignmentPresetStore'
import {
  useSettingsStore,
  type StoredDutyRole,
  type StoredServiceType,
  type StoredVoice,
} from '@/store/settingsStore'
import {
  useWorshipScheduleStore,
  type StoredWorshipSchedule,
} from '@/store/worshipScheduleStore'

/**
 * Mirrors the data stores to and from Postgres.
 *
 * The stores stay the synchronous working copy (and keep their localStorage
 * cache), so no UI call site has to become async. After sign-in the server is
 * the source of truth: its rows replace the store contents. When the workspace
 * has no rows for a collection yet and the browser does, the browser's data is
 * pushed up once, which is how existing local data moves into the cloud.
 *
 * Writes are coalesced per collection and pushed as a small diff. A delete
 * always wins over an upsert of the same id within a batch.
 */

export type WorkspaceCollection =
  | 'members'
  | 'trainees'
  | 'suguan-records'
  | 'organista-suguan-records'
  | 'koro-documents'
  | 'assignment-presets'

export type WorkspaceSetting = 'settings' | 'worship-schedules'

/** Debounce window for pushing a batch of changes, in milliseconds. */
const FLUSH_DELAY = 350

interface CollectionBinding<T extends { id: string }> {
  collection: WorkspaceCollection
  get: () => T[]
  set: (records: T[]) => void
  subscribe: (listener: () => void) => () => void
}

interface SettingBinding<T> {
  key: WorkspaceSetting
  get: () => T
  set: (value: T) => void
  subscribe: (listener: () => void) => () => void
}

interface SettingsDoc {
  serviceTypes: StoredServiceType[]
  dutyRoles: StoredDutyRole[]
  voices: StoredVoice[]
  localeName: string
  defaultServiceTypeId: string | null
}

interface WorshipDoc {
  midweek: StoredWorshipSchedule[]
  weekend: StoredWorshipSchedule[]
}

const collectionPending = new Map<
  WorkspaceCollection,
  { upserts: Map<string, { id: string }>; deletes: Set<string> }
>()
const collectionTimers = new Map<WorkspaceCollection, ReturnType<typeof setTimeout>>()
const settingTimers = new Map<WorkspaceSetting, ReturnType<typeof setTimeout>>()
const unsubscribes: Array<() => void> = []

let started = false

function scheduleCollection(collection: WorkspaceCollection): void {
  const existing = collectionTimers.get(collection)
  if (existing) clearTimeout(existing)
  collectionTimers.set(
    collection,
    setTimeout(() => void flushCollection(collection), FLUSH_DELAY),
  )
}

function queueDiff<T extends { id: string }>(
  collection: WorkspaceCollection,
  diff: { upserts: T[]; deletes: string[] },
): void {
  let batch = collectionPending.get(collection)
  if (!batch) {
    batch = { upserts: new Map(), deletes: new Set() }
    collectionPending.set(collection, batch)
  }
  for (const record of diff.upserts) {
    batch.upserts.set(record.id, record)
    batch.deletes.delete(record.id)
  }
  for (const id of diff.deletes) {
    batch.upserts.delete(id)
    batch.deletes.add(id)
  }
  scheduleCollection(collection)
}

async function flushCollection(collection: WorkspaceCollection): Promise<void> {
  collectionTimers.delete(collection)
  const batch = collectionPending.get(collection)
  if (!batch) return
  collectionPending.delete(collection)

  const { upserts, deletes } = resolveBatch(batch.upserts, batch.deletes)
  if (upserts.length === 0 && deletes.length === 0) return
  try {
    if (deletes.length > 0) {
      const { error } = await getSupabase()
        .from('workspace_records')
        .delete()
        .eq('collection', collection)
        .in('id', deletes)
      if (error) throw error
    }
    if (upserts.length > 0) {
      const rows = upserts.map((record) => ({
        id: record.id,
        collection,
        data: record as unknown as Json,
      }))
      const { error } = await getSupabase()
        .from('workspace_records')
        .upsert(rows, { onConflict: 'id' })
      if (error) throw error
    }
  } catch (cause) {
    console.error(`Could not sync ${collection}:`, cause)
  }
}

async function fetchCollection<T extends { id: string }>(
  collection: WorkspaceCollection,
): Promise<T[]> {
  const { data, error } = await getSupabase()
    .from('workspace_records')
    .select('data')
    .eq('collection', collection)
  if (error) throw error
  return (data ?? []).map((row) => row.data as unknown as T)
}

async function startCollection<T extends { id: string }>(
  binding: CollectionBinding<T>,
): Promise<void> {
  const remote = await fetchCollection<T>(binding.collection)
  const local = binding.get()
  const shouldSeed = remote.length === 0 && local.length > 0
  const initial = shouldSeed ? local : remote

  binding.set(initial)
  if (shouldSeed) {
    const rows = initial.map((record) => ({
      id: record.id,
      collection: binding.collection,
      data: record as unknown as Json,
    }))
    const { error } = await getSupabase()
      .from('workspace_records')
      .upsert(rows, { onConflict: 'id' })
    if (error) {
      console.error(`Could not seed ${binding.collection}:`, error)
      return
    }
  }

  let snapshot: CollectionSnapshot = new Map(
    initial.map((record) => [record.id, JSON.stringify(record)]),
  )
  const unsubscribe = binding.subscribe(() => {
    const { diff, snapshot: next } = diffCollection(snapshot, binding.get())
    snapshot = next
    if (diff.upserts.length > 0 || diff.deletes.length > 0) {
      queueDiff(binding.collection, diff)
    }
  })
  unsubscribes.push(unsubscribe)
}

async function fetchSetting<T>(key: WorkspaceSetting): Promise<T | null> {
  const { data, error } = await getSupabase()
    .from('workspace_settings')
    .select('data')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  return (data?.data as unknown as T) ?? null
}

function scheduleSetting<T>(key: WorkspaceSetting, binding: SettingBinding<T>): void {
  const existing = settingTimers.get(key)
  if (existing) clearTimeout(existing)
  settingTimers.set(
    key,
    setTimeout(async () => {
      settingTimers.delete(key)
      try {
        const { error } = await getSupabase()
          .from('workspace_settings')
          .upsert(
            { key, data: binding.get() as unknown as Json },
            { onConflict: 'key' },
          )
        if (error) throw error
      } catch (cause) {
        console.error(`Could not sync settings "${key}":`, cause)
      }
    }, FLUSH_DELAY),
  )
}

async function startSetting<T>(binding: SettingBinding<T>): Promise<void> {
  const remote = await fetchSetting<T>(binding.key)
  const value = remote ?? binding.get()
  binding.set(value)

  if (remote === null) {
    const { error } = await getSupabase()
      .from('workspace_settings')
      .upsert({ key: binding.key, data: value as unknown as Json }, { onConflict: 'key' })
    if (error) {
      console.error(`Could not seed settings "${binding.key}":`, error)
      return
    }
  }

  let serialized = JSON.stringify(value)
  const unsubscribe = binding.subscribe(() => {
    const next = JSON.stringify(binding.get())
    if (next === serialized) return
    serialized = next
    scheduleSetting(binding.key, binding)
  })
  unsubscribes.push(unsubscribe)
}

/** Load every collection and setting from the server, then start mirroring. */
export async function hydrateWorkspace(): Promise<void> {
  if (!isSupabaseConfigured || started) return
  started = true

  const collections: Array<CollectionBinding<{ id: string }>> = [
    {
      collection: 'members',
      get: () => useMemberStore.getState().members as Member[],
      set: (members) => useMemberStore.setState({ members: members as Member[] }),
      subscribe: (listener) => useMemberStore.subscribe(listener),
    },
    {
      collection: 'trainees',
      get: () => useMemberStore.getState().trainees as Trainee[],
      set: (trainees) => useMemberStore.setState({ trainees: trainees as Trainee[] }),
      subscribe: (listener) => useMemberStore.subscribe(listener),
    },
    {
      collection: 'suguan-records',
      get: () => useSuguanStore.getState().suguan as Suguan[],
      set: (suguan) => useSuguanStore.setState({ suguan: suguan as Suguan[] }),
      subscribe: (listener) => useSuguanStore.subscribe(listener),
    },
    {
      collection: 'organista-suguan-records',
      get: () => useOrganistaSuguanStore.getState().records as OrganistaSuguanRecord[],
      set: (records) =>
        useOrganistaSuguanStore.setState({
          records: records as OrganistaSuguanRecord[],
        }),
      subscribe: (listener) => useOrganistaSuguanStore.subscribe(listener),
    },
    {
      collection: 'koro-documents',
      get: () => useKoroStore.getState().documents as KoroDocument[],
      set: (documents) => {
        const state = useKoroStore.getState()
        const activeDocumentId = documents.some((doc) => doc.id === state.activeDocumentId)
          ? state.activeDocumentId
          : (documents[0]?.id ?? state.activeDocumentId)
        useKoroStore.setState({ documents: documents as KoroDocument[], activeDocumentId })
      },
      subscribe: (listener) => useKoroStore.subscribe(listener),
    },
    {
      collection: 'assignment-presets',
      get: () => useAssignmentPresetStore.getState().presets as AssignmentPreset[],
      set: (presets) =>
        useAssignmentPresetStore.setState({ presets: presets as AssignmentPreset[] }),
      subscribe: (listener) => useAssignmentPresetStore.subscribe(listener),
    },
  ]

  const settingsBinding: SettingBinding<SettingsDoc> = {
    key: 'settings',
    get: () => {
      const state = useSettingsStore.getState()
      return {
        serviceTypes: state.serviceTypes,
        dutyRoles: state.dutyRoles,
        voices: state.voices,
        localeName: state.localeName,
        defaultServiceTypeId: state.defaultServiceTypeId,
      }
    },
    set: (value) => useSettingsStore.setState(value),
    subscribe: (listener) => useSettingsStore.subscribe(listener),
  }

  const worshipBinding: SettingBinding<WorshipDoc> = {
    key: 'worship-schedules',
    get: () => {
      const state = useWorshipScheduleStore.getState()
      return { midweek: state.midweek, weekend: state.weekend }
    },
    set: (value) => useWorshipScheduleStore.setState(value),
    subscribe: (listener) => useWorshipScheduleStore.subscribe(listener),
  }

  const results = await Promise.allSettled([
    ...collections.map((binding) => startCollection(binding)),
    startSetting(settingsBinding),
    startSetting(worshipBinding),
  ])
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Workspace hydration step failed:', result.reason)
    }
  }
}

/** Detach every mirror, used on sign-out. Safe to call when never started. */
export function stopWorkspaceSync(): void {
  for (const unsubscribe of unsubscribes.splice(0)) unsubscribe()
  for (const timer of collectionTimers.values()) clearTimeout(timer)
  for (const timer of settingTimers.values()) clearTimeout(timer)
  collectionTimers.clear()
  settingTimers.clear()
  collectionPending.clear()
  started = false
}
