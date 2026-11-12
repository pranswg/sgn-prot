import { useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useExportPreview } from '@/hooks/useExportPreview'
import { useMemberStore } from '@/store/memberStore'
import { membersOf } from '@/lib/choirs'
import { useSettingsStore } from '@/store/settingsStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useNavStore } from '@/store/navStore'
import { showProblems } from '@/store/problemStore'
import { usePermissions } from '@/hooks/usePermissions'
import {
  exportFileName,
  extraOccasionExportDocumentName,
} from '@/lib/exportNaming'
import { openPdfPreviewWindow, showPdfPreview } from '@/lib/pdfPreview'
import { ExtraOccasionOccasionForm } from './ExtraOccasionOccasionForm'
import { ExtraOccasionConflictDialog } from './ExtraOccasionConflictDialog'
import { ExtraOccasionActions } from './ExtraOccasionActions'
import { ExtraOccasionHeader } from './ExtraOccasionHeader'
import {
  emptyOccasionState,
  occasionChoirLabel,
  occasionLabel,
  occasionStateFromSuguan,
  occasionSuguanInput,
  occasionToConfig,
  removeMemberFromOccasion,
  removeMemberFromSuguan,
  validateOccasion,
  type ExtraOccasionOccasionState,
} from './extraOccasionDraft'
import {
  comparisonRefs,
  occasionRefFromInput,
  type MemberConflict,
} from './extraOccasionConflicts'
import { useOccasionConflicts } from './useOccasionConflicts'
import {
  runOccasionExport,
  buildOccasionPdfPreview,
  type ExtraOccasionExportKind,
} from './extraOccasionExportActions'

/**
 * The standalone Extra Occasion maker. Holds exactly one occasion; the Multiple
 * planner is the same form with a list of occasions behind it.
 */
export function ExtraOccasionSingleMaker() {
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
  const suguan = useSuguanStore((state) => state.suguan)
  const allMembers = useMemberStore((state) => state.members)
  const members = useMemo(() => membersOf(allMembers, 'aws'), [allMembers])
  const allVoices = useSettingsStore((state) => state.allVoices)
  const allServiceTypes = useSettingsStore((state) => state.allServiceTypes)
  const canAssignMembers = can('assign-members')
  const voices = allVoices()
  const serviceTypes = allServiceTypes()

  /** Stable identity for a brand-new occasion, before it has a saved id. */
  const [localKey] = useState(() => nanoid())
  const [state, setState] = useState<ExtraOccasionOccasionState>(() =>
    existingRecord
      ? occasionStateFromSuguan(
          existingRecord,
          voices,
          useSettingsStore.getState().allServiceTypes(),
        )
      : emptyOccasionState(
          voices,
          useSettingsStore.getState().allServiceTypes(),
          useSettingsStore.getState().localeName,
        ),
  )
  const [exporting, setExporting] = useState<
    ExtraOccasionExportKind | 'preview' | null
  >(null)
  const [saving, setSaving] = useState(false)
  const { exportPreview, requestExport } = useExportPreview()

  const targetRef = useMemo(
    () =>
      occasionRefFromInput(state, {
        key: existingRecord?.id ?? localKey,
        savedId: existingRecord?.id ?? null,
        label: occasionLabel(state) || 'Extra Occasion',
      }),
    [state, existingRecord, localKey],
  )
  // The single maker holds one occasion, so there is never a sibling session
  // occasion to compare against — only the saved Extra Occasions in History.
  const others = useMemo(() => comparisonRefs(targetRef, [], suguan), [targetRef, suguan])

  /**
   * The Move choice: strip the member from the saved occasion they already
   * serve, so they only remain on this one.
   */
  const moveConflict = (
    _targetKey: string,
    memberId: string,
    memberConflicts: MemberConflict[],
  ): boolean => {
    if (!can('edit-suguan')) {
      showProblems(
        ['You need permission to edit Suguan to move this member off a saved record.'],
        { title: 'You cannot move this member' },
      )
      return false
    }
    for (const conflict of memberConflicts) {
      const savedId = conflict.other.savedId
      if (!savedId) continue
      const record = suguan.find((item) => item.id === savedId)
      if (record) {
        updateSuguan(record.id, removeMemberFromSuguan(record, memberId))
      }
    }
    toast.success('Member moved to this occasion.')
    return true
  }

  const conflicts = useOccasionConflicts({
    targetKey: targetRef.key,
    targetRef,
    others,
    decisions: state.straightDecisions,
    onDecisions: (_targetKey, decisions) =>
      setState((current) => ({ ...current, straightDecisions: decisions })),
    onRemoveFromTarget: (_targetKey, memberId) =>
      setState((current) => removeMemberFromOccasion(current, memberId)),
    onMove: moveConflict,
  })

  const pendingMember = conflicts.pendingItem
    ? members.find((member) => member.id === conflicts.pendingItem?.memberId) ??
      null
    : null

  const requestFileExport = (
    kind: ExtraOccasionExportKind,
    label: string,
  ) => {
    const problem = validateOccasion(state)
    if (problem) {
      showProblems([problem], { title: 'Cannot export yet' })
      return
    }
    const filename = exportFileName(
      extraOccasionExportDocumentName(
        state.name || state.draft.schedules[0]?.scheduleLabel || '',
      ),
      kind,
    )
    requestExport({
      filename,
      confirmLabel: `Export ${label}`,
      onConfirm: () => void runExport(kind, filename),
    })
  }

  const runExport = async (kind: ExtraOccasionExportKind, filename: string) => {
    setExporting(kind)
    try {
      await runOccasionExport(kind, state, members, voices, filename)
      toast.success(`Extra Occasion Suguan exported as ${kind.toUpperCase()}.`)
    } catch (error) {
      console.error(error)
      toast.error(
        `Could not export Extra Occasion Suguan as ${kind.toUpperCase()}.`,
      )
    } finally {
      setExporting(null)
    }
  }

  const previewPdf = () => {
    const problem = validateOccasion(state)
    if (problem) {
      showProblems([problem], { title: 'Cannot preview yet' })
      return
    }
    const previewWindow = openPdfPreviewWindow()
    if (!previewWindow) {
      toast.error('Allow pop-ups to preview the Extra Occasion Suguan PDF.')
      return
    }
    setExporting('preview')
    void (async () => {
      try {
        const blob = await buildOccasionPdfPreview(state, members, voices)
        showPdfPreview(previewWindow, blob, 'Extra Occasion Suguan')
      } catch (error) {
        previewWindow.close()
        console.error(error)
        toast.error('Could not create the Extra Occasion Suguan PDF preview.')
      } finally {
        setExporting(null)
      }
    })()
  }

  const saveRecord = () => {
    if (!can(existingRecord ? 'edit-suguan' : 'create-suguan')) {
      showProblems(['You do not have permission to save this Suguan.'], {
        title: 'You cannot save this Suguan',
      })
      return
    }
    const problem = validateOccasion(state)
    if (problem) {
      showProblems([problem], { title: 'Fix these before saving' })
      return
    }
    const extraOccasion = occasionToConfig(state)
    const input = occasionSuguanInput(state)
    setSaving(true)
    try {
      if (existingRecord) {
        updateSuguan(existingRecord.id, {
          ...input,
          extraOccasion,
        })
        toast.success('Extra Occasion Suguan updated.')
        openSuguanDetail(existingRecord.id)
      } else {
        const saved = createSuguan({
          ...input,
          dutyRoles: state.draft.dutyRoles,
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

  return (
    <div className="occasion-maker">
      {exportPreview}
      <ExtraOccasionHeader
        title="Extra Occasion Suguan"
        subtitle={`${state.name.trim() || 'Extra occasion'} · ${occasionChoirLabel(state.draft.group)}`}
        badge={existingRecord ? 'Editing saved occasion' : 'Single occasion'}
      />

      <ExtraOccasionOccasionForm
        state={state}
        onChange={setState}
        members={members}
        serviceTypes={serviceTypes}
        canAssignMembers={canAssignMembers}
        conflictIds={conflicts.conflictIds}
        onMembersAdded={conflicts.queueMembers}
      />

      <ExtraOccasionConflictDialog
        open={conflicts.pendingItem !== null}
        member={pendingMember}
        conflicts={conflicts.pendingItem?.conflicts ?? []}
        targetLabel={occasionLabel(state) || 'this occasion'}
        onMove={conflicts.move}
        onStraight={conflicts.straight}
        onCancel={conflicts.cancel}
      />

      <ExtraOccasionActions
        canExport={can('export-documents')}
        exporting={exporting}
        onPreview={previewPdf}
        onExport={requestFileExport}
      >
        {can(existingRecord ? 'edit-suguan' : 'create-suguan') && (
          <Button
            onClick={saveRecord}
            loading={saving}
            disabled={saving || exporting !== null}
          >
            <Save className="size-4" />
            {existingRecord ? 'Update History Record' : 'Save to Suguan History'}
          </Button>
        )}
      </ExtraOccasionActions>
    </div>
  )
}
