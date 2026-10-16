import { readdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { ADMIN_ONLY_PERMISSIONS, PERMISSION_DEFINITIONS } from './rbac.ts'

/**
 * The marked arrays live in the migrations, and a later migration can redefine
 * them (0014 empties `admin_only_permissions()`), so read every file in name
 * order and take the LAST occurrence of each marker pair — the one the database
 * is left with.
 */
const migrationsDir = new URL('../../supabase/migrations/', import.meta.url)
const sql = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationsDir), 'utf8'))
  .join('\n')

function extract(begin: string, end: string): string[] {
  const start = sql.lastIndexOf(begin)
  assert.ok(start >= 0, `marker ${begin} is present`)
  const stop = sql.indexOf(end, start)
  assert.ok(stop > start, `marker ${end} follows ${begin}`)
  return [...sql.slice(start + begin.length, stop).matchAll(/'([^']+)'/g)].map(
    (match) => match[1],
  )
}

test('SQL all_permissions() matches rbac.ts', () => {
  assert.deepEqual(
    extract('-- @permissions-begin', '-- @permissions-end'),
    PERMISSION_DEFINITIONS.map((permission) => permission.id),
  )
})

test('SQL admin_only_permissions() matches rbac.ts', () => {
  assert.deepEqual(
    extract('-- @admin-only-begin', '-- @admin-only-end'),
    ADMIN_ONLY_PERMISSIONS,
  )
})
