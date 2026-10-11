import { useMemo, useState } from 'react'
import { CalendarDays, FileDown, FileSpreadsheet, FileText, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/PageHeader'
import { useExportPreview } from '@/hooks/useExportPreview'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useNavStore } from '@/store/navStore'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDateKeyNumeric, isDateKey } from '@/lib/phDate'
import { exportFileName } from '@/lib/exportNaming'
import type { ExtraOccasionSuguanConfig, SuguanGroup } from '@/core/types/suguan'
import {
  createEmptyDraft,
  buildPreviewSuguan,
  createDraftFromSuguan,
  type SuguanDraft,
} from '@/features/suguan-builder/builderState'
import { AssignmentWorkspace } from '@/features/suguan-builder/AssignmentWorkspace'
import { DocumentSetupStep } from '@/features/suguan-builder/DocumentSetupStep'
import { SchedulesStep } from '@/features/suguan-builder/SchedulesStep'
import {
  buildExtraOccasionSections,
  memberIsEligibleExtraOrganista,
  type ExtraOrganistaAssignment,
  type ExtraOrganistaRole,
} from './extraOccasionData'
import {
  exportExtraOccasionDocx,
  exportExtraOccasionExcel,
  exportExtraOccasionPdf,
  type ExtraOccasionExportOptions,
} from './extraOccasionExport'

const GROUP_OPTIONS: { id: SuguanGroup; label: string }[] = [
  { id: 'babae', label: "Women's Choir" },
  { id: 'lalaki', label: "Men's Choir" },
  { id: 'mixed', label: 'Mixed Choir' },
]

const ORGANISTA_ROLES: { id: ExtraOrganistaRole; label: string }[] = [
  { id: 'organista', label: 'Organista' },
  { id: 'reserve', label: 'Reserbang Organista' },
]

function isSuguanGroup(value: string): value is SuguanGroup {
  return GROUP_OPTIONS.some((group) => group.id === value)
}

function isOrganistaRole(value: string): value is ExtraOrganistaRole {
  return ORGANISTA_ROLES.some((role) => role.id === value)
}

export function ExtraOccasionSuguanPage() {
  const { can } = usePermissions()
  const extraOccasionSuguanId = useNavStore((state) => state.extraOccasionSuguanId)
  const openSuguanDetail = useNavStore((state) => state.openSuguanDetail)
  const existingRecord = useSuguanStore((state) =>
    state.suguan.find(
      (record) =>
        record.id === extraOccasionSuguanId && Boolean(record.extraOccasion),
    ),
  )
  const createSuguan = useSuguanStore((state) => state.createSuguan)
  const updateSuguan = useSuguanStore((state) => state.updateSuguan)
  const members = useMemberStore((state) => state.members)
  const allVoices = useSettingsStore((state) => state.allVoices)
  const localeName = useSettingsStore((state) => state.localeName)
  const canAssignMembers = can('assign-members')
  const voices = allVoices()
  const [draft, setDraft] = useState<SuguanDraft>(() => {
    if (existingRecord) {
      return {
        ...createDraftFromSuguan(existingRecord, voices),
        coverage: null,
        date: existingRecord.date,
        time: '',
        events: [],
      }
    }
    const initial = createEmptyDraft(voices)
    return {
      ...initial,
      coverage: null,
      date: '',
      time: '',
      events: [],
    }
  })
  const [churchName, setChurchName] = useState(
    existingRecord?.extraOccasion?.localeName ?? localeName,
  )
  const [pagsasanay, setPagsasanay] = useState(
    existingRecord?.extraOccasion?.pagsasanay ?? {
      enabled: true,
      label: 'Pagsasanay',
      date: '',
    },
  )
  const [pagtupad, setPagtupad] = useState(
    existingRecord?.extraOccasion?.pagtupad ?? {
      enabled: true,
      label: 'Pagtupad',
      date: '',
    },
  )
  const [showFooterSignatories, setShowFooterSignatories] = useState(
    existingRecord?.extraOccasion?.showFooterSignatories ?? true,
  )
  const [organistaAssignments, setOrganistaAssignments] = useState<
    Record<string, ExtraOrganistaAssignment[]>
  >(existingRecord?.extraOccasion?.organistaAssignments ?? {})
  const [organistaScheduleId, setOrganistaScheduleId] = useState('')
  const [organistaMemberId, setOrganistaMemberId] = useState('')
  const [organistaRole, setOrganistaRole] =
    useState<ExtraOrganistaRole>('organista')
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | 'docx' | null>(null)
  const [saving, setSaving] = useState(false)
  const { exportPreview, requestExport } = useExportPreview()

  const patch = (value: Partial<SuguanDraft>) =>
    setDraft((current) => ({ ...current, ...value }))
  const eligibleOrganistas = useMemo(
    () => members.filter(memberIsEligibleExtraOrganista),
    [members],
  )
  const assignedOrganistaIds = new Set(
    (organistaAssignments[organistaScheduleId] ?? []).map(
      (assignment) => assignment.memberId,
    ),
  )
  const previewSuguan = useMemo(() => buildPreviewSuguan(draft), [draft])
  const sections = useMemo(
    () =>
      buildExtraOccasionSections(
        previewSuguan,
        voices,
        members,
        organistaAssignments,
      ),
    [previewSuguan, voices, members, organistaAssignments],
  )

  const exportOptions = (
    filename: string,
  ): ExtraOccasionExportOptions => ({
    suguan: previewSuguan,
    members,
    voices,
    organistaAssignments,
    pagsasanay,
    pagtupad,
    showFooterSignatories,
    localeName: churchName,
    docFormat: draft.docFormat,
    filename,
  })

  const requestFileExport = (
    kind: 'pdf' | 'xlsx' | 'docx',
    label: string,
  ) => {
    if (draft.schedules.length === 0) {
      toast.error('Add at least one worship schedule first.')
      return
    }
    if (pagsasanay.enabled && (!isDateKey(pagsasanay.date) || !pagsasanay.label.trim())) {
      toast.error('Enter a valid date and label for the Pagsasanay column.')
      return
    }
    if (pagtupad.enabled && (!isDateKey(pagtupad.date) || !pagtupad.label.trim())) {
      toast.error('Enter a valid date and label for the Pagtupad column.')
      return
    }
    const filename = exportFileName('Extra Occasion Suguan', kind)
    requestExport({
      filename,
      confirmLabel: `Export ${label}`,
      onConfirm: () => void runExport(kind, filename),
    })
  }

  const runExport = async (
    kind: 'pdf' | 'xlsx' | 'docx',
    filename: string,
  ) => {
    setExporting(kind)
    const options = exportOptions(filename)
    try {
      if (kind === 'pdf') await exportExtraOccasionPdf(options)
      else if (kind === 'xlsx') await exportExtraOccasionExcel(options)
      else await exportExtraOccasionDocx(options)
      toast.success(`Extra Occasion Suguan exported as ${kind.toUpperCase()}.`)
    } catch (error) {
      console.error(error)
      toast.error(`Could not export Extra Occasion Suguan as ${kind.toUpperCase()}.`)
    } finally {
      setExporting(null)
    }
  }

  const saveRecord = () => {
      if (!can(existingRecord ? 'edit-suguan' : 'create-suguan')) {
        toast.error('You do not have permission to save this Suguan.')
        return
      }
      if (draft.schedules.length === 0) {
        toast.error('Add at least one worship schedule before saving.')
        return
      }
      if (pagsasanay.enabled && (!isDateKey(pagsasanay.date) || !pagsasanay.label.trim())) {
        toast.error('Enter a valid date and label for the Pagsasanay column.')
        return
      }
      if (pagtupad.enabled && (!isDateKey(pagtupad.date) || !pagtupad.label.trim())) {
        toast.error('Enter a valid date and label for the Pagtupad column.')
        return
      }
      const extraOccasion: ExtraOccasionSuguanConfig = {
        localeName: churchName,
        pagsasanay,
        pagtupad,
        showFooterSignatories,
        organistaAssignments,
      }
      const preview = buildPreviewSuguan(draft)
      const date = pagsasanay.enabled
        ? pagsasanay.date
        : pagtupad.enabled
          ? pagtupad.date
          : ''
      setSaving(true)
      try {
        if (existingRecord) {
          updateSuguan(existingRecord.id, {
            date,
            time: '',
            serviceTypeId: preview.serviceTypeId,
            group: preview.group,
            docFormat: preview.docFormat,
            coverage: null,
            events: [],
            schedules: preview.schedules,
            voiceCapacities: preview.voiceCapacities,
            assignments: preview.assignments,
            dutyRoles: preview.dutyRoles,
            destinadoName: preview.destinadoName,
            pagsasanayDate: pagsasanay.enabled ? pagsasanay.date : '',
            pagtupadDate: pagtupad.enabled ? pagtupad.date : '',
            extraOccasion,
          })
          toast.success('Extra Occasion Suguan updated.')
          openSuguanDetail(existingRecord.id)
        } else {
          const saved = createSuguan({
            date,
            time: '',
            serviceTypeId: draft.serviceTypeId,
            group: draft.group,
            docFormat: draft.docFormat,
            coverage: null,
            events: [],
            pagsasanayDate: pagsasanay.enabled ? pagsasanay.date : '',
            pagtupadDate: pagtupad.enabled ? pagtupad.date : '',
            schedules: draft.schedules,
            voiceCapacities: preview.voiceCapacities,
            assignments: preview.assignments,
            dutyRoles: draft.dutyRoles,
            destinadoName: draft.destinadoName,
            extraOccasion,
          })
          toast.success('Extra Occasion Suguan saved to history.')
          openSuguanDetail(saved.id)
        }
      } catch (error) {
        console.error(error)
        toast.error('Could not save the Extra Occasion Suguan.')
      } finally {
        setSaving(false)
    }
  }

  const addOrganista = () => {
    if (!organistaScheduleId || !organistaMemberId) return
    setOrganistaAssignments((current) => ({
      ...current,
      [organistaScheduleId]: [
        ...(current[organistaScheduleId] ?? []),
        { memberId: organistaMemberId, role: organistaRole },
      ],
    }))
    setOrganistaMemberId('')
  }

  const removeOrganista = (scheduleId: string, memberId: string) => {
    setOrganistaAssignments((current) => ({
      ...current,
      [scheduleId]: (current[scheduleId] ?? []).filter(
        (assignment) => assignment.memberId !== memberId,
      ),
    }))
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      {exportPreview}
      <PageHeader
        title="Extra Occasion Suguan"
        description="Create a voice-sectioned choir sign-up sheet with custom dates, labels, and signatories."
      />

      <section className="space-y-5 rounded-xl border border-border/70 bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="extra-occasion-locale">Locale Congregation Name</Label>
            <Input
              id="extra-occasion-locale"
              value={churchName}
              onChange={(event) => setChurchName(event.target.value)}
              placeholder="e.g. Sta. Monica"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Choir</Label>
            <Select
              value={draft.group}
              onValueChange={(value) => {
                if (isSuguanGroup(value)) patch({ group: value })
              }}
            >
              <SelectTrigger aria-label="Choir group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {[
            {
              id: 'pagsasanay',
              title: 'Pagsasanay column',
              value: pagsasanay,
              setValue: setPagsasanay,
              accent: 'text-amber-700',
            },
            {
              id: 'pagtupad',
              title: 'Pagtupad column',
              value: pagtupad,
              setValue: setPagtupad,
              accent: 'text-emerald-700',
            },
          ].map(({ id, title, value, setValue, accent }) => (
            <div key={id} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`extra-occasion-${id}-enabled`}
                  checked={value.enabled}
                  onCheckedChange={(checked) =>
                    setValue((current) => ({
                      ...current,
                      enabled: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor={`extra-occasion-${id}-enabled`}
                  className={`font-semibold ${accent}`}
                >
                  Include {title}
                </Label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`extra-occasion-${id}-label`}>Column label</Label>
                  <Input
                    id={`extra-occasion-${id}-label`}
                    value={value.label}
                    disabled={!value.enabled}
                    onChange={(event) =>
                      setValue((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`extra-occasion-${id}-date`}>Custom date</Label>
                  <Input
                    id={`extra-occasion-${id}-date`}
                    type="date"
                    value={value.date}
                    disabled={!value.enabled}
                    onChange={(event) =>
                      setValue((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              {value.date && isDateKey(value.date) && (
                <p className="text-xs text-muted-foreground">
                  {formatDateKeyNumeric(value.date)}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="extra-occasion-footer-signatories"
            checked={showFooterSignatories}
            onCheckedChange={(checked) =>
              setShowFooterSignatories(checked === true)
            }
          />
          <Label htmlFor="extra-occasion-footer-signatories">
            Include Pangulong Mang-aawit and Destinado signatories below the table
          </Label>
        </div>

        <details>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4" />
            Document setup
          </summary>
          <div className="mt-4">
            <DocumentSetupStep
              value={draft.docFormat}
              onChange={(docFormat) => patch({ docFormat })}
            />
          </div>
        </details>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-4 text-sm font-semibold">Worship schedules</h2>
        <SchedulesStep draft={draft} patch={patch} />
      </section>

      {draft.schedules.length > 0 && (
        <section className="flex min-h-[32rem] flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">Choir assignments</h2>
            <p className="text-xs text-muted-foreground">
              Names are exported alphabetically within each voice section.
            </p>
          </div>
          <AssignmentWorkspace draft={draft} patch={patch} members={members} />
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold">Organista section</h2>
          <p className="text-xs text-muted-foreground">
            Add active Organista members to each schedule and choose their role.
          </p>
        </div>
        {draft.schedules.length > 0 ? (
          <>
            {canAssignMembers ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Select
                  value={organistaScheduleId}
                  onValueChange={setOrganistaScheduleId}
                >
                  <SelectTrigger aria-label="Organista schedule">
                    <SelectValue placeholder="Choose schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {draft.schedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {schedule.scheduleLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={organistaMemberId}
                  onValueChange={setOrganistaMemberId}
                >
                  <SelectTrigger aria-label="Organista member">
                    <SelectValue placeholder="Choose active Organista" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleOrganistas
                      .filter((member) => !assignedOrganistaIds.has(member.id))
                      .map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.lastName}, {member.firstName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Select
                    value={organistaRole}
                    onValueChange={(value) => {
                      if (isOrganistaRole(value)) setOrganistaRole(value)
                    }}
                  >
                    <SelectTrigger aria-label="Organista role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANISTA_ROLES.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addOrganista}
                    disabled={!organistaScheduleId || !organistaMemberId}
                    aria-label="Add Organista assignment"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your role does not have permission to assign Organista members.
              </p>
            )}
            {sections.map(
              (schedule) =>
                (organistaAssignments[schedule.id] ?? []).length > 0 && (
                  <div key={schedule.id} className="space-y-2">
                    <h3 className="text-xs font-semibold">{schedule.label}</h3>
                    {(organistaAssignments[schedule.id] ?? []).map((assignment) => {
                      const member = members.find(
                        (candidate) => candidate.id === assignment.memberId,
                      )
                      if (!member) return null
                      return (
                        <div
                          key={assignment.memberId}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <span>
                            {member.lastName}, {member.firstName} —{' '}
                            {ORGANISTA_ROLES.find(
                              (role) => role.id === assignment.role,
                            )?.label}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${member.firstName} from ${schedule.label}`}
                            onClick={() =>
                              removeOrganista(schedule.id, member.id)
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                ),
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add a worship schedule to choose Organista members.
          </p>
        )}
      </section>

      {can('export-documents') && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => requestFileExport('pdf', 'PDF')}
            loading={exporting === 'pdf'}
            disabled={exporting !== null}
          >
            <FileDown className="size-4" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => requestFileExport('xlsx', 'Excel')}
            loading={exporting === 'xlsx'}
            disabled={exporting !== null}
          >
            <FileSpreadsheet className="size-4" />
            Export Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => requestFileExport('docx', 'Word')}
            loading={exporting === 'docx'}
            disabled={exporting !== null}
          >
            <FileText className="size-4" />
            Export Word
          </Button>
        </div>
      )}
      {can(existingRecord ? 'edit-suguan' : 'create-suguan') && (
        <div className="flex justify-end">
          <Button onClick={saveRecord} loading={saving} disabled={saving || exporting !== null}>
            {existingRecord ? 'Update History Record' : 'Save to Suguan History'}
          </Button>
        </div>
      )}
    </div>
  )
}
