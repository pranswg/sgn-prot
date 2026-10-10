import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Wraps a state-changing handler so an action button can show a pending state
 * and refuse a second submission. The store writes today resolve synchronously,
 * but the guard and the `pending` flag are the same shape a real backend needs:
 * a click that is already in flight is ignored until it settles, so a slow
 * request cannot enqueue the same record twice.
 *
 * `action` is read through a ref so `run` stays stable across renders and an
 * inline handler does not re-create it on every keystroke.
 */
export function useAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => unknown,
) {
  const [pending, setPending] = useState(false)
  const running = useRef(false)
  const actionRef = useRef(action)

  useEffect(() => {
    actionRef.current = action
  })

  const run = useCallback(async (...args: TArgs) => {
    if (running.current) return
    running.current = true
    setPending(true)
    try {
      await actionRef.current(...args)
    } finally {
      running.current = false
      setPending(false)
    }
  }, [])

  return [run, pending] as const
}
