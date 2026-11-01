import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import { buildOrganizationTree } from './organization-tree'
import type {
  SmisEmergencyDrillPlanListResult,
  SmisEmergencyDrillPlanSavePayload,
  SmisEmergencyDrillPlanSearchParams,
  SmisEmergencyDrillRecordListResult,
  SmisEmergencyDrillRecordSavePayload,
  SmisEmergencyDrillRecordSearchParams,
  SmisEmergencyDrillReportResult,
  SmisEmergencyDrillReportSearchParams,
  SmisTreeOrganization
} from '@smis/api/types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
export async function fetchEmergencyDrillPlanList(params: SmisEmergencyDrillPlanSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisEmergencyDrillPlanListResult>>(
    () =>
      supabase.rpc('smis_list_emergency_drill_plans_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_drill_form: params.drillForm || null,
        p_plan_category: params.planCategory || null,
        p_organization_id: params.organizationId || null,
        p_warning_status: params.warningStatus || null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? { total: 0, planned: 0, completed: 0, warning: 0 },
    organizations: buildOrganizationTree<SmisTreeOrganization>(result.data?.organizations ?? []),
    error: result.error
  }
}

export async function saveEmergencyDrillPlan(
  params: SmisEmergencyDrillPlanSavePayload,
  submit = false
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_emergency_drill_plan_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id'])),
        p_submit: submit
      }),
    { showMessage: true, breakReturn: true, message: submit ? '演练计划已提交' : '演练计划已保存' }
  )
}

export async function deleteEmergencyDrillPlans(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_emergency_drill_plans_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '演练计划已删除'
    }
  )
}

export async function pushEmergencyDrillPlanToRecord(planId: string) {
  return await responseHandle<string>(
    () => supabase.rpc('smis_push_emergency_drill_plan_to_record_secure', { p_plan_id: planId }),
    { showMessage: true, breakReturn: true, message: '已下推演练记录草稿' }
  )
}

export async function fetchEmergencyDrillRecordList(
  params: SmisEmergencyDrillRecordSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisEmergencyDrillRecordListResult>>(
    () =>
      supabase.rpc('smis_list_emergency_drill_records_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_organization_id: params.organizationId || null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? { total: 0, draft: 0, submitted: 0, late: 0 },
    planOptions: result.data?.planOptions ?? [],
    organizations: buildOrganizationTree(result.data?.organizations ?? []),
    error: result.error
  }
}

export async function saveEmergencyDrillRecord(
  params: SmisEmergencyDrillRecordSavePayload,
  submit = false
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_emergency_drill_record_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id'])),
        p_submit: submit
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: submit ? '演练记录已提交，计划已兑现' : '演练记录已保存'
    }
  )
}

export async function deleteEmergencyDrillRecords(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_emergency_drill_records_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '演练记录已删除'
    }
  )
}

export async function fetchEmergencyDrillReport(params: SmisEmergencyDrillReportSearchParams = {}) {
  const result = await responseHandle<SmisEmergencyDrillReportResult>(
    () =>
      supabase.rpc('smis_emergency_drill_report_secure', {
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_organization_id: params.organizationId || null
      }),
    { showErrorMessage: true }
  )
  return {
    ...(result.data ?? {
      overview: {
        planCount: 0,
        completedCount: 0,
        outstandingCount: 0,
        warningCount: 0,
        lateCount: 0
      },
      rows: [],
      outstanding: []
    }),
    error: result.error
  }
}
