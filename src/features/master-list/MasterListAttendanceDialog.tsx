import { useState } from 'react'
import { CalendarPlus, FileDown, FileText, X } from 'lucide-react'
import type { Choir, Member, Trainee } from '@/core/types/member'
import type {
  DutyRole,
  SuguanDocFormat,
  VoicePosition,
} from '@/core/types/suguan'
import { resolvePmDutyRole } from '@/core/constants/dutyRoles'
import { memberHasRank } from '@/lib/memberRanks'
import {
  DEFAULT_DOC_FORMAT,
  PAPER_SIZE_LABELS,
  normalizeDocFormat,
} from '@/lib/suguanUtils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DisclosureSection } from '@/components/DisclosureSection'
import { DocumentSetupStep } from '@/features/suguan-builder/DocumentSetupStep'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateKeyLongDate, isDateKey, todayPHT, type DateKey } from '@/lib/phDate'
import type { MasterListAttendanceOptions } from './masterListAttendancePdf'

export type MasterListAttendanceExportFormat = 'pdf' | 'docx'

interface MasterListAttendanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  choir: Choir
  members: Member[]
  trainees: Trainee[]
  voices: VoicePosition[]
  dutyRoles: DutyRole[]
  onGenerate: (
    options: Pick<
      MasterListAttendanceOptions,
      | 'dates'
      | 'title'
      | 'groupByVoice'
      | 'selectedVoiceIds'
      | 'includeNagsasanayMen'
      | 'includeNagsasanayWomen'
      | 'separateChoirs'
      | 'lastNameFirst'
      | 'docFormat'
      | 'pangulongName'
    >,
    format: MasterListAttendanceExportFormat,
  ) => void
}

export function MasterListAttendanceDialog({
  open,
  onOpenChange,
  choir,
  members,
  trainees,
  voices,
  dutyRoles,
  onGenerate,
}: MasterListAttendanceDialogProps) {
  const isPnk = choir === 'pnk'
  const activeMembers = members.filter((member) => member.isActive)
  const activeTrainees = trainees.filter(
    (trainee) => trainee.status === 'active',
  )
  const pangulongRole = resolvePmDutyRole(dutyRoles)
  const pangulongMembers = activeMembers
    .filter(
      (member) =>
        pangulongRole !== undefined &&
        memberHasRank(member, pangulongRole.id, dutyRoles),
    )
    .sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(
        `${right.lastName} ${right.firstName}`,
      ),
    )
  const [dateDraft, setDateDraft] = useState<DateKey>(todayPHT())
  const [dates, setDates] = useState<DateKey[]>([])
  const [title, setTitle] = useState('')
  const [groupByVoice, setGroupByVoice] = useState(true)
  const [selectedVoiceIds, setSelectedVoiceIds] = useState<string[]>([])
  const [includeNagsasanayMen, setIncludeNagsasanayMen] = useState(false)
  const [includeNagsasanayWomen, setIncludeNagsasanayWomen] = useState(false)
  const [lastNameFirst, setLastNameFirst] = useState(true)
  const [pangulongMemberId, setPangulongMemberId] = useState('')
  const [separateChoirs, setSeparateChoirs] = useState(false)
  const [docFormat, setDocFormat] = useState<SuguanDocFormat>(() => ({
    ...DEFAULT_DOC_FORMAT,
  }))
  const [docOpen, setDocOpen] = useState(false)
  const [error, setError] = useState('')
  const normalizedFormat = normalizeDocFormat(docFormat)
  const fontSizeSummary =
    normalizedFormat.fontSize === 'custom'
      ? 'Custom font size'
      : `${normalizedFormat.fontSize[0].toUpperCase()}${normalizedFormat.fontSize.slice(1)} font`

  const addDate = () => {
    if (!isDateKey(dateDraft)) {
      setError('Choose a valid date to add.')
      return
    }
    if (dates.includes(dateDraft)) {
      setError('That attendance date has already been added.')
      return
    }
    setDates((current) =>
      [...current, dateDraft].sort((left, right) => left.localeCompare(right)),
    )
    setError('')
  }

  const handleGenerate = (format: MasterListAttendanceExportFormat) => {
    if (!title.trim()) {
      setError('Enter a title for the attendance sheet.')
      return
    }
    if (dates.length === 0) {
      setError('Add at least one attendance date.')
      return
    }
    const selectedPangulong = isPnk
      ? undefined
      : pangulongMembers.find((member) => member.id === pangulongMemberId) ??
        (pangulongMembers.length === 1 ? pangulongMembers[0] : undefined)
    if (!isPnk && !selectedPangulong) {
      setError(
        pangulongMembers.length === 0
          ? 'No active Pangulong Mang-aawit is available in the Master List.'
          : 'Select an active Pangulong Mang-aawit for the signatory.',
      )
      return
    }
    const hasTraineesToInclude =
      (includeNagsasanayMen &&
        activeTrainees.some((trainee) => trainee.gender === 'male')) ||
      (includeNagsasanayWomen &&
        activeTrainees.some((trainee) => trainee.gender === 'female'))
    if (activeMembers.length === 0 && !hasTraineesToInclude) {
      setError('There are no active members or selected trainees to include.')
      return
    }
    if (
      !isPnk &&
      groupByVoice &&
      activeMembers.length > 0 &&
      selectedVoiceIds.length === 0
    ) {
      setError('Select at least one voice position.')
      return
    }
    if (
      !isPnk &&
      groupByVoice &&
      activeMembers.length > 0 &&
      !hasTraineesToInclude &&
      !activeMembers.some((member) =>
        selectedVoiceIds.includes(member.voicePosition),
      )
    ) {
      setError('No Master List members are assigned to the selected voice positions.')
      return
    }
    setError('')
    onOpenChange(false)
    onGenerate(
      {
        dates,
        title: title.trim(),
        groupByVoice: isPnk ? false : groupByVoice,
        selectedVoiceIds: isPnk ? [] : selectedVoiceIds,
        includeNagsasanayMen,
        includeNagsasanayWomen,
        separateChoirs: isPnk ? false : separateChoirs,
        lastNameFirst,
        docFormat,
        pangulongName: selectedPangulong
          ? [
              selectedPangulong.firstName,
              selectedPangulong.middleName,
              selectedPangulong.lastName,
              selectedPangulong.suffix,
            ]
              .filter(Boolean)
              .join(' ')
          : '',
      },
      format,
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Master List Attendance Sheet</DialogTitle>
          <DialogDescription>
            Add the attendance dates, choose how members are grouped, and set
            up the printed document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="master-attendance-title">Header title</Label>
            <Input
              id="master-attendance-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setError('')
              }}
              placeholder="Enter the title to print"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Only this title is printed above the attendance table.
            </p>
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Attendance Dates</h3>
              <p className="text-xs text-muted-foreground">
                Add each date that should appear as an attendance column.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                aria-label="Attendance date"
                type="date"
                value={dateDraft}
                onChange={(event) => {
                  setDateDraft(event.target.value)
                  setError('')
                }}
              />
              <Button type="button" variant="outline" onClick={addDate}>
                <CalendarPlus className="size-4" />
                Add date
              </Button>
            </div>
            {dates.length > 0 && (
              <ul className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
                {dates.map((date) => (
                  <li
                    key={date}
                    className="flex items-center justify-between gap-3 rounded px-2 py-1 text-sm"
                  >
                    <span>{formatDateKeyLongDate(date)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${formatDateKeyLongDate(date)}`}
                      onClick={() =>
                        setDates((current) =>
                          current.filter((selected) => selected !== date),
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-md border p-3">
            <div>
              <h3 className="text-sm font-semibold">Nagsasanay / Trainees</h3>
              <p className="text-xs text-muted-foreground">
                Include active trainees by gender. They appear in their own
                sections without voice-position grouping.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeNagsasanayMen}
                  onCheckedChange={(checked) =>
                    setIncludeNagsasanayMen(checked === true)
                  }
                />
                Nagsasanay {isPnk ? 'Lalaki' : 'Men'}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeNagsasanayWomen}
                  onCheckedChange={(checked) =>
                    setIncludeNagsasanayWomen(checked === true)
                  }
                />
                Nagsasanay {isPnk ? 'Babae' : 'Women'}
              </label>
            </div>
            {activeTrainees.length === 0 && (
              <p className="text-xs text-muted-foreground">
                There are no active trainees to include.
              </p>
            )}
          </section>

          {!isPnk && (
            <label className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                checked={separateChoirs}
                onCheckedChange={(checked) =>
                  setSeparateChoirs(checked === true)
                }
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium">
                  Separate Babae and Lalaki sheets
                </span>
                <span className="block text-xs text-muted-foreground">
                  Prints a Babae sheet (women + Nagsasanay Women) and a Lalaki
                  sheet (men + Nagsasanay Men). Each sheet is labelled under
                  the dates.
                </span>
              </span>
            </label>
          )}

          <label className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              checked={lastNameFirst}
              onCheckedChange={(checked) =>
                setLastNameFirst(checked === true)
              }
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">
                Use “Last Name, First Name” format
              </span>
              <span className="block text-xs text-muted-foreground">
                By default, names appear as Last Name, First Name.
              </span>
            </span>
          </label>

          {!isPnk && (
            <section className="space-y-2">
              <Label htmlFor="master-attendance-pangulong">
                Pangulong Mang-aawit signatory
              </Label>
              <Select
                value={pangulongMemberId}
                onValueChange={(value) => {
                  setPangulongMemberId(value)
                  setError('')
                }}
              >
                <SelectTrigger id="master-attendance-pangulong">
                  <SelectValue
                    placeholder={
                      pangulongMembers.length === 1
                        ? `${pangulongMembers[0].firstName} ${pangulongMembers[0].lastName}`
                        : 'Select Pangulong Mang-aawit'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {pangulongMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {[member.lastName, member.firstName, member.middleName]
                        .filter(Boolean)
                        .join(', ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Printed under “Naghanda:” with the Pangulong Mang-aawit title.
              </p>
            </section>
          )}

          {!isPnk && (
            <section className="space-y-3 rounded-md border p-3">
              <div>
                <h3 className="text-sm font-semibold">Voice Positions</h3>
                <p className="text-xs text-muted-foreground">
                  Select each configured voice section to include.
                </p>
              </div>
              {voices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No voice positions are configured.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {voices.map((voice) => (
                    <label
                      key={voice.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selectedVoiceIds.includes(voice.id)}
                        disabled={!groupByVoice}
                        onCheckedChange={(checked) => {
                          setSelectedVoiceIds((current) =>
                            checked === true
                              ? [...new Set([...current, voice.id])]
                              : current.filter((id) => id !== voice.id),
                          )
                          setError('')
                        }}
                      />
                      {voice.name}
                    </label>
                  ))}
                </div>
              )}
              <label className="flex items-start gap-3 border-t pt-3">
                <Checkbox
                  checked={!groupByVoice}
                  onCheckedChange={(checked) =>
                    setGroupByVoice(checked !== true)
                  }
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    Include all members without voice sections
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Prints one roster without voice sections. Selected trainees
                    are included under their Nagsasanay section.
                  </span>
                </span>
              </label>
            </section>
          )}

          <DisclosureSection
            open={docOpen}
            onToggle={() => setDocOpen((current) => !current)}
            icon={FileText}
            title="Document setup"
            summary={`${PAPER_SIZE_LABELS[normalizedFormat.paperSize].short} · ${
              normalizedFormat.orientation === 'landscape'
                ? 'Landscape'
                : 'Portrait'
            } · ${fontSizeSummary}`}
            bodyClassName="p-4"
          >
            <DocumentSetupStep
              value={docFormat}
              onChange={setDocFormat}
              embedded
            />
          </DisclosureSection>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => handleGenerate('pdf')}>
            <FileDown className="size-4" />
            Export to PDF
          </Button>
          <Button type="button" onClick={() => handleGenerate('docx')}>
            <FileDown className="size-4" />
            Export to Word
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
