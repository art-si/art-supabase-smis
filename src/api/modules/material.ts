import type { ApiFeedbackOptions } from '@/types/api/request'
import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import TreeUtils from '@/utils/tree'
import type {
  SmisMaterial,
  SmisMaterialCategory,
  SmisMaterialCategoryOverview,
  SmisMaterialCategorySavePayload,
  SmisMaterialCategorySearchParams,
  SmisMaterialOverview,
  SmisMaterialSavePayload,
  SmisMaterialSearchParams,
  SmisMaterialTypeOption,
  SmisMaterialUnitOption
} from '@smis/api/types'

interface MaterialCategoryListResult {
  records?: SmisMaterialCategory[]
  total?: number
  tree?: SmisMaterialCategory[]
  overview?: SmisMaterialCategoryOverview
}

interface MaterialListResult {
  records?: SmisMaterial[]
  total?: number
  categoryTree?: SmisMaterialCategory[]
  overview?: SmisMaterialOverview
  materialTypes?: SmisMaterialTypeOption[]
  units?: SmisMaterialUnitOption[]
}

const categoryTreeUtils = new TreeUtils({
  idKey: 'id',
  parentKey: 'parentId',
  childrenKey: 'children'
})
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

const emptyCategoryOverview = (): SmisMaterialCategoryOverview => ({
  total: 0,
  enabled: 0,
  rootCount: 0,
  usedCount: 0
})

const emptyMaterialOverview = (): SmisMaterialOverview => ({
  total: 0,
  enabled: 0,
  protectiveEquipment: 0,
  pictured: 0
})

const buildCategoryTree = (items: SmisMaterialCategory[]): SmisMaterialCategory[] =>
  categoryTreeUtils.listToTree(
    items,
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.categoryName.localeCompare(b.categoryName, 'zh-CN')
  )

export async function fetchMaterialCategoryList(params: SmisMaterialCategorySearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<MaterialCategoryListResult>(
    () =>
      supabase.rpc('smis_list_material_categories_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_ancestor_id: params.ancestorId || null
      }),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    tree: buildCategoryTree(result.data?.tree ?? []),
    overview: result.data?.overview ?? emptyCategoryOverview(),
    error: result.error
  }
}

export async function saveMaterialCategory(params: SmisMaterialCategorySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_material_category_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '物料类别已更新' : '物料类别已新增'
    }
  )
}

export async function deleteMaterialCategories(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_material_categories_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '物料类别已删除'
    }
  )
}

export async function fetchMaterialList(
  params: SmisMaterialSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<MaterialListResult>(
    () =>
      supabase.rpc('smis_list_materials_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_material_name: normalizeNullableText(params.materialName),
        p_material_code: normalizeNullableText(params.materialCode),
        p_specification_model: normalizeNullableText(params.specificationModel),
        p_drawing_no: normalizeNullableText(params.drawingNo),
        p_category_id: params.categoryId || null,
        p_material_type: params.materialType || null,
        p_material_source: params.materialSource || null,
        p_status: params.status || null,
        p_ids: params.ids?.length ? params.ids : null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    categoryTree: buildCategoryTree(result.data?.categoryTree ?? []),
    overview: result.data?.overview ?? emptyMaterialOverview(),
    materialTypes: result.data?.materialTypes ?? [],
    units: result.data?.units ?? [],
    error: result.error
  }
}

export async function saveMaterial(params: SmisMaterialSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_material_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '物料信息已更新' : '物料信息已新增'
    }
  )
}

export async function deleteMaterials(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_materials_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '物料信息已删除'
    }
  )
}
