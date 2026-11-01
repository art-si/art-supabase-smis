import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type { ApiFeedbackOptions } from '@/types/api/request'
import type {
  SmisHazardFactorCategory,
  SmisHazardFactorCategoryOverview,
  SmisHazardFactorCategorySavePayload,
  SmisHazardFactorCategorySearchParams
} from '@smis/api/types'

interface HazardFactorCategoryListResult {
  records?: SmisHazardFactorCategory[]
  total?: number
  overview?: SmisHazardFactorCategoryOverview
}

const emptyOverview = (): SmisHazardFactorCategoryOverview => ({
  total: 0,
  enabled: 0,
  disabled: 0,
  styled: 0
})

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchHazardFactorCategoryList(
  params: SmisHazardFactorCategorySearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<HazardFactorCategoryListResult>(
    () =>
      supabase.rpc('smis_list_hazard_factor_categories_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_factor_type: params.factorType || null,
        p_status: params.status || null,
        p_tag_style: params.tagStyle || null,
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

export async function saveHazardFactorCategory(params: SmisHazardFactorCategorySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_hazard_factor_category_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id', 'tenantId'])),
        p_tenant_id: params.tenantId || null
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '危害因素类别已更新' : '危害因素类别已新增'
    }
  )
}

export async function deleteHazardFactorCategories(ids: string[], tenantId?: string | null) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_delete_hazard_factor_categories_secure', {
        p_ids: ids,
        p_tenant_id: tenantId || null
      }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '危害因素类别已删除'
    }
  )
}
