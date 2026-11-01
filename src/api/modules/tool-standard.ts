import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import TreeUtils from '@/utils/tree'
import type {
  SmisToolGenerateResult,
  SmisToolIssuanceStandard,
  SmisToolIssuanceStandardOverview,
  SmisToolIssuanceStandardSavePayload,
  SmisToolIssuanceStandardSearchParams,
  SmisToolPersonalStandard,
  SmisToolPersonalStandardItem,
  SmisToolPersonalStandardOverview,
  SmisToolPersonalStandardSearchParams,
  SmisToolScopeOption
} from '@smis/api/types'

interface IssuanceListResult {
  records?: SmisToolIssuanceStandard[]
  total?: number
  overview?: SmisToolIssuanceStandardOverview
}

interface PersonalListResult {
  records?: SmisToolPersonalStandard[]
  total?: number
  overview?: SmisToolPersonalStandardOverview
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })

export async function fetchToolScopeOptions(kind: 'position' | 'organization', keyword?: string) {
  const result = await responseHandle<SmisToolScopeOption[]>(
    () =>
      supabase.rpc('smis_list_tool_scope_options_secure', {
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

export async function fetchToolIssuanceStandardList(
  params: SmisToolIssuanceStandardSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<IssuanceListResult>(
    () =>
      supabase.rpc('smis_list_tool_issuance_standards_secure', {
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

export async function saveToolIssuanceStandard(params: SmisToolIssuanceStandardSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_tool_issuance_standard_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '工器具发放标准已更新' : '工器具发放标准已新增'
    }
  )
}

export async function deleteToolIssuanceStandards(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_tool_issuance_standards_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '发放标准已删除'
    }
  )
}

export async function fetchToolPersonalStandardList(
  params: SmisToolPersonalStandardSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<PersonalListResult>(
    () =>
      supabase.rpc('smis_list_tool_personal_standards_secure', {
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

export async function fetchToolPersonalStandardItems(employeeId: string) {
  return await responseHandle<SmisToolPersonalStandardItem[]>(
    () =>
      supabase.rpc('smis_list_tool_personal_standard_items_secure', { p_employee_id: employeeId }),
    { showErrorMessage: true }
  )
}

export async function generateToolPersonalStandards(employeeIds: string[]) {
  return await responseHandle<SmisToolGenerateResult>(
    () =>
      supabase.rpc('smis_generate_tool_personal_standards_secure', { p_employee_ids: employeeIds }),
    { showMessage: true, breakReturn: true, message: '工器具个人标准已生成' }
  )
}
