import { useMemo, useState } from 'react'
import {
  CalendarPlus,
  Copy,
  FileDown,
  FileSpreadsheet,
  FileText,
  Pencil,
  Save,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/PageHeader'
import { useExportPreview } from '@/hooks/useExportPreview'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useExtraOccasionBatchStore } from '@/store/extraOccasionBatchStore'
import { useNavStore } from '@/store/navStore'
import { usePermissions } from '@/hooks/usePermissions'
import { exportFileName } from '@/lib/exportNaming'
import type { Suguan } from '@/core/types/suguan'
import { ExtraOccasionOccasionForm } from './ExtraOccasionOccasionForm'
import { ExtraOccasionConflictDialog } from './ExtraOccasionConflictDialog'
import {
  findOccasion,
  plannerOccasionLabel,
  addOccasion,
  createPlannerOccasion,
  createSession,
  removeOccasion,
  updateOccasion,
  type ExtraOccasionSession,
} from './extraOccasionSession'
import {
  emptyOccasionState,
  occasionSuguanInput,
  occasionStateFromSuguan,
  occasionToConfig,
  removeMemberFromOccasion,
  validateOccasion,
  type ExtraOccasionOccasionState,
} from './extraOccasionDraft'
import {
  comparisonRefs,
  detectMemberConflicts,
  occasionRefFromState,
  type MemberConflict,
} from './extraOccasionConflicts'
import {
  runOccasionExport,
  type ExtraOccasionExportKind,
} from './extraOccasionExportActions'

interface PendingConflict {
  memberId: string
  localId: string
  conflicts: MemberConflict[]
}

/** Stable empty set so the assignment workspace is not re-rendered needlessly. */
const EMPTY_CONFLICTS: Set<string> = new Set()

/** Strips a member from every roster on a saved record. */
function removalPatch(record: Suguan, memberId: string): Partial<Suguan> {
  const config = record.extraOccasion
  return {
    assignments: record.assignments.filter((a) => a.memberId !== memberId),
    schedules: record.schedules.map((section) => ({
      ...section,
      assignments: section.assignments.filter((a) => a.memberId !== memberId),
    })),
    extraOccasion: config
      ? {
          ...config,
          organistaAssignments: Object.fromEntries(
            Object.entries(config.organistaAssignments).map(([key, rows]) => [
              key,
              rows.filter((row) => row.memberId !== memberId),
            ]),
          ),
        }
      : undefined,
  }
}

function isDecided(
  state: ExtraOccasionOccasionState,
  memberId: string,
  otherSuguanId: string,
): boolean {
  return state.straightDecisions.some(
    (decision) =>
      decision.memberId === memberId && decision.otherSuguanId === otherSuguanId,
  )
}

/**
 * The Multiple Extra Occasion planning session. Holds a list of occasions in
 * memory, renders each through the same form the single maker uses, and
 * resolves member conflicts against the other occasions plus saved records.
 */
export function MultipleExtraOccasionPlanner() {
  const { can } = usePermissions()
  const batchId = useNavStore((s) => s.extraOccasionBatchId)
  const setExtraOccasionMode = useNavStore((s) => s.setExtraOccasionMode)
  const batches = useExtraOccasionBatchStore((s) => s.batches)
  const createBatch = useExtraOccasionBatchStore((s) => s.createBatch)
  const renameBatch = useExtraOccasionBatchStore((s) => s.renameBatch)
  const suguan = useSuguanStore((s) => s.suguan)
  const createSuguan = useSuguanStore((s) => s.createSuguan)
  const updateSuguan = useSuguanStore((s) => s.updateSuguan)
  const deleteSuguan = useSuguanStore((s) => s.deleteSuguan)
  const members = useMemberStore((s) => s.members)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const localeName = useSettingsStore((s) => s.localeName)
  const voices = allVoices()
  const serviceTypes = allServiceTypes()
  const canAssignMembers = can('assign-members')

  const [session, setSession] = useState<ExtraOccasionSession>(() => {
    const batch = batches.find((item) => item.id === batchId)
    const records = batchId
      ? suguan.filter((record) => record.extraOccasionBatchId === batchId)
      : []
    const base = createSession(batch?.name ?? '', batchId ?? undefined)
    if (records.length === 0) return base
    return {
      ...base,
      savedBatchId: batch?.id ?? batchId ?? null,
      occasions: records.map((record) =>
        createPlannerOccasion(
          occasionStateFromSuguan(record, voices, serviceTypes),
          record.id,
        ),
      ),
    }
  })
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(
    () => session.occasions[0]?.localId ?? null,
  )
  const [pending, setPending] = useState<PendingConflict[]>([])
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<ExtraOccasionExportKind | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const { exportPreview, requestExport } = useExportPreview()

  const selected =
    (selectedLocalId ? findOccasion(session, selectedLocalId) : undefined) ??
    session.occasions[0] ??
    null
  const selectedIndex = selected
    ? session.occasions.findIndex((o) => o.localId === selected.localId)
    : -1

  const savedRecords = useMemo(
    () => suguan.filter((record) => record.extraOccasion),
    [suguan],
  )

  // Every occasion's conflicting members, so the overview can warn on all of
  // them at once, not only the one being edited.
  const allConflicts = useMemo(() => {
    const result = new Map<string, Set<string>>()
    for (let index = 0; index < session.occasions.length; index += 1) {
      const occasion = session.occasions[index]
      const ref = occasionRefFromState(
        occasion,
        plannerOccasionLabel(occasion, index),
      )
      const others = comparisonRefs(occasion, session.occasions, savedRecords)
      result.set(
        occasion.localId,
        new Set(detectMemberConflicts(ref, others).keys()),
      )
    }
    return result
  }, [session.occasions, savedRecords])

  const conflictIds = selected
    ? (allConflicts.get(selected.localId) ?? EMPTY_CONFLICTS)
    : EMPTY_CONFLICTS

  const updateSelected = (state: ExtraOccasionOccasionState) => {
    if (!selected) return
    setSession((current) => updateOccasion(current, selected.localId, state))
  }

  const handleMembersAdded = (addedIds: string[]) => {
    if (!selected) return
    const label = plannerOccasionLabel(selected, Math.max(selectedIndex, 0))
    const ref = occasionRefFromState(selected, label)
    const others = comparisonRefs(selected, session.occasions, savedRecords)
    // The members are not on the target yet, so widen the ref before comparing.
    const widened = { ...ref, memberIds: [...new Set([...ref.memberIds, ...addedIds])] }
    const map = detectMemberConflicts(widened, others)
    const queued: PendingConflict[] = []
    for (const memberId of addedIds) {
      const conflicts = (map.get(memberId) ?? []).filter(
        (conflict) =>
          !isDecided(
            selected.state,
            memberId,
            conflict.other.savedId ?? conflict.other.key,
          ),
      )
      if (conflicts.length > 0) {
        queued.push({ memberId, localId: selected.localId, conflicts })
      }
    }
    if (queued.length > 0) setPending((current) => [...current, ...queued])
  }

  const resolveNext = () => setPending((current) => current.slice(1))

  const handleMove = () => {
    const item = pending[0]
    if (!item) return
    let next = session
    for (const conflict of item.conflicts) {
      const other = conflict.other
      const sessionOther = next.occasions.find(
        (occasion) => (occasion.savedId ?? occasion.localId) === other.key,
      )
      if (sessionOther) {
        next = updateOccasion(
          next,
          sessionOther.localId,
          removeMemberFromOccasion(sessionOther.state, item.memberId),
        )
        continue
      }
      if (other.savedId) {
        if (!can('edit-suguan')) {
          toast.error(
            'You need permission to edit Suguan to move this member off a saved record.',
          )
          return
        }
        const record = suguan.find((item) => item.id === other.savedId)
        if (record) {
          updateSuguan(record.id, removalPatch(record, item.memberId))
        }
      }
    }
    setSession(next)
    toast.success('Member moved to this occasion.')
    resolveNext()
  }

  const handleStraight = () => {
    const item = pending[0]
    if (!item) return
    const target = findOccasion(session, item.localId)
    if (target) {
      const decisions = [...target.state.straightDecisions]
      for (const conflict of item.conflicts) {
        const otherSuguanId = conflict.other.savedId ?? conflict.other.key
        if (
          !decisions.some(
            (decision) =>
              decision.memberId === item.memberId &&
              decision.otherSuguanId === otherSuguanId,
          )
        ) {
          decisions.push({
            memberId: item.memberId,
            otherSuguanId,
            otherLabel: conflict.other.name,
            at: new Date().toISOString(),
          })
        }
      }
      setSession((current) =>
        updateOccasion(current, target.localId, {
          ...target.state,
          straightDecisions: decisions,
        }),
      )
    }
    resolveNext()
  }

  const handleCancelConflict = () => {
    const item = pending[0]
    if (!item) return
    const target = findOccasion(session, item.localId)
    if (target) {
      setSession((current) =>
        updateOccasion(
          current,
          target.localId,
          removeMemberFromOccasion(target.state, item.memberId),
        ),
      )
    }
    resolveNext()
  }

  const addEmptyOccasion = () => {
    const occasion = createPlannerOccasion(
      emptyOccasionState(voices, serviceTypes, localeName),
    )
    setSession((current) => addOccasion(current, occasion))
    setSelectedLocalId(occasion.localId)
  }

  const duplicateSelected = () => {
    if (!selected) return
    const copy = createPlannerOccasion({
      ...selected.state,
      name: `${selected.state.name} (copy)`.trim(),
    })
    setSession((current) => addOccasion(current, copy))
    setSelectedLocalId(copy.localId)
  }

  const removeSelected = () => {
    if (!selected) return
    if (selected.savedId) {
      if (!can('delete-suguan')) {
        toast.error('You do not have permission to delete a Suguan.')
        return
      }
      setConfirmRemove(true)
      return
    }
    setSession((current) => removeOccasion(current, selected.localId))
    setSelectedLocalId(null)
  }

  const confirmRemoveSelected = () => {
    if (selected?.savedId) deleteSuguan(selected.savedId)
    if (selected) {
      setSession((current) => removeOccasion(current, selected.localId))
    }
    setSelectedLocalId(null)
    setConfirmRemove(false)
  }

  const saveSession = () => {
    for (let index = 0; index < session.occasions.length; index += 1) {
      const occasion = session.occasions[index]
      const problem = validateOccasion(occasion.state)
      if (problem) {
        toast.error(`${plannerOccasionLabel(occasion, index)}: ${problem}`)
        setSelectedLocalId(occasion.localId)
        return
      }
    }
    const needsCreate = session.occasions.some((occasion) => !occasion.savedId)
    const needsEdit = session.occasions.some((occasion) => occasion.savedId)
    if (needsCreate && !can('create-suguan')) {
      toast.error('You do not have permission to save a Suguan.')
      return
    }
    if (needsEdit && !can('edit-suguan')) {
      toast.error('You do not have permission to update a Suguan.')
      return
    }
    setSaving(true)
    try {
      const nextOccasions = session.occasions.map((occasion) => {
        const input = occasionSuguanInput(occasion.state)
        const extraOccasion = occasionToConfig(occasion.state)
        if (occasion.savedId) {
          updateSuguan(occasion.savedId, {
            ...input,
            extraOccasion,
            extraOccasionBatchId: session.batchId,
          })
          return { ...occasion, dirty: false }
        }
        const saved = createSuguan({
          ...input,
          extraOccasion,
          extraOccasionBatchId: session.batchId,
        })
        return { ...occasion, savedId: saved.id, dirty: false }
      })
      let savedBatchId = session.savedBatchId
      if (!savedBatchId) {
        const created = createBatch({
          id: session.batchId,
          name: session.batchName || 'Extra Occasions',
        })
        savedBatchId = created.id
      } else {
        renameBatch(savedBatchId, session.batchName || 'Extra Occasions')
      }
      setSession((current) => ({ ...current, savedBatchId, occasions: nextOccasions }))
      toast.success('Planning session saved to Suguan History.')
    } catch (error) {
      console.error(error)
      toast.error('Could not save the planning session.')
    } finally {
      setSaving(false)
    }
  }

  const requestOccasionExport = (kind: ExtraOccasionExportKind, label: string) => {
    if (!selected) return
    const problem = validateOccasion(selected.state)
    if (problem) {
      toast.error(problem)
      return
    }
    const occasionName = plannerOccasionLabel(selected, Math.max(selectedIndex, 0))
    const filename = exportFileName(`${occasionName} - Extra Occasion Suguan`, kind)
    requestExport({
      filename,
      confirmLabel: `Export ${label}`,
      onConfirm: () => void runExport(kind, filename),
    })
  }

  const runExport = async (kind: ExtraOccasionExportKind, filename: string) => {
    if (!selected) return
    setExporting(kind)
    try {
      await runOccasionExport(kind, selected.state, members, voices, filename)
      toast.success(`Occasion exported as ${kind.toUpperCase()}.`)
    } catch (error) {
      console.error(error)
      toast.error(`Could not export the occasion as ${kind.toUpperCase()}.`)
    } finally {
      setExporting(null)
    }
  }

  const pendingItem = pending[0] ?? null
  const pendingMember = pendingItem
    ? members.find((member) => member.id === pendingItem.memberId) ?? null
    : null
  const pendingOccasion = pendingItem
    ? findOccasion(session, pendingItem.localId)
    : undefined
  const pendingIndex = pendingOccasion
    ? session.occasions.findIndex((o) => o.localId === pendingOccasion.localId)
    : -1
  const pendingLabel = pendingOccasion
    ? plannerOccasionLabel(pendingOccasion, Math.max(pendingIndex, 0))
    : ''
  const selectedLabel = selected
    ? plannerOccasionLabel(selected, Math.max(selectedIndex, 0))
    : ''

  /** Any occasion that has never been saved, or has edits since the last save. */
  const hasUnsavedChanges = session.occasions.some(
    (occasion) => occasion.dirty || !occasion.savedId,
  )

  /**
   * Leaving the planner drops the in-memory session, so a session holding work
   * that was never saved asks first. A clean session returns to the chooser
   * straight away.
   */
  const requestCancel = () => {
    if (hasUnsavedChanges) {
      setConfirmCancel(true)
      return
    }
    setExtraOccasionMode('choose')
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      {exportPreview}
      <PageHeader
        title="Multiple Extra Occasions"
        description="Plan several occasions together. Members booked on a shared date are flagged before you commit."
      />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarPlus className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-bold">
              {selected?.savedId ? selectedLabel : 'Add Occasion'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {selected?.savedId
                ? 'Update this occasion and its details.'
                : 'Create a new occasion and set up its details.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={requestCancel}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button
            onClick={saveSession}
            loading={saving}
            disabled={saving || session.occasions.length === 0}
          >
            <Save className="size-4" />
            Save session
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="extra-occasion-draft-name">
            Draft name (optional)
          </Label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Input
              id="extra-occasion-draft-name"
              className="max-w-xl"
              value={session.batchName}
              onChange={(event) =>
                setSession((current) => ({
                  ...current,
                  batchName: event.target.value,
                }))
              }
              placeholder="e.g. Pamamahayag"
            />
            {hasUnsavedChanges && (
              <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Pencil className="size-3.5" aria-hidden="true" />
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Occasions</h2>
          <Button variant="outline" size="sm" onClick={addEmptyOccasion}>
            <CalendarPlus className="size-4" />
            Add occasion
          </Button>
        </div>

        {session.occasions.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No occasions yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the first occasion to begin planning.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {session.occasions.map((occasion) => {
              const active = selected?.localId === occasion.localId
              const conflictCount = allConflicts.get(occasion.localId)?.size ?? 0
              return (
                <li key={occasion.localId}>
                  <button
                    type="button"
                    onClick={() => setSelectedLocalId(occasion.localId)}
                    className={
                      'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ' +
                      (active
                        ? 'border-primary bg-accent'
                        : 'border-border/60 hover:bg-accent')
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {occasion.state.name.trim() || 'Draft'}
                      </span>
                      {occasion.dirty ? (
                        <span className="block text-xs text-muted-foreground">
                          Unsaved changes
                        </span>
                      ) : occasion.savedId ? (
                        <span className="block text-xs text-muted-foreground">
                          Saved
                        </span>
                      ) : null}
                    </span>
                    {conflictCount > 0 && (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <TriangleAlert className="size-3.5" />
                        {conflictCount}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {selected ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary"
                onClick={duplicateSelected}
              >
                <Copy className="size-4" />
                Duplicate
              </Button>
              <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={removeSelected}
              >
                <Trash2 className="size-4" />
                Remove occasion
              </Button>
            </div>
            <ExtraOccasionOccasionForm
              state={selected.state}
              onChange={updateSelected}
              members={members}
              serviceTypes={serviceTypes}
              canAssignMembers={canAssignMembers}
              idPrefix={`occasion-${selected.localId}`}
              conflictIds={conflictIds}
              onMembersAdded={handleMembersAdded}
            />
          </section>

          {/* One row of short export buttons on a phone; the labelled buttons
              from sm up, where there is room for them. */}
          <section className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            {can('export-documents') && (
              <>
                <Button
                  variant="outline"
                  onClick={() => requestOccasionExport('pdf', 'PDF')}
                  loading={exporting === 'pdf'}
                  disabled={exporting !== null}
                >
                  <FileDown className="size-4" />
                  <span>
                    <span className="hidden sm:inline">Export </span>PDF
                  </span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => requestOccasionExport('xlsx', 'Excel')}
                  loading={exporting === 'xlsx'}
                  disabled={exporting !== null}
                >
                  <FileSpreadsheet className="size-4" />
                  <span>
                    <span className="hidden sm:inline">Export </span>Excel
                  </span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => requestOccasionExport('docx', 'Word')}
                  loading={exporting === 'docx'}
                  disabled={exporting !== null}
                >
                  <FileText className="size-4" />
                  <span>
                    <span className="hidden sm:inline">Export </span>Word
                  </span>
                </Button>
              </>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-dashed px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Add or select an occasion to start editing.
          </p>
        </section>
      )}

      <ExtraOccasionConflictDialog
        open={pendingItem !== null}
        member={pendingMember}
        conflicts={pendingItem?.conflicts ?? []}
        targetLabel={pendingLabel}
        onMove={handleMove}
        onStraight={handleStraight}
        onCancel={handleCancelConflict}
      />

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this occasion?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {selectedLabel} from the planning session and deletes
              its saved Suguan record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmRemoveSelected}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this planning session?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved occasions will be lost. Anything already saved stays
              in Suguan History.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => setExtraOccasionMode('choose')}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
