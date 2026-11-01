import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import TreeUtils from '@/utils/tree'
import type {
  SmisEquipmentCategory,
  SmisEquipmentCategoryOverview,
  SmisEquipmentCategorySavePayload,
  SmisEquipmentCategorySearchParams,
  SmisEquipmentInspectionCategory
} from '@smis/api/types'

interface EquipmentCategoryProfile {
  id: string
  tenantId?: string
  profileType: SmisEquipmentCategory['profileType']
}

interface EquipmentCategoryListResult {
  records?: SmisEquipmentCategory[]
  total?: number
  tree?: SmisEquipmentCategory[]
  inspectionOptions?: SmisEquipmentInspectionCategory[]
  overview?: SmisEquipmentCategoryOverview
}

const emptyOverview = (): SmisEquipmentCategoryOverview => ({
  total: 0,
  enabled: 0,
  rootCount: 0,
  linkedCount: 0
})

const treeUtils = new TreeUtils({
  idKey: 'id',
  parentKey: 'parentId',
  childrenKey: 'children'
})
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export const compareEquipmentCategoryOrder = (
  left: SmisEquipmentCategory,
  right: SmisEquipmentCategory
): number =>
  (left.sort ?? 0) - (right.sort ?? 0) ||
  left.categoryName.localeCompare(right.categoryName, 'zh-CN')

export async function fetchEquipmentCategoryProfiles() {
  return await responseHandle<EquipmentCategoryProfile[]>(
    () => supabase.rpc('smis_list_equipment_category_profiles_secure'),
    { showErrorMessage: false, breakReturn: true }
  )
}

export async function fetchEquipmentCategoryList(params: SmisEquipmentCategorySearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const [result, profileResult] = await Promise.all([
    responseHandle<EquipmentCategoryListResult>(
      () =>
        supabase.rpc('smis_list_equipment_categories_secure', {
          ...buildSupabaseRpcRange(from, params.to ?? from + 19),
          p_keyword: normalizeNullableText(params.keyword),
          p_status: params.status || null,
          p_ancestor_id: params.ancestorId || null
        }),
      { showErrorMessage: false, breakReturn: true }
    ),
    fetchEquipmentCategoryProfiles()
  ])

  const profileMap = new Map(
    (profileResult.data ?? []).map((item) => [item.id, item.profileType] as const)
  )
  const enrichProfile = (item: SmisEquipmentCategory): SmisEquipmentCategory => ({
    ...item,
    profileType: profileMap.get(item.id || '') ?? item.profileType ?? 'general'
  })

  const flatTree = (result.data?.tree ?? []).map((item) => ({
    ...enrichProfile(item),
    childCount: item.childCount ?? 0,
    inspectionCategories: item.inspectionCategories ?? []
  }))

  return {
    data: (result.data?.records ?? []).map(enrichProfile),
    total: result.data?.total ?? 0,
    tree: treeUtils.listToTree(flatTree, compareEquipmentCategoryOrder),
    inspectionOptions: result.data?.inspectionOptions ?? [],
    overview: result.data?.overview ?? emptyOverview(),
    error: result.error
  }
}

export async function saveEquipmentCategory(params: SmisEquipmentCategorySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_equipment_category_profile_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '设备分类已更新' : '设备分类已新增'
    }
  )
}

export async function deleteEquipmentCategories(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_equipment_categories_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '设备分类已删除'
    }
  )
}
