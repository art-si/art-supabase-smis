import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import { buildOrganizationTree } from './organization-tree'
import type {
  SmisAccidentEmployee,
  SmisAccidentAnalysisListResult,
  SmisAccidentAnalysisSavePayload,
  SmisAccidentAnalysisSearchParams,
  SmisAccidentOption,
  SmisAccidentReportListResult,
  SmisAccidentReportSavePayload,
  SmisAccidentReportSearchParams,
  SmisHistoricalAccidentCaseListResult,
  SmisHistoricalAccidentCaseSavePayload,
  SmisHistoricalAccidentCaseSearchParams,
  SmisSafetyAccidentStatisticsResult,
  SmisSafetyAccidentStatisticsSearchParams,
  SmisTreeOrganization,
  SmisWorkInjuryListResult,
  SmisWorkInjurySavePayload,
  SmisWorkInjurySearchParams
} from '@smis/api/types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
const accidentOverview = () => ({ total: 0, currentMonth: 0, highSeverity: 0, affectedPeople: 0 })
const accidentAnalysisOverview = () => ({ total: 0, complete: 0, pending: 0, participantCount: 0 })
const workInjuryOverview = () => ({ total: 0, slight: 0, minor: 0, serious: 0, fatal: 0 })
const historicalCaseOverview = () => ({ total: 0, inUse: 0, currentYear: 0, highSeverity: 0 })
export const createEmptySafetyAccidentStatistics = (): SmisSafetyAccidentStatisticsResult => ({
  overview: { total: 0, currentYear: 0, highSeverity: 0, affectedPeople: 0 },
  trend: [],
  levels: [],
  categories: [],
  organizations: [],
  organizationOptions: []
})

export async function fetchAccidentEmployeeCandidates(
  params: {
    keyword?: string
    from?: number
    to?: number
  } = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<{ records?: SmisAccidentEmployee[]; total?: number }>(
    () =>
      supabase.rpc('smis_list_accident_employee_candidates_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword)
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error,
    fieldAccess: {}
  }
}

export async function fetchAccidentReportList(params: SmisAccidentReportSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisAccidentReportListResult>>(
    () =>
      supabase.rpc('smis_list_accident_reports_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_accident_level: params.accidentLevel || null,
        p_accident_category: params.accidentCategory || null,
        p_organization_id: params.organizationId || null,
        p_start_time: params.startTime || null,
        p_end_time: params.endTime || null,
        p_ids: params.ids?.length ? params.ids : null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? accidentOverview(),
    organizations: buildOrganizationTree<SmisTreeOrganization>(result.data?.organizations ?? []),
    currentEmployee: result.data?.currentEmployee ?? null,
    error: result.error
  }
}

export async function saveAccidentReport(params: SmisAccidentReportSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_accident_report_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '事故快报已更新' : '事故快报已新增'
    }
  )
}

export async function deleteAccidentReports(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_accident_reports_secure', { p_ids: ids }),
    { showMessage: true, breakReturn: true, message: '事故快报已删除' }
  )
}

export async function fetchHistoricalAccidentCaseList(
  params: SmisHistoricalAccidentCaseSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisHistoricalAccidentCaseListResult>>(
    () =>
      supabase.rpc('smis_list_historical_accident_cases_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_accident_level: params.accidentLevel || null,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_ids: params.ids?.length ? params.ids : null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? historicalCaseOverview(),
    organizations: buildOrganizationTree(result.data?.organizations ?? []),
    error: result.error
  }
}

export async function saveHistoricalAccidentCase(params: SmisHistoricalAccidentCaseSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_historical_accident_case_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '事故案例已更新' : '事故案例已新增'
    }
  )
}

export async function deleteHistoricalAccidentCases(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_historical_accident_cases_secure', { p_ids: ids }),
    { showMessage: true, breakReturn: true, message: '事故案例已删除' }
  )
}

export async function fetchSafetyAccidentStatistics(
  params: SmisSafetyAccidentStatisticsSearchParams = {}
) {
  const result = await responseHandle<SmisSafetyAccidentStatisticsResult>(
    () =>
      supabase.rpc('smis_get_safety_accident_statistics_secure', {
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_organization_id: params.organizationId || null
      }),
    { showErrorMessage: false, breakReturn: true }
  )
  const data = result.data ?? createEmptySafetyAccidentStatistics()
  return {
    ...data,
    organizationOptions: buildOrganizationTree(data.organizationOptions),
    error: result.error
  }
}

export async function fetchAccidentReportOptions(keyword?: string) {
  const result = await responseHandle<SmisAccidentOption[]>(
    () =>
      supabase.rpc('smis_list_accident_report_options_secure', {
        p_keyword: normalizeNullableText(keyword)
      }),
    { showErrorMessage: true }
  )
  return result.data ?? []
}

export async function fetchAccidentAnalysisList(params: SmisAccidentAnalysisSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisAccidentAnalysisListResult>>(
    () =>
      supabase.rpc('smis_list_accident_analyses_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_accident_level: params.accidentLevel || null,
        p_ids: params.ids?.length ? params.ids : null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? accidentAnalysisOverview(),
    error: result.error
  }
}

export async function saveAccidentAnalysis(params: SmisAccidentAnalysisSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_accident_analysis_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '事故分析单已更新' : '事故分析单已保存'
    }
  )
}

export async function deleteAccidentAnalyses(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_accident_analyses_secure', { p_ids: ids }),
    { showMessage: true, breakReturn: true, message: '事故分析单已删除' }
  )
}

export async function fetchWorkInjuryDeclarationList(params: SmisWorkInjurySearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisWorkInjuryListResult>>(
    () =>
      supabase.rpc('smis_list_work_injury_declarations_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_injury_type: params.injuryType || null,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_ids: params.ids?.length ? params.ids : null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? workInjuryOverview(),
    currentEmployee: result.data?.currentEmployee ?? null,
    error: result.error
  }
}

export async function saveWorkInjuryDeclaration(params: SmisWorkInjurySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_work_injury_declaration_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '工伤申报已更新' : '工伤申报已新增'
    }
  )
}

export async function deleteWorkInjuryDeclarations(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_work_injury_declarations_secure', { p_ids: ids }),
    { showMessage: true, breakReturn: true, message: '工伤申报已删除' }
  )
}
