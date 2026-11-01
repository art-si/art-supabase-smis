import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import TreeUtils from '@/utils/tree'
import type {
  SmisPpeGenerateResult,
  SmisPpeIssuanceStandard,
  SmisPpeIssuanceStandardOverview,
  SmisPpeIssuanceStandardSavePayload,
  SmisPpeIssuanceStandardSearchParams,
  SmisPpePersonalStandard,
  SmisPpePersonalStandardItem,
  SmisPpePersonalStandardOverview,
  SmisPpePersonalStandardSearchParams,
  SmisPpeScopeOption
} from '@smis/api/types'

interface IssuanceListResult {
  records?: SmisPpeIssuanceStandard[]
  total?: number
  overview?: SmisPpeIssuanceStandardOverview
}

interface PersonalListResult {
  records?: SmisPpePersonalStandard[]
  total?: number
  overview?: SmisPpePersonalStandardOverview
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })

export async function fetchPpeScopeOptions(kind: 'position' | 'organization', keyword?: string) {
  const result = await responseHandle<SmisPpeScopeOption[]>(
    () =>
      supabase.rpc('smis_list_ppe_scope_options_secure', {
        p_kind: kind,
        p_keyword: normalizeNullableText(keyword)
      }),
    { showErrorMessage: true }
  )
  const data = result.data ?? []
  return {
    ...result,
    data:
      kind === 'organization'
        ? treeUtils.listToTree(
            data,
            (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, 'zh-CN')
          )
        : data
  }
}

export async function fetchPpeIssuanceStandardList(
  params: SmisPpeIssuanceStandardSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<IssuanceListResult>(
    () =>
      supabase.rpc('smis_list_ppe_issuance_standards_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: false, breakReturn: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? { total: 0, enabled: 0, disabled: 0, detailTotal: 0 },
    error: result.error
  }
}

export async function savePpeIssuanceStandard(params: SmisPpeIssuanceStandardSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_ppe_issuance_standard_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '防护用品发放标准已更新' : '防护用品发放标准已新增'
    }
  )
}

export async function deletePpeIssuanceStandards(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_ppe_issuance_standards_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '发放标准已删除'
    }
  )
}

export async function fetchPpePersonalStandardList(
  params: SmisPpePersonalStandardSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<PersonalListResult>(
    () =>
      supabase.rpc('smis_list_ppe_personal_standards_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_organization_ids: params.organizationIds?.length ? params.organizationIds : null,
        p_position_id: params.positionId || null,
        p_only_missing: Boolean(params.onlyMissing),
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: false, breakReturn: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      employeeTotal: 0,
      generatedTotal: 0,
      missingTotal: 0,
      itemTotal: 0
    },
    error: result.error
  }
}

export async function fetchPpePersonalStandardItems(employeeId: string) {
  return await responseHandle<SmisPpePersonalStandardItem[]>(
    () =>
      supabase.rpc('smis_list_ppe_personal_standard_items_secure', { p_employee_id: employeeId }),
    { showErrorMessage: true }
  )
}

export async function generatePpePersonalStandards(employeeIds: string[]) {
  return await responseHandle<SmisPpeGenerateResult>(
    () =>
      supabase.rpc('smis_generate_ppe_personal_standards_secure', { p_employee_ids: employeeIds }),
    { showMessage: true, breakReturn: true, message: '个人防护用品标准已生成' }
  )
}
