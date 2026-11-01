import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  SmisEquipmentDepreciation,
  SmisEquipmentDepreciationOverview,
  SmisEquipmentDepreciationSavePayload,
  SmisEquipmentDepreciationSearchParams
} from '@smis/api/types'

interface EquipmentDepreciationListResult {
  records?: SmisEquipmentDepreciation[]
  total?: number
  overview?: SmisEquipmentDepreciationOverview
}
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchEquipmentDepreciationList(
  params: SmisEquipmentDepreciationSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<EquipmentDepreciationListResult>(
    () =>
      supabase.rpc('smis_list_equipment_depreciations_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null
      }),
    { showErrorMessage: false, breakReturn: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      total: 0,
      active: 0,
      averageYears: 0,
      configuredRateCount: 0
    },
    error: result.error
  }
}

export async function saveEquipmentDepreciation(params: SmisEquipmentDepreciationSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_equipment_depreciation_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '折旧方法已更新' : '折旧方法已新增'
    }
  )
}

export async function deleteEquipmentDepreciations(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_equipment_depreciations_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '折旧方法已删除'
    }
  )
}
