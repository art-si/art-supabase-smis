import type { ApiFeedbackOptions } from '@/types/api/request'
import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  SmisInspectionCategory,
  SmisInspectionCategoryOverview,
  SmisInspectionCategorySavePayload,
  SmisInspectionCategorySearchParams
} from '@smis/api/types'

interface InspectionCategoryListResult {
  records?: SmisInspectionCategory[]
  total?: number
  overview?: SmisInspectionCategoryOverview
}

const emptyOverview = (): SmisInspectionCategoryOverview => ({
  total: 0,
  enabled: 0,
  disabled: 0,
  recentlyUpdated: 0
})

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchInspectionCategoryList(
  params: SmisInspectionCategorySearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<InspectionCategoryListResult>(
    () =>
      supabase.rpc('smis_list_inspection_categories_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_tenant_id: params.tenantId || null
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyOverview(),
    error: result.error
  }
}

export async function saveInspectionCategory(params: SmisInspectionCategorySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_inspection_category_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id', 'tenantId'])),
        p_tenant_id: params.tenantId || null
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '检验类别已更新' : '检验类别已新增'
    }
  )
}

export async function deleteInspectionCategories(ids: string[], tenantId?: string | null) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_delete_inspection_categories_secure', {
        p_ids: ids,
        p_tenant_id: tenantId || null
      }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '检验类别已删除'
    }
  )
}
