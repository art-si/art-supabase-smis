import assert from 'node:assert/strict'
import test from 'node:test'
import { filterSelectedStorageLocationChildren } from '../../src/views/equipment-ledger/storage-location/storage-location-delete-references'

test('selected parent and child can reach confirmation while unrelated references still block', () => {
  const references = [
    { resourceId: 'parent', targetId: 'child', dependencyCode: 'mdm_storage_location' },
    { resourceId: 'parent', targetId: 'equipment', dependencyCode: 'mdm_equipment' },
    { resourceId: 'child', targetId: 'issue', dependencyCode: 'smis_tool_issuance_record' }
  ]

  assert.deepEqual(filterSelectedStorageLocationChildren(references, ['parent', 'child']), [
    references[1],
    references[2]
  ])
  assert.deepEqual(filterSelectedStorageLocationChildren([references[0]], ['parent', 'child']), [])
})

test('an unselected child and all other reference types still block deletion', () => {
  const references = [
    { resourceId: 'parent', targetId: 'child', dependencyCode: 'mdm_storage_location' },
    { resourceId: 'parent', targetId: 'material', dependencyCode: 'mdm_material' },
    { resourceId: 'parent', targetId: 'ppe', dependencyCode: 'smis_ppe_issuance_record' }
  ]

  assert.deepEqual(filterSelectedStorageLocationChildren(references, ['parent']), references)
})
