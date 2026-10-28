import { buildSupabaseRpcRange } from '@/utils/supabase'
import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type { ApiFeedbackOptions, ApiRequestOptions } from '@/types/api/request'
import { withRequestOptions } from '@/api/providers/supabase/query'
import { isPlainObjectRecord } from '@/utils/type-guards'
import type {
  SmisSupplier,
  SmisSupplierOverview,
  SmisSupplierSavePayload,
  SmisSupplierSearchParams
} from '@smis/api/types'

interface SupplierListResult {
  records?: SmisSupplier[]
  total?: number
  overview?: SmisSupplierOverview
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

const buildListParams = (params: SmisSupplierSearchParams) => {
  const from = Math.max(params.from ?? 0, 0)
  return {
    ...buildSupabaseRpcRange(from, params.to ?? from + 19),
    p_keyword: normalizeNullableText(params.keyword),
    p_supplier_category: params.supplierCategory || null,
    p_supplier_type: params.supplierType || null,
    p_enterprise_nature: params.enterpriseNature || null,
    p_industry: params.industry || null,
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: params.purpose ?? 'list'
  }
}

export async function fetchSupplierList(
  params: SmisSupplierSearchParams = {},
  options: ApiRequestOptions & ApiFeedbackOptions = {}
): Promise<{
  data: SmisSupplier[]
  total: number
  overview: SmisSupplierOverview | null
  error: unknown
}> {
  const result = await responseHandle<SupplierListResult>(
    () =>
      withRequestOptions(
        supabase.rpc('smis_list_suppliers_secure', buildListParams(params)),
        options
      ),
    { showErrorMessage: options.showErrorMessage ?? true }
  )

  const overview = result.data?.overview
  const validOverview =
    isPlainObjectRecord(overview) &&
    [overview.total, overview.keySuppliers, overview.categoryCount, overview.contactComplete].every(
      (count) => Number.isSafeInteger(count) && count >= 0
    )
      ? overview
      : null
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.error ? null : validOverview,
    error: result.error
  }
}

export async function exportSupplierList(
  params: SmisSupplierSearchParams = {},
  options: ApiRequestOptions & ApiFeedbackOptions = {}
): Promise<{ data: SmisSupplier[]; total: number; error: null }> {
  const data = await loadAllDocumentPages((page) => fetchSupplierList(page, options), {
    ...params,
    purpose: 'export' as const
  })
  return { data, total: data.length, error: null }
}

export async function saveSupplier(params: SmisSupplierSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_supplier_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '供应商已更新' : '供应商已新增'
    }
  )
}
