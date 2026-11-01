import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type { ApiFeedbackOptions } from '@/types/api/request'
import type {
  SmisRiskActivitySavePayload,
  SmisRiskHazardSavePayload,
  SmisRiskHazardWorkspace,
  SmisRiskIdentificationOptions,
  SmisRiskPointListResult,
  SmisRiskPointSavePayload,
  SmisRiskPointSearchParams
} from '@smis/api/types'

const emptyOverview = () => ({ total: 0, identified: 0, specialEquipment: 0, unidentified: 0 })
const emptyOptions = (): SmisRiskIdentificationOptions => ({
  sites: [],
  organizations: [],
  equipment: [],
  hazardCategories: []
})
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchRiskIdentificationOptions() {
  const result = await responseHandle<SmisRiskIdentificationOptions>(
    () => supabase.rpc('smis_list_risk_identification_options_secure'),
    { showErrorMessage: true }
  )
  return result.data ?? emptyOptions()
}

export async function fetchRiskPointList(
  params: SmisRiskPointSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<SmisRiskPointListResult>(
    () =>
      supabase.rpc('smis_list_risk_points_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_organization_id: params.organizationId || null,
        p_site_id: params.siteId || null,
        p_equipment: normalizeNullableText(params.equipment),
        p_risk_level: params.riskLevel || null,
        p_risk_type: params.riskType || null
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

export async function saveRiskPoint(params: SmisRiskPointSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_risk_point_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id', 'organizationIds'])),
        p_organization_ids: params.organizationIds
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '风险点已更新' : '风险点已新增'
    }
  )
}

export async function deleteRiskPoints(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_risk_points_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '风险点已删除'
    }
  )
}

export async function copyRiskPoint(id: string) {
  return await responseHandle<string>(
    () => supabase.rpc('smis_copy_risk_point_secure', { p_id: id }),
    { showMessage: true, breakReturn: true, message: '风险点已复制' }
  )
}

export async function generateAllRiskPoints() {
  return await responseHandle<number>(() => supabase.rpc('smis_generate_all_risk_points_secure'), {
    showMessage: true,
    breakReturn: true,
    message: '已按场所补齐风险点'
  })
}

export async function fetchRiskHazardWorkspace(riskPointId: string) {
  const result = await responseHandle<SmisRiskHazardWorkspace>(
    () =>
      supabase.rpc('smis_list_risk_hazard_workspace_secure', {
        p_risk_point_id: riskPointId
      }),
    { showErrorMessage: true, breakReturn: true }
  )
  return result.data ?? { activities: [], hazards: [] }
}

export async function saveRiskActivity(params: SmisRiskActivitySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_risk_activity_secure', {
        p_id: params.id ?? null,
        p_risk_point_id: params.riskPointId,
        p_activity_name: params.activityName.trim(),
        p_work_step: params.workStep.trim(),
        p_sort: params.sort
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '作业活动已更新' : '作业活动已新增'
    }
  )
}

export async function deleteRiskActivities(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_risk_activities_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '作业活动已删除'
    }
  )
}

export async function saveRiskHazard(params: SmisRiskHazardSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_risk_hazard_secure', {
        p_id: params.id ?? null,
        p_risk_point_id: params.riskPointId,
        p_payload: keysToSnakeDeep(omit(params, ['id', 'riskPointId', 'activityIds'])),
        p_activity_ids: params.activityIds
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '危害因素已更新' : '危害因素已新增'
    }
  )
}

export async function deleteRiskHazards(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_risk_hazards_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '危害因素已删除'
    }
  )
}
