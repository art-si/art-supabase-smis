import type { ApiFeedbackOptions } from '@/types/api/request'
import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit, uniq } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  EmployeeIntegrationItem,
  EmployeeSelectorContractParams
} from '@/api/integration/employees'
import type { SmisSite, SmisSiteBatchCreatePayload, SmisSiteSavePayload } from '@smis/api/types'

interface SiteEmployeeListResult {
  records?: EmployeeIntegrationItem[]
  total?: number
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchSiteList(options: ApiFeedbackOptions = {}) {
  return await responseHandle<SmisSite[]>(() => supabase.rpc('smis_list_sites_secure'), {
    showErrorMessage: options.showErrorMessage ?? true
  })
}

export async function fetchSiteEmployeeOptions(
  params: EmployeeSelectorContractParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<SiteEmployeeListResult>(
    () =>
      supabase.rpc('smis_list_site_employees_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword)
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error,
    fieldAccess: {}
  }
}

export async function saveSite(
  params: SmisSiteSavePayload,
  options: { showMessage?: boolean } = {}
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_site_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: options.showMessage ?? true,
      breakReturn: true,
      message: params.id ? '场所信息已更新' : '场所信息已新增'
    }
  )
}

export async function saveSites(params: SmisSiteBatchCreatePayload) {
  const organizationIds = uniq(params.organizationIds)
  return await responseHandle<string[]>(
    () =>
      supabase.rpc('smis_save_sites_secure', {
        p_organization_ids: organizationIds,
        p_payload: keysToSnakeDeep(omit(params, ['organizationIds', 'id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: `已为 ${organizationIds.length} 个部门新增场所`
    }
  )
}

export async function deleteSites(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_sites_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '场所信息已删除'
    }
  )
}
