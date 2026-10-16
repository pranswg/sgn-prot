import { useState } from 'react'
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { useExportPreview } from '@/hooks/useExportPreview'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useNavStore } from '@/store/navStore'
import { usePermissions } from '@/hooks/usePermissions'
import { exportFileName } from '@/lib/exportNaming'
import { ExtraOccasionOccasionForm } from './ExtraOccasionOccasionForm'
import {
  emptyOccasionState,
  occasionStateFromSuguan,
  occasionSuguanInput,
  occasionToConfig,
  validateOccasion,
  type ExtraOccasionOccasionState,
} from './extraOccasionDraft'
import {
  runOccasionExport,
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
  const members = useMemberStore((state) => state.members)
  const allVoices = useSettingsStore((state) => state.allVoices)
  const allServiceTypes = useSettingsStore((state) => state.allServiceTypes)
  const canAssignMembers = can('assign-members')
  const voices = allVoices()
  const serviceTypes = allServiceTypes()

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
  const [exporting, setExporting] = useState<ExtraOccasionExportKind | null>(null)
  const [saving, setSaving] = useState(false)
  const { exportPreview, requestExport } = useExportPreview()

  const requestFileExport = (
    kind: ExtraOccasionExportKind,
    label: string,
  ) => {
    const problem = validateOccasion(state)
    if (problem) {
      toast.error(problem)
      return
    }
    const filename = exportFileName('Extra Occasion Suguan', kind)
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

  const saveRecord = () => {
    if (!can(existingRecord ? 'edit-suguan' : 'create-suguan')) {
      toast.error('You do not have permission to save this Suguan.')
      return
    }
    const problem = validateOccasion(state)
    if (problem) {
      toast.error(problem)
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
    <div className="flex flex-col gap-5 pb-10">
      {exportPreview}
      <PageHeader
        title="Extra Occasion Suguan"
        description="Create a voice-sectioned choir sign-up sheet with its own dates, labels, and signatories."
      />

      <section className="space-y-5">
        <ExtraOccasionOccasionForm
          state={state}
          onChange={setState}
          members={members}
          serviceTypes={serviceTypes}
          canAssignMembers={canAssignMembers}
        />
      </section>

      {can('export-documents') && (
        <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-wrap">
          <Button
            variant="outline"
            onClick={() => requestFileExport('pdf', 'PDF')}
            loading={exporting === 'pdf'}
            disabled={exporting !== null}
          >
            <FileDown className="size-4" />
            <span>
              <span className="hidden lg:inline">Export </span>PDF
            </span>
          </Button>
          <Button
            variant="outline"
            onClick={() => requestFileExport('xlsx', 'Excel')}
            loading={exporting === 'xlsx'}
            disabled={exporting !== null}
          >
            <FileSpreadsheet className="size-4" />
            <span>
              <span className="hidden lg:inline">Export </span>Excel
            </span>
          </Button>
          <Button
            variant="outline"
            onClick={() => requestFileExport('docx', 'Word')}
            loading={exporting === 'docx'}
            disabled={exporting !== null}
          >
            <FileText className="size-4" />
            <span>
              <span className="hidden lg:inline">Export </span>Word
            </span>
          </Button>
        </div>
      )}
      {can(existingRecord ? 'edit-suguan' : 'create-suguan') && (
        <div className="flex justify-end">
          <Button
            className="w-full justify-center lg:w-auto"
            onClick={saveRecord}
            loading={saving}
            disabled={saving || exporting !== null}
          >
            {existingRecord ? 'Update History Record' : 'Save to Suguan History'}
          </Button>
        </div>
      )}
    </div>
  )
}
