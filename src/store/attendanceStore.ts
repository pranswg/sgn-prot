import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { compareDateKeys, type DateKey } from '@/lib/phDate'
import type { SuguanDocFormat } from '@/core/types/suguan'
import { deleteAllRows, deleteRow, upsertRow } from '@/api/db'
import { persist as persistWrite } from '@/lib/writeThrough'
import { useAuthStore } from '@/store/authStore'

export interface AttendanceSheet {
  id: string
  choir: 'aws' | 'pnk'
  title: string
  dates: DateKey[]
  groupByVoice: boolean
  voiceIds: string[]
  includeNagsasanayMen: boolean
  includeNagsasanayWomen: boolean
  separateChoirs: boolean
  lastNameFirst: boolean
  docFormat: SuguanDocFormat
  pangulongName: string
  /** Person key (`member:${id}`) -> attendance dates marked present. */
  present: Record<string, DateKey[]>
  createdAt: string
  updatedAt: string
  createdBy: string
  lastExportedAt?: string
}

export interface AttendanceSheetInput {
  choir: 'aws' | 'pnk'
  title: string
  dates: DateKey[]
  groupByVoice: boolean
  selectedVoiceIds: string[]
  includeNagsasanayMen: boolean
  includeNagsasanayWomen: boolean
  separateChoirs: boolean
  lastNameFirst: boolean
  docFormat: SuguanDocFormat
  pangulongName: string
}

interface AttendanceState {
  sheets: AttendanceSheet[]
  createSheet: (input: AttendanceSheetInput) => AttendanceSheet | null
  getSheet: (id: string) => AttendanceSheet | undefined
  setPresent: (sheetId: string, personKey: string, dateKey: DateKey, present: boolean) => void
  updatePresent: (sheetId: string, present: Record<string, DateKey[]>) => void
  markExported: (id: string) => void
  deleteSheet: (id: string) => void
  importData: (sheets: AttendanceSheet[]) => void
  restoreData: (sheets: AttendanceSheet[]) => void
  clear: () => void
}

function currentAccountName(): string {
  return useAuthStore.getState().currentAccount()?.fullName ?? ''
}

function writeSheet(
  set: (partial: Partial<Pick<AttendanceState, 'sheets'>>) => void,
  previous: AttendanceSheet[],
  sheet: AttendanceSheet,
  failure: string,
) {
  persistWrite({
    write: upsertRow('attendance_sheets', sheet.id, sheet),
    rollback: () => set({ sheets: previous }),
    failure,
  })
}

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set, get) => ({
      sheets: [],

      createSheet: (input) => {
        if (!input.title.trim()) return null
        if (input.dates.length === 0) return null
        const now = new Date().toISOString()
        const sheet: AttendanceSheet = {
          id: nanoid(),
          choir: input.choir,
          title: input.title.trim(),
          dates: [...new Set(input.dates)].sort(compareDateKeys),
          groupByVoice: input.groupByVoice,
          voiceIds: input.groupByVoice ? [...input.selectedVoiceIds] : [],
          includeNagsasanayMen: input.includeNagsasanayMen,
          includeNagsasanayWomen: input.includeNagsasanayWomen,
          separateChoirs: input.separateChoirs,
          lastNameFirst: input.lastNameFirst,
          docFormat: input.docFormat,
          pangulongName: input.pangulongName,
          present: {},
          createdAt: now,
          updatedAt: now,
          createdBy: currentAccountName(),
        }
        const previous = get().sheets
        set((s) => ({ sheets: [...s.sheets, sheet].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
        writeSheet(set, previous, sheet, 'Could not create the attendance sheet. It was not saved.')
        return sheet
      },

      getSheet: (id) => get().sheets.find((sheet) => sheet.id === id),

      setPresent: (sheetId, personKey, dateKey, present) => {
        const previous = get().sheets
        const existing = previous.find((sheet) => sheet.id === sheetId)
        if (!existing) return
        const nextPresent = { ...existing.present }
        const marked = [...(nextPresent[personKey] ?? [])]
        if (present) {
          if (!marked.includes(dateKey)) marked.push(dateKey)
        } else {
          const index = marked.indexOf(dateKey)
          if (index !== -1) marked.splice(index, 1)
        }
        if (marked.length === 0) delete nextPresent[personKey]
        else nextPresent[personKey] = marked.sort(compareDateKeys)
        const next: AttendanceSheet = {
          ...existing,
          present: nextPresent,
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({
          sheets: s.sheets.map((sheet) => (sheet.id === sheetId ? next : sheet)),
        }))
        writeSheet(set, previous, next, 'Could not save the attendance. It was reverted.')
      },

      updatePresent: (sheetId, present) => {
        const previous = get().sheets
        const existing = previous.find((sheet) => sheet.id === sheetId)
        if (!existing) return
        const next: AttendanceSheet = {
          ...existing,
          present,
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({
          sheets: s.sheets.map((sheet) => (sheet.id === sheetId ? next : sheet)),
        }))
        writeSheet(set, previous, next, 'Could not save the attendance. It was reverted.')
      },

      markExported: (id) => {
        const previous = get().sheets
        const existing = previous.find((sheet) => sheet.id === id)
        if (!existing) return
        const next: AttendanceSheet = {
          ...existing,
          lastExportedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({
          sheets: s.sheets.map((sheet) => (sheet.id === id ? next : sheet)),
        }))
        writeSheet(set, previous, next, 'Could not record the export on the server.')
      },

      deleteSheet: (id) => {
        const previous = get().sheets
        if (!previous.some((sheet) => sheet.id === id)) return
        set((s) => ({ sheets: s.sheets.filter((sheet) => sheet.id !== id) }))
        persistWrite({
          write: deleteRow('attendance_sheets', id),
          rollback: () => set({ sheets: previous }),
          failure: 'Could not delete the attendance sheet. It was restored.',
        })
      },

      importData: (sheets) => {
        set({ sheets: Array.isArray(sheets) ? sheets : [] })
      },

      restoreData: (sheets) => {
        const previous = get().sheets
        const list = Array.isArray(sheets) ? sheets : []
        set({ sheets: list })
        persistWrite({
          write: [
            deleteAllRows('attendance_sheets'),
            ...list.map((sheet) => upsertRow('attendance_sheets', sheet.id, sheet)),
          ],
          rollback: () => set({ sheets: previous }),
          failure: 'Could not restore attendance sheets on the server. Your previous data was kept.',
        })
      },

      clear: () => {
        const previous = get().sheets
        set({ sheets: [] })
        persistWrite({
          write: deleteAllRows('attendance_sheets'),
          rollback: () => set({ sheets: previous }),
          failure: 'Could not clear attendance sheets on the server. Your data was restored.',
        })
      },
    }),
    {
      name: 'choir-attendance',
      version: 1,
    },
  ),
)
