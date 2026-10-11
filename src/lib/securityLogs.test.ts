import assert from 'node:assert/strict'
import test from 'node:test'
import { auditLogFromRow, loginHistoryFromRow } from './securityLogs.ts'

test('auditLogFromRow maps a server row to a store entry', () => {
  assert.deepEqual(
    auditLogFromRow({
      id: 42,
      actor_id: 'a1',
      actor_name: 'Ada',
      actor_username: 'ada',
      action: 'Created account',
      module: 'User Management',
      affected_user_id: 'u2',
      affected_user_name: 'Bob',
      details: 'note',
      created_at: '2026-10-11T00:00:00.000Z',
    }),
    {
      id: '42',
      actorId: 'a1',
      actorName: 'Ada',
      actorUsername: 'ada',
      action: 'Created account',
      module: 'User Management',
      affectedUserId: 'u2',
      affectedUserName: 'Bob',
      details: 'note',
      createdAt: '2026-10-11T00:00:00.000Z',
    },
  )
})

test('auditLogFromRow turns null optionals into undefined', () => {
  const entry = auditLogFromRow({
    id: 7,
    actor_id: null,
    actor_name: '',
    actor_username: '',
    action: 'x',
    module: '',
    affected_user_id: null,
    affected_user_name: null,
    details: null,
    created_at: 't',
  })
  assert.equal(entry.actorId, null)
  assert.equal(entry.affectedUserId, undefined)
  assert.equal(entry.affectedUserName, undefined)
  assert.equal(entry.details, undefined)
})

test('loginHistoryFromRow maps a server row and a null ip', () => {
  assert.deepEqual(
    loginHistoryFromRow({
      id: 3,
      user_id: 'u1',
      user_name: 'Ada',
      username: 'ada',
      device: 'Chrome / Windows',
      client_ip: null,
      status: 'successful',
      created_at: '2026-10-11T00:00:00.000Z',
    }),
    {
      id: '3',
      userId: 'u1',
      userName: 'Ada',
      username: 'ada',
      device: 'Chrome / Windows',
      locationIp: '',
      status: 'successful',
      createdAt: '2026-10-11T00:00:00.000Z',
    },
  )
})
