import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { useSupabase } from '@/hooks/core/useSupabase'
import { withRequestOptions } from '@/api/providers/supabase/query'
import type { ApiRequestOptions } from '@/types/api/request'
import type {
  PositionRiskControl,
  PositionRiskControlSavePayload,
  PositionRiskControlSearchParams,
  SmisPositionOption,
  SmisPositionSearchParams
} from '@smis/api/types'

interface PositionListPayload {
  records: SmisPositionOption[]
  total: number
}

const TABLE_NAME = 'smis_position_risk_control'
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchSmisRiskPositionList(
  params: SmisPositionSearchParams,
  options?: ApiRequestOptions
) {
  if (!params.organizationId) throw new Error('请选择组织后再查询岗位')
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<PositionListPayload>(
    () =>
      withRequestOptions(
        supabase.rpc('smis_list_risk_positions_secure', {
          p_organization_id: params.organizationId,
          ...buildSupabaseRpcRange(from, params.to ?? 499),
          p_keyword: normalizeNullableText(params.keyword)
        }),
        options
      ),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}

export async function fetchPositionRiskControlList(
  params: PositionRiskControlSearchParams,
  options?: ApiRequestOptions
) {
  const from = Math.max(params.from ?? 0, 0)
  const to = Math.max(params.to ?? from + 19, from)
  let query = supabase
    .from(TABLE_NAME)
    .select('*', { count: 'exact' })
    .eq('position_id', params.positionId)
    .order('update_time', { ascending: false })
    .range(from, to)

  query = params.organizationIds?.length
    ? query.in('organization_id', params.organizationIds)
    : query.eq('organization_id', params.organizationId)

  if (params.controlMeasureCategory) {
    query = query.eq('control_measure_category', params.controlMeasureCategory)
  }
  if (params.controlLevel) query = query.eq('control_level', params.controlLevel)
  if (params.hazardLevel) query = query.eq('hazard_level', params.hazardLevel)
  if (params.isSpecialEquipment === 'true' || params.isSpecialEquipment === 'false') {
    query = query.eq('is_special_equipment', params.isSpecialEquipment === 'true')
  }
  if (params.keyword?.trim()) {
    const keyword = params.keyword.trim()
    query = query.or(
      buildOrIlikeFilter(['hazard_factor', 'control_measure', 'standard_basis'], keyword)
    )
  }

  return await responseHandle<PositionRiskControl[]>(() => withRequestOptions(query, options), {
    showErrorMessage: true
  })
}

export async function addPositionRiskControl(payload: PositionRiskControlSavePayload) {
  return await responseHandle(() => supabase.from(TABLE_NAME).insert(keysToSnakeDeep(payload)), {
    showMessage: true,
    message: '隐患控制措施标准已新增',
    breakReturn: true
  })
}

export async function editPositionRiskControl(id: string, payload: PositionRiskControlSavePayload) {
  return await responseHandle(
    () => supabase.from(TABLE_NAME).update(keysToSnakeDeep(payload)).eq('id', id),
    { showMessage: true, message: '隐患控制措施标准已更新', breakReturn: true }
  )
}

export async function deletePositionRiskControls(ids: string[]) {
  return await responseHandle(
    () => supabase.from(TABLE_NAME).delete({ count: 'exact' }).in('id', ids),
    {
      breakReturn: true,
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      message: '隐患控制措施标准已删除'
    }
  )
}
