import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, FileDown, FileText } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { MobileDirectoryHeader } from '@/components/MobileDirectoryHeader'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAttendanceStore } from '@/store/attendanceStore'
import {
  compareDateKeys,
  formatDateKey,
} from '@/lib/phDate'
import type { Choir, Member, Trainee } from '@/core/types/member'
import type { AttendanceSheet } from '@/store/attendanceStore'
import type { StoredVoice } from '@/store/settingsStore'
import { CHOIR_LABELS, membersOf, traineesOf } from '@/lib/choirs'
import { useExportPreview } from '@/hooks/useExportPreview'
import { exportMasterListAttendancePdf } from './masterListAttendancePdf'
import { exportMasterListAttendanceWord } from './masterListAttendanceWord'
import type { MasterListAttendanceOptions } from './masterListAttendancePdf'
import { exportFileName } from '@/lib/exportNaming'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AttendanceRecordViewProps {
  sheet: AttendanceSheet
  choir: Choir
  members: Member[]
  trainees: Trainee[]
  voices: StoredVoice[]
  canEditMembers: boolean
  onClose: () => void
}

export function AttendanceRecordView({
  sheet,
  choir,
  members,
  trainees,
  voices,
  canEditMembers,
  onClose,
}: AttendanceRecordViewProps) {
  const attendanceStore = useAttendanceStore()
  const isMobile = useIsMobile()
  const [draft, setDraft] = useState<Record<string, string[]>>(
    () => ({ ...sheet.present }),
  )
  const { exportPreview, requestExport } = useExportPreview()

  useEffect(() => {
    setDraft({ ...sheet.present })
  }, [sheet])

  const voicesById = useMemo(
    () => new Map(voices.map((voice) => [voice.id, voice.name])),
    [voices],
  )

  const roster = useMemo(
    () =>
      membersOf(members, choir)
        .filter((member) => member.isActive)
        .sort(
          (a, b) =>
            a.lastName.localeCompare(b.lastName) ||
            a.firstName.localeCompare(b.firstName) ||
            a.id.localeCompare(b.id),
        ),
    [members, choir],
  )

  const sections = useMemo(
    () => {
      if (sheet.groupByVoice) {
        return sheet.voiceIds.map((voiceId: string) => ({
          label: voicesById.get(voiceId) ?? voiceId,
          members: roster.filter((member: Member) => member.voicePosition === voiceId),
        }))
      }
      return [{ label: 'All members', members: roster }]
    },
    [sheet.groupByVoice, sheet.voiceIds, roster, voicesById],
  )

  const tableRows = useMemo(() => {
    const rows: Array<
      | { kind: 'section'; label: string }
      | { kind: 'member'; index: number; member: Member }
    > = []
    let counter = 0
    sections.forEach((section) => {
      rows.push({ kind: 'section', label: section.label })
      section.members.forEach((member) => {
        counter += 1
        rows.push({ kind: 'member', index: counter, member })
      })
    })
    return rows
  }, [sections])

  const personKey = (member: Member) => `member:${member.id}`
  const isPresent = (key: string, date: string) =>
    (draft[key] ?? []).includes(date)

  const toggle = useCallback(
    (key: string, date: string, checked: boolean) => {
      if (!canEditMembers) return
      setDraft((prev) => {
        const next = { ...prev }
        const marked = [...(prev[key] ?? [])]
        if (checked) {
          if (!marked.includes(date)) marked.push(date)
        } else {
          const index = marked.indexOf(date)
          if (index !== -1) marked.splice(index, 1)
        }
        if (marked.length === 0) delete next[key]
        else next[key] = marked.sort(compareDateKeys)
        return next
      })
    },
    [canEditMembers],
  )

  const handleSave = () => {
    attendanceStore.updatePresent(sheet.id, draft)
    toast.success('Attendance saved.')
  }

  const handleExport = (format: 'pdf' | 'word') => {
    const extension = format === 'pdf' ? 'pdf' : 'docx'
    const fileName = exportFileName(sheet.title, extension)
    requestExport({
      filename: fileName,
      confirmLabel: `Export ${format === 'pdf' ? 'PDF' : 'Word'}`,
      onConfirm: () => {
        void (async () => {
          try {
            const options: MasterListAttendanceOptions = {
              ...sheet,
              members: roster,
              trainees: traineesOf(trainees, choir).filter(
                (trainee) => trainee.status === 'active',
              ),
              voices,
              selectedVoiceIds: sheet.voiceIds,
              filename: fileName,
              choir,
            }
            if (format === 'pdf') {
              await exportMasterListAttendancePdf(options)
            } else {
              await exportMasterListAttendanceWord(options)
            }
            attendanceStore.markExported(sheet.id)
            toast.success(
              `Attendance sheet exported as ${format === 'pdf' ? 'PDF' : 'Word'}.`,
            )
          } catch (error) {
            console.error(error)
            toast.error(
              error instanceof Error
                ? `Attendance sheet ${format === 'pdf' ? 'PDF' : 'Word'} export failed: ${error.message}`
                : `Could not export the attendance sheet as ${format === 'pdf' ? 'PDF' : 'Word'}.`,
            )
          }
        })()
      },
    })
  }

  const headerActions = (
    <>
      <Button disabled={!canEditMembers} onClick={handleSave}>
        <Check className="size-4" /> Save
      </Button>
      <Button variant="outline" onClick={() => handleExport('pdf')}>
        <FileDown className="size-4 mr-2" /> Export PDF
      </Button>
      <Button variant="outline" onClick={() => handleExport('word')}>
        <FileText className="size-4 mr-2" /> Export Word
      </Button>
    </>
  )

  return (
    <section className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" onClick={onClose}>
        <ArrowLeft className="size-4" /> Attendance
      </Button>
      {isMobile ? (
        <MobileDirectoryHeader
          title={sheet.title}
          description={`${sheet.dates.map((date) => formatDateKey(date)).join(' – ')} · ${CHOIR_LABELS[choir]} · ${roster.length} members`}
          actions={headerActions}
          onOpenMenu={() => {
            // no-op; the mobile drawer is opened from the shell hamburger
          }}
        />
      ) : (
        <PageHeader
          eyebrow={CHOIR_LABELS[choir]}
          title={sheet.title}
          description={`${sheet.dates.map((date) => formatDateKey(date)).join(' – ')} · ${CHOIR_LABELS[choir]} · ${roster.length} members`}
          className="hidden md:flex"
          actions={headerActions}
        />
      )}

      <div className="grid grid-cols-3 divide-x divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
        {sheet.dates.map((date) => (
          <div
            key={date}
            className="px-2 py-3 text-center border-l border-l-transparent first:border-l-0"
          >
            <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
              {roster.filter((member) => isPresent(personKey(member), date))
                .length}
            </div>
            <div className="mt-0.5 text-[0.6875rem] font-medium text-muted-foreground">
              Present · {formatDateKey(date)}
            </div>
          </div>
        ))}
        <div className="px-2 py-3 text-center border-l border-l-transparent first:border-l-0">
          <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
            {roster.length}
          </div>
          <div className="mt-0.5 text-[0.6875rem] font-medium text-muted-foreground">
            Members
          </div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Name</th>
              {sheet.dates.map((date) => (
                <th key={date} style={{ width: 110 }}>
                  {formatDateKey(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => {
              if (row.kind === 'section') {
                return (
                  <tr key={row.label} className="section">
                    <td
                      colSpan={2 + sheet.dates.length}
                      className="bg-muted font-medium text-xs tracking-[0.06em] uppercase text-secondary-foreground p-2"
                    >
                      {row.label}
                    </td>
                  </tr>
                )
              }
              const member = row.member
              const key = personKey(member)
              return (
                <tr key={member.id}>
                  <td>{row.index}</td>
                  <td className="p-2 align-middle whitespace-nowrap border-b border-border/70 font-medium">
                    {formatAttendanceName(member, sheet.lastNameFirst)}
                  </td>
                  {sheet.dates.map((date) => (
                    <td key={date} className="p-2 align-middle whitespace-nowrap border-b border-border/70">
                      <span
                        className={cn(
                          'inline-grid place-items-center size-4 shrink-0 rounded-[4px] border border-foreground/50 bg-white',
                          isPresent(key, date)
                            ? 'bg-primary border-primary text-primary-foreground'
                            : '',
                          !canEditMembers
                            ? 'cursor-not-allowed opacity-50'
                            : '',
                        )}
                        onClick={() =>
                          toggle(key, date, !isPresent(key, date))
                        }
                        role="checkbox"
                        aria-checked={isPresent(key, date)}
                      >
                        {isPresent(key, date) && (
                          <Check
                            className="size-3.5"
                            strokeWidth={3}
                            stroke="currentColor"
                          />
                        )}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Check the box to mark a member present for that date.
      </p>

      {exportPreview}
    </section>
  )
}

function formatAttendanceName(
  member: Member,
  lastNameFirst: boolean,
): string {
  const given = [member.firstName, member.middleName].filter(Boolean).join(' ')
  const parts = lastNameFirst
    ? [member.lastName, given].filter(Boolean)
    : [given, member.lastName].filter(Boolean)
  return [...parts, member.suffix].filter(Boolean).join(' ')
}
