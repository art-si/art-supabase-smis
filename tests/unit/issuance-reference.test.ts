import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchIssuanceReference } from '../../src/views/safety-production/shared/issuance-reference'

test('finds the exact record behind another tenant with the same document number', async () => {
  const calls: number[] = []
  const result = await fetchIssuanceReference(
    async ({ from }) => {
      calls.push(from)
      return {
        data:
          from === 0
            ? [{ id: 'other-tenant', issuanceNo: 'ISS-001' }]
            : [{ id: 'target', issuanceNo: 'ISS-001' }],
        total: 2,
        overview: { total: 2 }
      }
    },
    { recordId: 'target', recordNo: 'ISS-001' },
    '发放记录',
    () => undefined
  )

  assert.equal(result.record.id, 'target')
  assert.deepEqual(calls, [0, 1])
})

test('fails closed when the target is absent or the page count is invalid', async () => {
  const target = { recordId: 'target', recordNo: 'ISS-001' }
  await assert.rejects(
    fetchIssuanceReference(
      async () => ({
        data: [{ id: 'other-tenant', issuanceNo: 'ISS-001' }],
        total: 1,
        overview: {}
      }),
      target,
      '发放记录',
      () => undefined
    ),
    /无法定位/
  )
  await assert.rejects(
    fetchIssuanceReference(
      async () => ({ data: [], total: Number.POSITIVE_INFINITY, overview: {} }),
      target,
      '发放记录',
      () => undefined
    ),
    /查询结果异常/
  )
})

test('stops scanning when the tenant scope changes between pages', async () => {
  let scope = 'tenant-a'
  let fetchCount = 0
  await assert.rejects(
    fetchIssuanceReference(
      async () => {
        fetchCount += 1
        scope = 'tenant-b'
        return {
          data: [{ id: 'other', issuanceNo: 'ISS-001' }],
          total: 2,
          overview: {}
        }
      },
      { recordId: 'target', recordNo: 'ISS-001' },
      '发放记录',
      () => {
        if (scope !== 'tenant-a') throw new Error('租户范围已变化')
      }
    ),
    /租户范围已变化/
  )
  assert.equal(fetchCount, 1)
})
