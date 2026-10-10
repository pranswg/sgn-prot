/**
 * Turn whatever a failed request throws or returns into a readable sentence.
 *
 * Supabase returns plain `PostgrestError` objects (`{ message, code, details }`)
 * rather than `Error` instances, so `String(error)` would render as
 * `[object Object]`. Prefer the API's own `message` (with its code) and fall
 * back to JSON so a failure is never silently opaque.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const message = typeof record.message === 'string' ? record.message.trim() : ''
    const code = typeof record.code === 'string' ? record.code.trim() : ''
    if (message) return code ? `${message} (${code})` : message
    const details = typeof record.details === 'string' ? record.details.trim() : ''
    if (details) return details
    try {
      const json = JSON.stringify(error)
      if (json && json !== '{}') return json
    } catch {
      // Fall through to the generic string form below.
    }
  }
  return String(error)
}
