import { nanoid } from 'nanoid'
import { occasionLabel, type ExtraOccasionOccasionState } from './extraOccasionDraft'

/** One occasion inside a planning session. */
export interface PlannerOccasion {
  /** Stable within the session, independent of any saved id or position. */
  localId: string
  /** The saved Suguan id, once this occasion has been saved. */
  savedId: string | null
  state: ExtraOccasionOccasionState
  /** True when there are unsaved edits for this occasion. */
  dirty: boolean
}

/** A Multiple Extra Occasion planning session. */
export interface ExtraOccasionSession {
  batchId: string
  batchName: string
  /** The batch row id once it has been persisted, else null. */
  savedBatchId: string | null
  occasions: PlannerOccasion[]
}

export function createSession(batchName = '', batchId = nanoid()): ExtraOccasionSession {
  return { batchId, batchName, savedBatchId: null, occasions: [] }
}

export function createPlannerOccasion(
  state: ExtraOccasionOccasionState,
  savedId: string | null = null,
): PlannerOccasion {
  return { localId: nanoid(), savedId, state, dirty: false }
}

export function addOccasion(
  session: ExtraOccasionSession,
  occasion: PlannerOccasion,
): ExtraOccasionSession {
  return { ...session, occasions: [...session.occasions, occasion] }
}

export function removeOccasion(
  session: ExtraOccasionSession,
  localId: string,
): ExtraOccasionSession {
  return {
    ...session,
    occasions: session.occasions.filter((occasion) => occasion.localId !== localId),
  }
}

export function updateOccasion(
  session: ExtraOccasionSession,
  localId: string,
  state: ExtraOccasionOccasionState,
): ExtraOccasionSession {
  return {
    ...session,
    occasions: session.occasions.map((occasion) =>
      occasion.localId === localId
        ? { ...occasion, state, dirty: true }
        : occasion,
    ),
  }
}

/** Replace an occasion wholesale (used by conflict moves). */
export function replaceOccasion(
  session: ExtraOccasionSession,
  localId: string,
  occasion: PlannerOccasion,
): ExtraOccasionSession {
  return {
    ...session,
    occasions: session.occasions.map((current) =>
      current.localId === localId ? occasion : current,
    ),
  }
}

export function findOccasion(
  session: ExtraOccasionSession,
  localId: string,
): PlannerOccasion | undefined {
  return session.occasions.find((occasion) => occasion.localId === localId)
}

/**
 * The label shown in the overview and export filename: the plan name, else the
 * service type, else a positional fallback so an unnamed occasion is never
 * blank.
 */
export function plannerOccasionLabel(
  occasion: PlannerOccasion,
  index: number,
): string {
  return occasionLabel(occasion.state) || `Occasion ${index + 1}`
}
