import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { choirOf } from './choirs.ts'

/**
 * The two choirs were split in the client (store version 8) while the database
 * keeps one row per record. Migration 0017 derives a `choir` column from the
 * JSONB document so the server can address the two lists.
 *
 * These cases pin the derivation to `choirOf()`, the app's only rule for which
 * list a record belongs to: exactly `'pnk'` is PNK and anything else is AWS. The
 * SQL deliberately mirrors that instead of validating the stored string, so a
 * row the app reads as AWS can never be rejected by the database.
 */
const sql = readFileSync(
  new URL(
    '../../supabase/migrations/1791641617_0017_choir_scoping.sql',
    import.meta.url,
  ),
  'utf8',
)

const TABLES = ['members', 'trainees'] as const

for (const table of TABLES) {
  test(`${table} exposes the choir as a generated column`, () => {
    assert.match(
      sql,
      new RegExp(
        `alter table public\\.${table}\\s+add column if not exists choir text\\s+generated always as \\([\\s\\S]*?\\) stored;`,
      ),
    )
  })

  test(`${table} is indexed by choir, because every read is one choir`, () => {
    assert.match(
      sql,
      new RegExp(`create index if not exists ${table}_choir_idx`),
    )
  })
}

test('the generated value mirrors choirOf(), not the raw stored string', () => {
  assert.equal(choirOf({ choir: 'pnk' }), 'pnk')
  assert.equal(choirOf({ choir: 'aws' }), 'aws')
  // Legacy rows, and anything the app does not recognise, read as AWS.
  assert.equal(choirOf({}), 'aws')
  assert.match(
    sql,
    /generated always as \(\s*case when data ->> 'choir' = 'pnk' then 'pnk' else 'aws' end\s*\) stored/,
  )
})
