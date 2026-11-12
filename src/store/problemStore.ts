import { create } from 'zustand'

/**
 * A blocking problem the user must clear before an action can proceed — a save
 * blocker, a failed validation, or a missing permission. Unlike a transient
 * `sonner` toast (which auto-dismisses and is easy to miss), these hold the
 * screen until acknowledged, so a blocked action never looks like it silently
 * succeeded.
 *
 * One app-level `<ProblemDialogHost>` renders this state, and `showProblems`
 * opens it imperatively from anywhere — a page handler, a save gate, an admin
 * form — without threading a hook or local state into every caller. The list is
 * what makes the shared dialog worth having: several problems surface together
 * instead of only the first, as `toast.error(blockers[0])` used to.
 */
interface ProblemState {
  open: boolean
  title: string
  description: string
  problems: string[]
  show: (
    problems: readonly string[],
    options?: { title?: string; description?: string },
  ) => void
  close: () => void
}

export const PROBLEM_DEFAULT_TITLE = 'Fix these before continuing'

export const useProblemStore = create<ProblemState>((set) => ({
  open: false,
  title: PROBLEM_DEFAULT_TITLE,
  description: '',
  problems: [],
  show: (problems, options) =>
    set({
      // Drop blank entries so a caller can pass an array of optional messages.
      problems: problems.filter((problem) => problem.trim().length > 0),
      title: options?.title?.trim() || PROBLEM_DEFAULT_TITLE,
      description: options?.description?.trim() ?? '',
      open: true,
    }),
  close: () => set({ open: false }),
}))

/**
 * Open the shared problem window. A no-op when there is nothing to report, so a
 * caller can pass a computed list without guarding it first.
 */
export function showProblems(
  problems: readonly string[],
  options?: { title?: string; description?: string },
): void {
  const list = problems.filter((problem) => problem.trim().length > 0)
  if (list.length === 0) return
  useProblemStore.getState().show(list, options)
}
