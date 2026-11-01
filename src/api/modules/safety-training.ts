import type { ApiFeedbackOptions } from '@/types/api/request'
import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import { buildOrganizationTree } from './organization-tree'
import type {
  SmisSafetyTrainingOrganizationOption,
  SmisSafetyTrainingPlanListResult,
  SmisSafetyTrainingPlanSavePayload,
  SmisSafetyTrainingPlanSearchParams,
  SmisSafetyTrainingRecordListResult,
  SmisSafetyTrainingRecordSavePayload,
  SmisSafetyTrainingRecordSearchParams,
  SmisSafetyTrainingReportResult,
  SmisSafetyTrainingReportSearchParams
} from '@smis/api/types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
export async function fetchSafetyTrainingPlanList(
  params: SmisSafetyTrainingPlanSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisSafetyTrainingPlanListResult>>(
    () =>
      supabase.rpc('smis_list_safety_training_plans_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_execution_status: params.executionStatus || null,
        p_training_category: params.trainingCategory || null,
        p_organization_id: params.organizationId || null,
        p_start_at: params.dateRange?.[0] || null,
        p_end_at: params.dateRange?.[1] || null,
        p_warning_status: params.warningStatus || null
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      total: 0,
      draft: 0,
      published: 0,
      completed: 0,
      warning: 0
    },
    organizations: buildOrganizationTree<SmisSafetyTrainingOrganizationOption>(
      result.data?.organizations ?? []
    ),
    error: result.error
  }
}

export async function saveSafetyTrainingPlan(
  params: SmisSafetyTrainingPlanSavePayload,
  publish = false
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_safety_training_plan_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id'])),
        p_publish: publish
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: publish ? '培训计划已发布' : '培训计划草稿已保存'
    }
  )
}

export async function deleteSafetyTrainingPlans(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_safety_training_plans_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '培训计划已删除'
    }
  )
}

export async function fetchSafetyTrainingRecordList(
  params: SmisSafetyTrainingRecordSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisSafetyTrainingRecordListResult>>(
    () =>
      supabase.rpc('smis_list_safety_training_records_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_start_at: params.dateRange?.[0] || null,
        p_end_at: params.dateRange?.[1] || null,
        p_organization_id: params.organizationId || null
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      total: 0,
      draft: 0,
      submitted: 0,
      participantCount: 0,
      presentCount: 0
    },
    planOptions: result.data?.planOptions ?? [],
    organizations: buildOrganizationTree(result.data?.organizations ?? []),
    error: result.error
  }
}

export async function saveSafetyTrainingRecord(
  params: SmisSafetyTrainingRecordSavePayload,
  submit = false
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_safety_training_record_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id'])),
        p_submit: submit
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: submit ? '培训记录已归档，计划已完成' : '培训记录草稿已保存'
    }
  )
}

export async function deleteSafetyTrainingRecords(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_safety_training_records_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '培训记录已删除'
    }
  )
}

export async function fetchSafetyTrainingReport(
  params: SmisSafetyTrainingReportSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const result = await responseHandle<SmisSafetyTrainingReportResult>(
    () =>
      supabase.rpc('smis_safety_training_report_secure', {
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_organization_id: params.organizationId || null
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  return {
    ...(result.data ?? {
      overview: {
        planCount: 0,
        completedPlanCount: 0,
        recordCount: 0,
        plannedPersonTimes: 0,
        actualPersonTimes: 0,
        trainingHours: 0,
        outstandingCount: 0,
        completionRate: 0,
        attendanceRate: 0
      },
      organizationStats: [],
      monthlyTrend: [],
      categoryStats: [],
      attendanceStats: [],
      outstandingPlans: [],
      organizationOptions: []
    }),
    organizationOptions: buildOrganizationTree(result.data?.organizationOptions ?? []),
    error: result.error
  }
}
