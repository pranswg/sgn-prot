import type { WriteResult } from '@/api/db'

/**
 * Fire-and-forget server write with optimistic rollback. A store calls this
 * after it has already applied its change locally: if the server write reports
 * an error, the supplied `rollback` restores the previous state and the user is
 * told.
 *
 * The notifier is injected by `App` (from `sonner`), so the store graph never
 * imports a React library and the `node:test` runner stays DOM-free. Until a
 * notifier is registered, failures fall back to `console.error`.
 */
export type WriteNotifier = (message: string) => void

let notify: WriteNotifier = (message) => console.error(message)

export function setWriteNotifier(next: WriteNotifier) {
  notify = next
}

export interface PersistOptions {
  /** Always resolves; never throws (see `src/api/db.ts`). Pass one write, or
   *  several for an action that touches multiple rows (promote, bulk import). */
  write: Promise<WriteResult> | Promise<WriteResult>[]
  /** Restores the state captured before the optimistic change. */
  rollback: () => void
  /** User-facing copy shown when the write fails. */
  failure: string
}

export function persist({ write, rollback, failure }: PersistOptions) {
  const writes = Array.isArray(write) ? write : [write]
  void Promise.all(writes).then((results) => {
    const failed = results.find((result) => result?.error)
    if (!failed?.error) return
    console.error('Server write failed:', failed.error)
    rollback()
    notify(failure)
  })
}
