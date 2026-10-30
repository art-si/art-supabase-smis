interface StorageLocationReference {
  dependencyCode: string
  targetId: string
}

/** A selected direct child is removed in the same secure RPC, so it does not block its parent. */
export function filterSelectedStorageLocationChildren<T extends StorageLocationReference>(
  references: T[],
  selectedIds: readonly string[]
): T[] {
  const selected = new Set(selectedIds)
  return references.filter(
    (reference) =>
      reference.dependencyCode !== 'mdm_storage_location' || !selected.has(reference.targetId)
  )
}
