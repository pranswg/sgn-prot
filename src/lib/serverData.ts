import { getSupabase } from '@/lib/supabase'
import type { Member, Trainee } from '@/core/types/member'
import type { Suguan } from '@/core/types/suguan'
import type { KoroDocument } from '@/core/types/koro'
import type { OrganistaSuguanRecord } from '@/core/types/organistaSuguan'
import type {
  StoredDutyRole,
  StoredServiceType,
  StoredVoice,
} from '@/store/settingsStore'
import type { StoredWorshipSchedule } from '@/store/worshipScheduleStore'
import type { AssignmentPreset } from '@/store/assignmentPresetStore'

/**
 * Server reads for Phase 3. Every domain table stores one store record per row
 * in a `data` jsonb column (see `supabase/migrations/..._0001_schema.sql`), so a
 * read is just "select id, data" and the `data` value round-trips verbatim. The
 * settings table is a single row that folds both the settings store and the
 * worship-schedule store into one document.
 *
 * The network functions live here; applying the result to the Zustand stores is
 * in `serverDataStore.ts`, so this module stays importable by the node test
 * runner without pulling in the persisted stores.
 */

/** A row's JSONB payload. The domain tables all name the column `data`. */
export interface DataRow<T> {
  data: T
}

export interface ServerSettingsData {
  serviceTypes: StoredServiceType[]
  dutyRoles: StoredDutyRole[]
  voices: StoredVoice[]
  localeName: string
  defaultServiceTypeId: string | null
  midweek: StoredWorshipSchedule[]
  weekend: StoredWorshipSchedule[]
}

export interface ServerDataSnapshot {
  members: Member[]
  trainees: Trainee[]
  suguan: Suguan[]
  koro: KoroDocument[]
  organistaSuguan: OrganistaSuguanRecord[]
  /** Per-user presets; RLS already scopes the read to the signed-in owner. */
  presets: AssignmentPreset[]
  /** `null` when no settings row exists yet (leave local defaults untouched). */
  settings: ServerSettingsData | null
}

/** Unwraps the `data` column out of each row, tolerating `null`/`undefined`. */
export function unwrapRows<T>(rows: DataRow<T>[] | null | undefined): T[] {
  return (rows ?? []).map((row) => row.data)
}

/**
 * Splits the single settings document into the fields the two settings-owned
 * stores expect. Returns `null` for a missing row so the caller can leave the
 * persisted defaults in place. A malformed field falls back rather than throwing,
 * matching the importer's forgiving posture.
 */
export function settingsRowToStoreData(
  row: DataRow<unknown> | null | undefined,
): ServerSettingsData | null {
  if (!row || typeof row.data !== 'object' || row.data === null) return null
  const data = row.data as Partial<ServerSettingsData>
  return {
    serviceTypes: Array.isArray(data.serviceTypes) ? data.serviceTypes : [],
    dutyRoles: Array.isArray(data.dutyRoles) ? data.dutyRoles : [],
    voices: Array.isArray(data.voices) ? data.voices : [],
    localeName: typeof data.localeName === 'string' ? data.localeName : '',
    defaultServiceTypeId:
      typeof data.defaultServiceTypeId === 'string'
        ? data.defaultServiceTypeId
        : null,
    midweek: Array.isArray(data.midweek) ? data.midweek : [],
    weekend: Array.isArray(data.weekend) ? data.weekend : [],
  }
}

/** Reads every Phase 3 table. Throws the first PostgREST error it encounters. */
export async function readServerData(): Promise<ServerDataSnapshot> {
  const client = getSupabase()
  const [
    membersRes,
    traineesRes,
    suguansRes,
    koroRes,
    organistaRes,
    presetsRes,
    settingsRes,
  ] = await Promise.all([
    client.from('members').select('id, data').order('updated_at'),
    client.from('trainees').select('id, data').order('updated_at'),
    client.from('suguans').select('id, data').order('updated_at'),
    client.from('koro_documents').select('id, data').order('updated_at'),
    client.from('organista_suguans').select('id, data').order('updated_at'),
    // Newest preset first, matching `savePreset`'s prepend order.
    client
      .from('assignment_presets')
      .select('id, data')
      .order('updated_at', { ascending: false }),
    client.from('settings').select('data').eq('id', 1).maybeSingle(),
  ])

  if (membersRes.error) throw membersRes.error
  if (traineesRes.error) throw traineesRes.error
  if (suguansRes.error) throw suguansRes.error
  if (koroRes.error) throw koroRes.error
  if (organistaRes.error) throw organistaRes.error
  if (presetsRes.error) throw presetsRes.error
  if (settingsRes.error) throw settingsRes.error

  return {
    members: unwrapRows<Member>(membersRes.data as DataRow<Member>[] | null),
    trainees: unwrapRows<Trainee>(traineesRes.data as DataRow<Trainee>[] | null),
    suguan: unwrapRows<Suguan>(suguansRes.data as DataRow<Suguan>[] | null),
    koro: unwrapRows<KoroDocument>(koroRes.data as DataRow<KoroDocument>[] | null),
    organistaSuguan: unwrapRows<OrganistaSuguanRecord>(
      organistaRes.data as DataRow<OrganistaSuguanRecord>[] | null,
    ),
    presets: unwrapRows<AssignmentPreset>(
      presetsRes.data as DataRow<AssignmentPreset>[] | null,
    ),
    settings: settingsRowToStoreData(
      settingsRes.data as DataRow<unknown> | null,
    ),
  }
}
