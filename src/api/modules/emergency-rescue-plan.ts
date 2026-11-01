import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import { buildOrganizationTree } from './organization-tree'
import type {
  SmisEmergencyRescuePlanListResult,
  SmisEmergencyRescuePlanSavePayload,
  SmisEmergencyRescuePlanSearchParams,
  SmisTreeOrganization
} from '@smis/api/types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
export async function fetchEmergencyRescuePlanList(
  params: SmisEmergencyRescuePlanSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisEmergencyRescuePlanListResult>>(
    () =>
      supabase.rpc('smis_list_emergency_rescue_plans_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_plan_category: params.planCategory || null,
        p_organization_id: params.organizationId || null,
        p_is_valid: params.isValid ?? null,
        p_warning_status: params.warningStatus || null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? { total: 0, valid: 0, warning: 0, submitted: 0 },
    organizations: buildOrganizationTree<SmisTreeOrganization>(result.data?.organizations ?? []),
    positions: result.data?.positions ?? [],
    error: result.error
  }
}

export async function saveEmergencyRescuePlan(
  params: SmisEmergencyRescuePlanSavePayload,
  submit = false
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_emergency_rescue_plan_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id'])),
        p_submit: submit
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: submit ? '应急预案已保存并提交' : '应急预案已保存'
    }
  )
}

export async function deleteEmergencyRescuePlans(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_emergency_rescue_plans_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '应急预案已删除'
    }
  )
}

export async function setEmergencyRescuePlanValidity(ids: string[], isValid: boolean) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_set_emergency_rescue_plan_validity_secure', {
        p_ids: ids,
        p_is_valid: isValid
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: isValid ? '应急预案已恢复有效' : '应急预案已置废'
    }
  )
}

export async function pushEmergencyRescuePlan(planId: string) {
  return await responseHandle<string>(
    () => supabase.rpc('smis_push_emergency_rescue_plan_to_drill_secure', { p_plan_id: planId }),
    { showMessage: true, breakReturn: true, message: '已下推演练计划草稿' }
  )
}

export async function fetchActiveEmergencyRescuePlanOptions() {
  const result = await responseHandle<
    Array<{
      id: string
      planNo: string
      planName: string
      planVersion?: string | null
      planCategory: string
      applicableOrganizationId: string
      applicableOrganizationName: string
      isPublicScope: boolean
    }>
  >(() => supabase.rpc('smis_list_active_emergency_rescue_plan_options_secure'), {
    showErrorMessage: true
  })
  return result.data ?? []
}
