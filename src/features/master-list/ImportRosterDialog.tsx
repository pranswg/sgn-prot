import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FileUp, Loader2, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import { useAdminStore } from '@/store/adminStore'
import type { MemberInput, TraineeInput } from '@/core/types/member'
import { voicePositionsForGender } from '@/core/constants/voicePositions'
import { CHOIR_POSITIONS } from '@/core/constants/choirPositions'
import { MEMBERSHIP_LABELS } from '@/core/constants/memberMembership'
import { extractRosterFromPdf, type RosterCandidate } from '@/lib/rosterImport'
import {
  extractRosterFromSpreadsheet,
  isSpreadsheetFile,
} from '@/lib/spreadsheetImport'
import { todayPHT } from '@/lib/phDate'
import { useAsyncAction } from '@/hooks/useAsyncAction'

interface ImportRosterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

function groupLabel(section: string, isTrainee: boolean): string {
  const upper = section.toUpperCase()
  if (isTrainee && upper.includes('BABAE')) return "Trainees · Women's section"
  if (isTrainee && upper.includes('LALAKI')) return "Trainees · Men's section"
  if (upper.includes('PANGULUHAN')) return 'Panguluhan (Officers)'
  if (upper.includes('ORGANISTA')) return 'Organistas'
  return titleCase(section)
}

interface CandidateGroup {
  label: string
  candidates: RosterCandidate[]
}

export function ImportRosterDialog({ open, onOpenChange }: ImportRosterDialogProps) {
  const members = useMemberStore((s) => s.members)
  const trainees = useMemberStore((s) => s.trainees)
  const importMasterList = useMemberStore((s) => s.importMasterList)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const allDutyRoles = useSettingsStore((s) => s.allDutyRoles)
  const account = useAuthStore((state) =>
    state.accounts.find((item) => item.id === state.currentAccountId),
  )
  const addAuditLog = useAdminStore((state) => state.addAuditLog)
  const canImport = account?.role === 'admin' && (account.status ?? 'active') === 'active'

  const voices = allVoices()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [candidates, setCandidates] = useState<RosterCandidate[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileKind, setFileKind] = useState<'pdf' | 'spreadsheet' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setCandidates(null)
      setParsing(false)
      setFileName(null)
      setFileKind(null)
      setError(null)
    }
  }, [open])

  const groups = useMemo<CandidateGroup[]>(() => {
    if (!candidates) return []
    const map = new Map<string, CandidateGroup>()
    for (const candidate of candidates) {
      const label = groupLabel(candidate.section, candidate.isTrainee)
      if (!map.has(label)) map.set(label, { label, candidates: [] })
      map.get(label)!.candidates.push(candidate)
    }
    return [...map.values()]
  }, [candidates])

  const stats = useMemo(() => {
    if (!candidates) {
      return { total: 0, newCount: 0, traineeCount: 0, memberCount: 0, selected: 0 }
    }
    const newCount = candidates.filter((c) => !c.duplicate).length
    const traineeCount = candidates.filter((c) => c.isTrainee).length
    const memberCount = candidates.length - traineeCount
    const selected = candidates.filter((c) => c.selected).length
    return { total: candidates.length, newCount, traineeCount, memberCount, selected }
  }, [candidates])

  const reset = () => {
    setCandidates(null)
    setParsing(false)
    setFileName(null)
    setFileKind(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!canImport) {
      toast.error('Only an active Admin can import the Master List.')
      return
    }
    const spreadsheet = isSpreadsheetFile(file)
    setFileName(file.name)
    setFileKind(spreadsheet ? 'spreadsheet' : 'pdf')
    setParsing(true)
    setError(null)
    try {
      const result = spreadsheet
        ? await extractRosterFromSpreadsheet(
            file,
            allVoices(),
            members,
            trainees,
            allDutyRoles(),
          )
        : await extractRosterFromPdf(file, allVoices(), members, trainees)
      setCandidates(result.candidates)
      if (result.candidates.length === 0) {
        setCandidates(null)
        setError(
          spreadsheet
            ? 'No names were found in this file. Make sure it is a Master List export with first and last name columns.'
            : 'No names were found in this PDF. It may not be the choir roster sheet.',
        )
      }
    } catch {
      setCandidates(null)
      setError(
        spreadsheet
          ? 'Could not read this file. Make sure it is a CSV or Excel export from the Master List, then try again.'
          : 'Could not read this PDF. Make sure it is the roster PDF, then try again.',
      )
    } finally {
      setParsing(false)
    }
  }

  const updateCandidate = (id: string, patch: Partial<RosterCandidate>) => {
    setCandidates((current) =>
      current
        ? current.map((c) => (c.id === id ? { ...c, ...patch } : c))
        : current,
    )
  }

  const handleGenderChange = (candidate: RosterCandidate, gender: 'male' | 'female') => {
    const options = voicePositionsForGender(gender, voices)
    updateCandidate(candidate.id, {
      gender,
      voicePosition:
        options.find((v) => v.id === candidate.voicePosition)?.id ?? options[0]?.id ?? '',
    })
  }

  const setGroupSelection = (group: CandidateGroup, selected: boolean) => {
    const ids = new Set(group.candidates.map((c) => c.id))
    setCandidates((current) =>
      current
        ? current.map((c) => (ids.has(c.id) ? { ...c, selected } : c))
        : current,
    )
  }

  const groupChecked = (group: CandidateGroup): boolean | 'indeterminate' => {
    const selected = group.candidates.filter((c) => c.selected).length
    if (selected === 0) return false
    if (selected === group.candidates.length) return true
    return 'indeterminate'
  }

  const runImport = () => {
    if (!candidates) return
    if (!canImport || !account) {
      toast.error('Only an active Admin can import the Master List.')
      return
    }
    const picked = candidates.filter((c) => c.selected)
    if (picked.length === 0) return

    const today = todayPHT()
    const importedMembers: MemberInput[] = []
    const importedTrainees: TraineeInput[] = []

    for (const candidate of picked) {
      const firstName = candidate.firstName.trim()
      const lastName = candidate.lastName.trim()
      if (!firstName || !lastName) continue

      const voicePosition =
        candidate.voicePosition ||
        voicePositionsForGender(candidate.gender, voices)[0]?.id ||
        ''

      // A spreadsheet export carries the original date added; the roster PDF
      // does not, so it falls back to today.
      const dateAdded = candidate.dateAdded ?? today

      if (candidate.isTrainee) {
        importedTrainees.push({
          firstName,
          lastName,
          gender: candidate.gender,
          voicePosition,
          status: candidate.isActive ? 'active' : 'inactive',
          dateAdded,
          notes: candidate.notes.trim() || undefined,
        })
      } else {
        importedMembers.push({
          firstName,
          middleName: candidate.middleName,
          suffix: candidate.suffix,
          lastName,
          gender: candidate.gender,
          voicePosition,
          membershipType: candidate.membershipType ?? 'regular',
          isActive: candidate.isActive,
          dateAdded,
          positions: candidate.positions,
          assignedDutyRoleIds: candidate.assignedDutyRoleIds,
          notes: candidate.notes.trim() || undefined,
        })
      }
    }

    const result = importMasterList(
      account.id,
      importedMembers,
      importedTrainees,
    )
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    addAuditLog({
      actorId: account.id,
      actorName: account.fullName,
      actorUsername: account.username,
      action: 'Imported Master List',
      module: 'Data Management',
      details: `Imported ${result.importedMembers} members and ${result.importedTrainees} trainees from ${fileName ?? 'roster file'}.`,
    })
    const { importedMembers: memberCount, importedTrainees: traineeCount } =
      result
    const message = [
      memberCount > 0 ? `${memberCount} member${memberCount === 1 ? '' : 's'}` : null,
      traineeCount > 0 ? `${traineeCount} trainee${traineeCount === 1 ? '' : 's'}` : null,
    ]
      .filter(Boolean)
      .join(' and ')

    toast.success(`Imported ${message} from roster.`)
    reset()
    onOpenChange(false)
  }

  const [importRoster, importing] = useAsyncAction(runImport)

  if (!canImport) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !parsing) reset()
        onOpenChange(value)
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Master List</DialogTitle>
        <DialogDescription>
          Upload the choir roster PDF, or a CSV or Excel file exported from the
          Master List. Review the detected names before importing them.
        </DialogDescription>
        </DialogHeader>

        {!candidates && !parsing && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Choose the roster file</p>
              <p className="text-xs text-muted-foreground">
                Accepts the roster PDF, or a CSV or Excel file exported from the
                Master List. The names are shown for your review before anything
                is saved.
              </p>
            </div>
            <Button onClick={() => fileInputRef.current?.click()}>
              <FileUp className="size-4" />
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.csv,.xlsx,.xlsm,.xls"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>
        )}

        {parsing && (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {fileKind === 'spreadsheet' ? 'Reading spreadsheet…' : 'Reading roster PDF…'}
          </div>
        )}

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {candidates && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span>
              <Badge variant="secondary">{stats.total} names</Badge>
              <Badge variant="outline">{stats.newCount} new</Badge>
              <Badge variant="outline">{stats.total - stats.newCount} already in list</Badge>
              {fileKind === 'spreadsheet' && (
                <Badge variant="outline">
                  {stats.memberCount} members · {stats.traineeCount} trainees
                </Badge>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              {groups.map((group) => {
                const checked = groupChecked(group)
                return (
                  <div key={group.label} className="rounded-lg border">
                    <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          setGroupSelection(group, value === true)
                        }
                      />
                      <span className="text-sm font-semibold">{group.label}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {group.candidates.filter((c) => c.selected).length} /{' '}
                        {group.candidates.length}
                      </Badge>
                    </div>
                    <div className="divide-y">
                      {group.candidates.map((candidate) => (
                        <div
                          key={candidate.id}
                          className="flex flex-wrap items-center gap-2 px-3 py-1.5"
                        >
                          <Checkbox
                            checked={candidate.selected}
                            onCheckedChange={(value) =>
                              updateCandidate(candidate.id, { selected: value === true })
                            }
                          />
                          <Input
                            value={candidate.lastName}
                            onChange={(event) =>
                              updateCandidate(candidate.id, {
                                lastName: event.target.value,
                              })
                            }
                            className="h-8 w-44"
                            aria-label="Last name"
                          />
                          <Input
                            value={candidate.firstName}
                            onChange={(event) =>
                              updateCandidate(candidate.id, {
                                firstName: event.target.value,
                              })
                            }
                            className="h-8 w-52"
                            aria-label="First name"
                          />
                          <select
                            value={candidate.voicePosition}
                            onChange={(event) =>
                              updateCandidate(candidate.id, {
                                voicePosition: event.target.value,
                              })
                            }
                            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            aria-label="Voice position"
                          >
                            <option value="">No section</option>
                            {voicePositionsForGender(candidate.gender, voices).map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={candidate.gender}
                            onChange={(event) =>
                              handleGenderChange(
                                candidate,
                                event.target.value as 'male' | 'female',
                              )
                            }
                            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            aria-label="Gender"
                          >
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                          </select>
                          {candidate.duplicate && (
                            <Badge variant="destructive">Already in list</Badge>
                          )}
                          {!candidate.isActive && (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                          {candidate.membershipType &&
                            candidate.membershipType !== 'regular' && (
                            <Badge variant="outline">
                              {MEMBERSHIP_LABELS[candidate.membershipType]}
                            </Badge>
                          )}
                          {candidate.positions && candidate.positions.length > 0 && (
                            <Badge variant="secondary">
                              {candidate.positions
                                .map(
                                  (p) =>
                                    CHOIR_POSITIONS.find((c) => c.id === p)?.label ?? p,
                                )
                                .join(', ')}
                            </Badge>
                          )}
                          {candidate.notes && (
                            <span
                              title={candidate.notes}
                              className="max-w-48 truncate text-xs text-muted-foreground"
                            >
                              {candidate.notes}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <DialogFooter className="items-center">
              <p className="mr-auto text-sm text-muted-foreground">
                Importing {stats.selected} of {stats.total} detected names.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setCandidates(null)
                  setError(null)
                  setFileName(null)
                  setFileKind(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              >
                Choose another file
              </Button>
              <Button onClick={importRoster} loading={importing} disabled={stats.selected === 0}>
                Import {stats.selected > 0 ? stats.selected : ''}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}