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
  /** Always resolves; never throws (see `src/api/db.ts`). */
  write: Promise<WriteResult>
  /** Restores the state captured before the optimistic change. */
  rollback: () => void
  /** User-facing copy shown when the write fails. */
  failure: string
}

export function persist({ write, rollback, failure }: PersistOptions) {
  void write.then((result) => {
    if (!result?.error) return
    console.error('Server write failed:', result.error)
    rollback()
    notify(failure)
  })
}
