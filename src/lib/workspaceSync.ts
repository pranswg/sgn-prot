import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Json } from '@/lib/database.types'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  diffCollection,
  resolveBatch,
  snapshotCollection,
  snapshotsEqual,
  type CollectionSnapshot,
} from '@/lib/workspaceDiff'
import { resolveHydrationMode, resolveSettingHydration } from '@/lib/workspaceHydration'
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
 * always wins over an upsert of the same id within a batch. A Realtime
 * subscription refreshes from the server when another device writes, and
 * `uploadWorkspaceToServer` lets the user deliberately replace the server copy
 * with this browser's.
 */

export type WorkspaceCollection =
  | 'members'
  | 'trainees'
  | 'suguan-records'
  | 'organista-suguan-records'
  | 'koro-documents'
  | 'assignment-presets'

export type WorkspaceSetting = 'settings' | 'worship-schedules'

export interface WorkspaceSyncStatus {
  ok: boolean
  error?: string
}

export type WorkspaceStatusListener = (status: WorkspaceSyncStatus) => void

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

/** The empty settings document, used to clear a workspace after a factory reset. */
function emptySetting(key: WorkspaceSetting): SettingsDoc | WorshipDoc {
  return key === 'settings'
    ? { serviceTypes: [], dutyRoles: [], voices: [], localeName: '', defaultServiceTypeId: null }
    : { midweek: [], weekend: [] }
}

const collectionPending = new Map<
  WorkspaceCollection,
  { upserts: Map<string, { id: string }>; deletes: Set<string> }
>()
const collectionTimers = new Map<WorkspaceCollection, ReturnType<typeof setTimeout>>()
const settingTimers = new Map<WorkspaceSetting, ReturnType<typeof setTimeout>>()
const unsubscribes: Array<() => void> = []

const collectionSnapshots = new Map<WorkspaceCollection, CollectionSnapshot>()
const settingSnapshots = new Map<WorkspaceSetting, string>()

let collectionBindings: Array<CollectionBinding<{ id: string }>> = []
let settingBindings: Array<SettingBinding<unknown>> = []

let started = false
let applyingRemote = false
let workspaceInitialized = false
let channel: RealtimeChannel | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let statusListener: WorkspaceStatusListener | null = null

function reportOk(): void {
  statusListener?.({ ok: true })
}

function reportError(error: unknown): void {
  console.error('[workspaceSync]', error)
  statusListener?.({ ok: false, error: error instanceof Error ? error.message : String(error) })
}

async function writeRecords(
  collection: WorkspaceCollection,
  upserts: Array<{ id: string }>,
  deletes: string[],
): Promise<void> {
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
}

async function fetchCollection<T extends { id: string }>(
  collection: WorkspaceCollection,
): Promise<T[]> {
  const { error, data } = await getSupabase()
    .from('workspace_records')
    .select('data')
    .eq('collection', collection)
  if (error) throw error
  return (data ?? []).map((row) => row.data as T)
}

async function fetchSetting<T>(key: WorkspaceSetting): Promise<T | null> {
  const { error, data } = await getSupabase()
    .from('workspace_settings')
    .select('data')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  return (data?.data as T) ?? null
}

/**
 * Whether the workspace has ever been initialised. While false the first device
 * may seed empty collections; the marker is flipped true once seeding is done or
 * a workspace already holds data, after which the server always wins.
 */
async function fetchWorkspaceInitialized(): Promise<boolean> {
  const { error, data } = await getSupabase()
    .from('workspace_meta')
    .select('initialized')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data?.initialized ?? false
}

function markWorkspaceInitialized(): void {
  void getSupabase()
    .rpc('mark_workspace_initialized')
    .then(({ error }) => {
      if (error) reportError(error)
    })
}

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
    await writeRecords(collection, upserts, deletes)
    reportOk()
  } catch (error) {
    reportError(error)
  }
}

function scheduleSetting(key: WorkspaceSetting, getValue: () => unknown): void {
  const existing = settingTimers.get(key)
  if (existing) clearTimeout(existing)
  settingTimers.set(
    key,
    setTimeout(() => void flushSetting(key, getValue), FLUSH_DELAY),
  )
}

async function flushSetting(key: WorkspaceSetting, getValue: () => unknown): Promise<void> {
  settingTimers.delete(key)
  try {
    const { error } = await getSupabase()
      .from('workspace_settings')
      .upsert({ key, data: getValue() as Json }, { onConflict: 'key' })
    if (error) throw error
    reportOk()
  } catch (error) {
    reportError(error)
  }
}

function onCollectionStoreChange<T extends { id: string }>(binding: CollectionBinding<T>): void {
  if (applyingRemote) return
  const { diff, snapshot } = diffCollection(
    collectionSnapshots.get(binding.collection) ?? new Map(),
    binding.get(),
  )
  collectionSnapshots.set(binding.collection, snapshot)
  if (diff.upserts.length > 0 || diff.deletes.length > 0) {
    queueDiff(binding.collection, diff)
  }
}

function onSettingStoreChange(binding: SettingBinding<unknown>): void {
  if (applyingRemote) return
  const json = JSON.stringify(binding.get())
  if (json === settingSnapshots.get(binding.key)) return
  settingSnapshots.set(binding.key, json)
  scheduleSetting(binding.key, () => binding.get())
}

function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void refreshFromServer()
  }, FLUSH_DELAY)
}

/**
 * Re-read every collection and setting from the server. If this browser has a
 * queued write in flight, wait for it to flush first so the pull cannot clobber
 * it. Content that already matches is skipped so echo events cause no churn.
 */
async function refreshFromServer(): Promise<void> {
  if (!started || applyingRemote) return
  if (collectionTimers.size > 0 || settingTimers.size > 0) {
    const existing = refreshTimer
    if (existing) clearTimeout(existing)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      void refreshFromServer()
    }, FLUSH_DELAY)
    return
  }

  applyingRemote = true
  try {
    for (const binding of collectionBindings) {
      const rows = await fetchCollection(binding.collection)
      const next = snapshotCollection(rows)
      const changed = !snapshotsEqual(collectionSnapshots.get(binding.collection), next)
      collectionSnapshots.set(binding.collection, next)
      if (changed) binding.set(rows)
    }
    for (const binding of settingBindings) {
      const value = await fetchSetting(binding.key)
      if (value === null && !workspaceInitialized) continue
      const next = value ?? emptySetting(binding.key)
      const json = JSON.stringify(next)
      if (json === settingSnapshots.get(binding.key)) continue
      settingSnapshots.set(binding.key, json)
      binding.set(next)
    }
    reportOk()
  } catch (error) {
    reportError(error)
  } finally {
    applyingRemote = false
  }
}

function startRealtime(): void {
  const client = getSupabase()
  channel = client
    .channel('workspace-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'workspace_records' },
      () => scheduleRefresh(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'workspace_settings' },
      () => scheduleRefresh(),
    )
    .subscribe()
}

/** Replace the server's copy of every collection and setting with this browser's. */
export async function uploadWorkspaceToServer(): Promise<void> {
  if (!isSupabaseConfigured || !started) return
  try {
    for (const binding of collectionBindings) {
      const rows = binding.get()
      const remote = await fetchCollection(binding.collection)
      const localIds = new Set(rows.map((row) => row.id))
      const deletes = remote.filter((row) => !localIds.has(row.id)).map((row) => row.id)
      collectionSnapshots.set(binding.collection, snapshotCollection(rows))
      await writeRecords(binding.collection, rows, deletes)
    }
    for (const binding of settingBindings) {
      const value = binding.get()
      settingSnapshots.set(binding.key, JSON.stringify(value))
      const { error } = await getSupabase()
        .from('workspace_settings')
        .upsert({ key: binding.key, data: value as Json })
      if (error) throw error
    }
    reportOk()
  } catch (error) {
    reportError(error)
    throw error
  }
}

/** Load the workspace from the server, then start mirroring both ways. */
export async function hydrateWorkspace(onStatus?: WorkspaceStatusListener): Promise<void> {
  if (!isSupabaseConfigured || started) return
  started = true
  statusListener = onStatus ?? null

  collectionBindings = [
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
        useOrganistaSuguanStore.setState({ records: records as OrganistaSuguanRecord[] }),
      subscribe: (listener) => useOrganistaSuguanStore.subscribe(listener),
    },
    {
      collection: 'koro-documents',
      get: () => useKoroStore.getState().documents as KoroDocument[],
      set: (documents) => useKoroStore.setState({ documents: documents as KoroDocument[] }),
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

  settingBindings = [
    {
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
      set: (value) => useSettingsStore.setState(value as SettingsDoc),
      subscribe: (listener) => useSettingsStore.subscribe(listener),
    },
    {
      key: 'worship-schedules',
      get: () => ({
        midweek: useWorshipScheduleStore.getState().midweek,
        weekend: useWorshipScheduleStore.getState().weekend,
      }),
      set: (value) => useWorshipScheduleStore.setState(value as WorshipDoc),
      subscribe: (listener) => useWorshipScheduleStore.subscribe(listener),
    },
  ]

  try {
    applyingRemote = true
    let initialized = false
    try {
      initialized = await fetchWorkspaceInitialized()
    } catch (error) {
      reportError(error)
      initialized = false
    }
    workspaceInitialized = initialized

    for (const binding of collectionBindings) {
      const remote = await fetchCollection(binding.collection)
      const local = binding.get()
      if (resolveHydrationMode(remote.length, local.length, initialized) === 'seed') {
        collectionSnapshots.set(binding.collection, snapshotCollection(local))
        await writeRecords(binding.collection, local, [])
      } else {
        collectionSnapshots.set(binding.collection, snapshotCollection(remote))
        binding.set(remote)
      }
    }

    for (const binding of settingBindings) {
      const remote = await fetchSetting(binding.key)
      const mode = resolveSettingHydration(remote !== null, initialized)
      if (mode === 'seed') {
        settingSnapshots.set(binding.key, JSON.stringify(binding.get()))
        const { error } = await getSupabase()
          .from('workspace_settings')
          .upsert({ key: binding.key, data: binding.get() as Json }, { onConflict: 'key' })
        if (error) throw error
      } else if (mode === 'clear') {
        const empty = emptySetting(binding.key)
        settingSnapshots.set(binding.key, JSON.stringify(empty))
        binding.set(empty)
      } else {
        settingSnapshots.set(binding.key, JSON.stringify(remote))
        binding.set(remote)
      }
    }

    if (!initialized) {
      markWorkspaceInitialized()
      workspaceInitialized = true
    }
  } catch (error) {
    applyingRemote = false
    reportError(error)
    throw error
  }
  applyingRemote = false

  for (const binding of collectionBindings) {
    unsubscribes.push(binding.subscribe(() => onCollectionStoreChange(binding)))
  }
  for (const binding of settingBindings) {
    unsubscribes.push(binding.subscribe(() => onSettingStoreChange(binding)))
  }

  startRealtime()
  reportOk()
}

/**
 * Empty every mirrored store without pushing the deletions back to the server.
 * Used by the factory reset after `admin-reset-workspace` has already wiped the
 * server: the local cache would otherwise re-upload itself.
 */
export function clearLocalWorkspace(): void {
  applyingRemote = true
  try {
    useMemberStore.getState().clear()
    useSuguanStore.getState().clear()
    useOrganistaSuguanStore.getState().clear()
    useKoroStore.getState().reset()
    useAssignmentPresetStore.getState().clear()
    useSettingsStore.getState().clear()
    useWorshipScheduleStore.getState().resetToEmpty()

    collectionPending.clear()
    for (const timer of collectionTimers.values()) clearTimeout(timer)
    collectionTimers.clear()
    for (const timer of settingTimers.values()) clearTimeout(timer)
    settingTimers.clear()
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
    collectionSnapshots.clear()
    settingSnapshots.clear()
  } finally {
    applyingRemote = false
  }
}

/** Detach every subscription and timer. Safe to call when not started. */
export function stopWorkspaceSync(): void {
  for (const off of unsubscribes.splice(0)) off()
  collectionBindings = []
  settingBindings = []
  collectionSnapshots.clear()
  settingSnapshots.clear()
  collectionPending.clear()
  for (const timer of collectionTimers.values()) clearTimeout(timer)
  collectionTimers.clear()
  for (const timer of settingTimers.values()) clearTimeout(timer)
  settingTimers.clear()
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  if (channel) {
    void channel.unsubscribe()
    channel = null
  }
  applyingRemote = false
  statusListener = null
  started = false
  workspaceInitialized = false
}
