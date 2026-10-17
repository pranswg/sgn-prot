import { useCallback, useMemo, useState } from 'react'
import type { ExtraOccasionStraightDecision } from '@/core/types/suguan'
import {
  appendStraightDecisions,
  conflictingMemberIds,
  pendingConflictsForAdded,
  type MemberConflict,
  type OccasionRef,
  type PendingOccasionConflict,
} from './extraOccasionConflicts'

export interface UseOccasionConflictsOptions {
  /** The occasion being edited: its `localId` in the planner, or its own key. */
  targetKey: string
  /** The same occasion as a comparison ref. */
  targetRef: OccasionRef
  /** Every live occasion to compare against (`comparisonRefs`). */
  others: OccasionRef[]
  /** The target's recorded "Straight" choices. */
  decisions: ExtraOccasionStraightDecision[]
  onDecisions: (
    targetKey: string,
    decisions: ExtraOccasionStraightDecision[],
  ) => void
  /** Strips a member from the target occasion (the Cancel choice). */
  onRemoveFromTarget: (targetKey: string, memberId: string) => void
  /**
   * Removes the member from every other occasion they serve (the Move choice).
   * Return false to leave the dialog open, for a move the caller cannot make.
   */
  onMove: (
    targetKey: string,
    memberId: string,
    conflicts: MemberConflict[],
  ) => boolean
}

export interface OccasionConflicts {
  /** Members booked in another live occasion, for the yellow warning. */
  conflictIds: Set<string>
  pending: PendingOccasionConflict[]
  pendingItem: PendingOccasionConflict | null
  /** Call with the ids an assignment edit just added to the roster. */
  queueMembers: (addedIds: string[]) => void
  move: () => void
  straight: () => void
  cancel: () => void
}

/**
 * The conflict behaviour shared by the Extra Occasion single maker and the
 * Multiple planner: the yellow marks on members booked elsewhere, and the queue
 * behind the "already has a suguan" window. The two makers differ only in what
 * their callbacks do, so both resolve conflicts the same way.
 */
export function useOccasionConflicts({
  targetKey,
  targetRef,
  others,
  decisions,
  onDecisions,
  onRemoveFromTarget,
  onMove,
}: UseOccasionConflictsOptions): OccasionConflicts {
  const [pending, setPending] = useState<PendingOccasionConflict[]>([])

  const conflictIds = useMemo(
    () => conflictingMemberIds(targetRef, others),
    [targetRef, others],
  )

  const queueMembers = useCallback(
    (addedIds: string[]) => {
      const queued = pendingConflictsForAdded({
        targetKey,
        addedIds,
        targetRef,
        others,
        decisions,
      })
      if (queued.length > 0) setPending((current) => [...current, ...queued])
    },
    [targetKey, targetRef, others, decisions],
  )

  const resolveNext = useCallback(
    () => setPending((current) => current.slice(1)),
    [],
  )

  const pendingItem = pending[0] ?? null

  const move = useCallback(() => {
    if (!pendingItem) return
    if (!onMove(pendingItem.targetKey, pendingItem.memberId, pendingItem.conflicts)) {
      return
    }
    resolveNext()
  }, [pendingItem, onMove, resolveNext])

  const straight = useCallback(() => {
    if (!pendingItem) return
    onDecisions(
      pendingItem.targetKey,
      appendStraightDecisions(
        decisions,
        pendingItem.memberId,
        pendingItem.conflicts,
        new Date().toISOString(),
      ),
    )
    resolveNext()
  }, [pendingItem, decisions, onDecisions, resolveNext])

  const cancel = useCallback(() => {
    if (!pendingItem) return
    onRemoveFromTarget(pendingItem.targetKey, pendingItem.memberId)
    resolveNext()
  }, [pendingItem, onRemoveFromTarget, resolveNext])

  return { conflictIds, pending, pendingItem, queueMembers, move, straight, cancel }
}
