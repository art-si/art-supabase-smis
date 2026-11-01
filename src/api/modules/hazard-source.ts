import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  EmployeeIntegrationItem,
  EmployeeSelectorContractParams
} from '@/api/integration/employees'
import type {
  SmisHazardSourceListResult,
  SmisHazardSourceSavePayload,
  SmisHazardSourceSearchParams,
  SmisHazardSourceStatistics
} from '@smis/api/types'

interface EmployeeResult {
  records?: EmployeeIntegrationItem[]
  total?: number
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchHazardSourceList(params: SmisHazardSourceSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<Partial<SmisHazardSourceListResult>>(
    () =>
      supabase.rpc('smis_list_hazard_sources_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_site_id: params.siteId || null,
        p_hazard_level: params.hazardLevel || null,
        p_risk_level: params.riskLevel || null,
        p_organization_id: params.organizationId || null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? { total: 0, submitted: 0, majorRisk: 0, siteCount: 0 },
    sites: result.data?.sites ?? [],
    organizations: result.data?.organizations ?? [],
    error: result.error
  }
}

export async function fetchHazardSourceEmployees(params: EmployeeSelectorContractParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<EmployeeResult>(
    () =>
      supabase.rpc('smis_list_hazard_source_employees_secure', {
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

export async function saveHazardSource(params: SmisHazardSourceSavePayload, submit = false) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_hazard_source_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id'])),
        p_submit: submit
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: submit ? '危险源已保存并提交' : '危险源已保存'
    }
  )
}

export async function deleteHazardSources(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_hazard_sources_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '危险源已删除'
    }
  )
}

export async function fetchHazardSourceStatistics(organizationId?: string) {
  return await responseHandle<SmisHazardSourceStatistics>(
    () =>
      supabase.rpc('smis_hazard_source_statistics_secure', {
        p_organization_id: organizationId || null
      }),
    { showErrorMessage: true }
  )
}
