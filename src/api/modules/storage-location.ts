import type { ApiFeedbackOptions, ApiRequestOptions } from '@/types/api/request'
import { withRequestOptions } from '@/api/providers/supabase/query'
import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { isPlainObjectRecord } from '@/utils/type-guards'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import TreeUtils from '@/utils/tree'
import type {
  SmisStorageLocation,
  SmisStorageLocationOverview,
  SmisStorageLocationSavePayload,
  SmisStorageLocationSearchParams
} from '@smis/api/types'

interface StorageLocationListResult {
  records?: SmisStorageLocation[]
  total?: number
  tree?: SmisStorageLocation[]
  overview?: SmisStorageLocationOverview
}

const treeUtils = new TreeUtils({
  idKey: 'id',
  parentKey: 'parentId',
  childrenKey: 'children'
})
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchStorageLocationList(
  params: SmisStorageLocationSearchParams = {},
  options: ApiRequestOptions & ApiFeedbackOptions = {}
): Promise<{
  data: SmisStorageLocation[]
  total: number
  tree: SmisStorageLocation[] | null
  overview: SmisStorageLocationOverview | null
  error: unknown
}> {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<StorageLocationListResult>(
    () =>
      withRequestOptions(
        supabase.rpc('smis_list_storage_locations_secure', {
          ...buildSupabaseRpcRange(from, params.to ?? from + 19),
          p_keyword: normalizeNullableText(params.keyword),
          p_status: params.status || null,
          p_ancestor_id: params.ancestorId || null
        }),
        options
      ),
    { showErrorMessage: options.showErrorMessage ?? true }
  )

  const sourceTree = result.data?.tree
  const validTree =
    Array.isArray(sourceTree) &&
    sourceTree.every(
      (item) =>
        isPlainObjectRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.locationName === 'string' &&
        (item.parentId == null || typeof item.parentId === 'string')
    )
  const flatTree = (Array.isArray(sourceTree) && validTree ? sourceTree : []).map((item) => ({
    ...item,
    childCount: item.childCount ?? 0
  }))
  const overview = result.data?.overview
  const validOverview =
    isPlainObjectRecord(overview) &&
    [overview.total, overview.enabled, overview.rootCount, overview.managedCount].every(
      (count) => Number.isSafeInteger(count) && count >= 0
    )
      ? overview
      : null

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    tree:
      !result.error && validTree
        ? treeUtils.listToTree(flatTree, (a, b) =>
            a.locationName.localeCompare(b.locationName, 'zh-CN')
          )
        : null,
    overview: result.error ? null : validOverview,
    error: result.error
  }
}

export async function saveStorageLocation(params: SmisStorageLocationSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_storage_location_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '存放位置已更新' : '存放位置已新增'
    }
  )
}

export async function deleteStorageLocations(ids: string[]) {
  const expectedCount = new Set(ids).size
  const result = await responseHandle<number>(
    () => supabase.rpc('smis_delete_storage_locations_secure', { p_ids: ids }),
    {
      showMessage: false,
      showErrorMessage: false,
      breakReturn: true,
      requireAffected: true,
      noAffectedMessage: '所选存放位置未删除，请刷新列表核对权限和引用后重试',
      errorMessage: '存放位置删除失败，请检查关联记录后重试'
    }
  )
  if (typeof result.data !== 'number' || !Number.isSafeInteger(result.data) || result.data <= 0)
    throw new Error('删除结果无法确认，请刷新存放位置列表后重试', { cause: result })
  if (result.data !== expectedCount)
    throw new Error(
      `实际删除 ${result.data} 条，与所选 ${expectedCount} 条不一致，请刷新列表核对后重试`,
      { cause: result }
    )
  return result
}
