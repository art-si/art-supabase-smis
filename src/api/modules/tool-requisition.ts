import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  SmisToolDueGenerateResult,
  SmisToolIssuanceRecord,
  SmisToolIssuanceRecordOverview,
  SmisToolIssuanceRecordSavePayload,
  SmisToolIssuanceRecordSearchParams,
  SmisToolIssuanceStatistics,
  SmisToolPersonalRequisitionItem,
  SmisToolPersonalRequisitionOverview,
  SmisToolPersonalRequisitionSearchParams,
  SmisToolSetting,
  SmisToolReturn,
  SmisToolReturnOverview,
  SmisToolReturnableItem,
  SmisToolReturnSearchParams,
  SmisToolReturnableSearchParams,
  SmisToolReturnSaveAction,
  SmisToolReturnSavePayload
} from '@smis/api/types'

interface RequisitionListResult {
  records?: SmisToolPersonalRequisitionItem[]
  total?: number
  overview?: SmisToolPersonalRequisitionOverview
}

interface IssuanceListResult {
  records?: SmisToolIssuanceRecord[]
  total?: number
  overview?: SmisToolIssuanceRecordOverview
}

interface PersonalPlanItem {
  id: string
  initialIssueDate: string
  nextIssueDate: string
  issuanceCycle: string
  issuanceFrequency: number
}

interface ToolReturnListResult {
  records?: SmisToolReturn[]
  total?: number
  overview?: SmisToolReturnOverview
}

interface ToolReturnableListResult {
  records?: SmisToolReturnableItem[]
  total?: number
}

const emptyRequisitionOverview = (): SmisToolPersonalRequisitionOverview => ({
  total: 0,
  pending: 0,
  waitingConfirmation: 0,
  confirmed: 0,
  overdue: 0
})

const emptyIssuanceOverview = (): SmisToolIssuanceRecordOverview => ({
  total: 0,
  draft: 0,
  posted: 0,
  today: 0,
  quantity: 0
})

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchToolPersonalRequisitionList(
  params: SmisToolPersonalRequisitionSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<RequisitionListResult>(
    () =>
      supabase.rpc('smis_list_tool_personal_requisitions_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_date_from: params.dateRange?.[0] ?? null,
        p_date_to: params.dateRange?.[1] ?? null,
        p_organization_id: params.organizationId || null,
        p_employee_id: params.employeeId || null,
        p_status: params.status || null,
        p_keyword: normalizeNullableText(params.keyword),
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: false, breakReturn: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyRequisitionOverview(),
    error: result.error
  }
}

export async function fetchToolIssuanceRecordList(params: SmisToolIssuanceRecordSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<IssuanceListResult>(
    () =>
      supabase.rpc('smis_list_tool_issuance_records_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_date_from: params.dateRange?.[0] ?? null,
        p_date_to: params.dateRange?.[1] ?? null,
        p_organization_id: params.organizationId || null,
        p_employee_id: params.employeeId || null,
        p_status: params.status || null,
        p_keyword: normalizeNullableText(params.keyword),
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: false, breakReturn: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyIssuanceOverview(),
    error: result.error
  }
}

export async function saveToolIssuanceRecord(params: SmisToolIssuanceRecordSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_tool_issuance_record_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '发放记录草稿已更新' : '发放记录草稿已新增'
    }
  )
}

export async function deleteToolIssuanceRecords(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_tool_issuance_records_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '发放记录草稿已删除'
    }
  )
}

export async function postToolIssuanceRecord(id: string) {
  return await responseHandle<string>(
    () => supabase.rpc('smis_post_tool_issuance_record_secure', { p_record_id: id }),
    { showMessage: true, breakReturn: true, message: '工器具已发放并完成过账' }
  )
}

export async function pushToolRequisitionItems(
  items: Array<{ id: string; issueQuantity: number }>,
  warehouseId: string,
  issuerEmployeeId: string,
  issueDate: string
) {
  return await responseHandle<{ id: string; issuanceNo: string }>(
    () =>
      supabase.rpc('smis_push_tool_requisition_items_secure', {
        p_items: keysToSnakeDeep(items),
        p_warehouse_id: warehouseId,
        p_issuer_employee_id: issuerEmployeeId,
        p_issue_date: issueDate
      }),
    { showMessage: true, breakReturn: true, message: '领用明细已下推并发放过账' }
  )
}

export async function confirmToolRequisitionItems(
  itemIds: string[],
  confirmed: boolean,
  reason?: string
) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_confirm_tool_requisition_items_secure', {
        p_item_ids: itemIds,
        p_confirmed: confirmed,
        p_reason: normalizeNullableText(reason)
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: confirmed ? '领用确认已完成' : '领用否认已提交'
    }
  )
}

export async function fetchToolSetting() {
  return await responseHandle<SmisToolSetting>(() => supabase.rpc('smis_get_tool_setting_secure'), {
    showErrorMessage: true
  })
}

export async function saveToolSetting(autoConfirmDays: number) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_save_tool_setting_secure', { p_auto_confirm_days: autoConfirmDays }),
    { showMessage: true, breakReturn: true, message: '自动确认规则已保存' }
  )
}

export async function generateDueToolRequisitions(dueDate?: string) {
  return await responseHandle<SmisToolDueGenerateResult>(
    () =>
      supabase.rpc('smis_generate_due_tool_requisitions_secure', {
        p_due_date: dueDate || null
      }),
    { showMessage: true, breakReturn: true, message: '到期个人领用单已生成' }
  )
}

export async function saveToolPersonalIssuePlan(employeeId: string, items: PersonalPlanItem[]) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_set_tool_personal_issue_plan_secure', {
        p_employee_id: employeeId,
        p_items: keysToSnakeDeep(items)
      }),
    { showMessage: true, breakReturn: true, message: '个人领用时间与周期已保存' }
  )
}

export async function fetchToolIssuanceStatistics(params: {
  dateRange?: [string, string]
  organizationId?: string
  employeeId?: string
}) {
  return await responseHandle<SmisToolIssuanceStatistics>(
    () =>
      supabase.rpc('smis_get_tool_issuance_statistics_secure', {
        p_date_from: params.dateRange?.[0] ?? null,
        p_date_to: params.dateRange?.[1] ?? null,
        p_organization_id: params.organizationId || null,
        p_employee_id: params.employeeId || null
      }),
    { showErrorMessage: true }
  )
}

export async function fetchToolReturnableItems(params: SmisToolReturnableSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<ToolReturnableListResult>(
    () =>
      supabase.rpc('smis_list_tool_returnable_items_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_employee_id: params.employeeId || null,
        p_keyword: normalizeNullableText(params.keyword),
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}

export async function fetchToolReturnList(params: SmisToolReturnSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<ToolReturnListResult>(
    () =>
      supabase.rpc('smis_list_tool_returns_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_date_from: params.dateRange?.[0] ?? null,
        p_date_to: params.dateRange?.[1] ?? null,
        p_employee_id: params.employeeId || null,
        p_status: params.status || null,
        p_keyword: normalizeNullableText(params.keyword),
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: false, breakReturn: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      total: 0,
      draft: 0,
      pendingApproval: 0,
      approved: 0,
      rejected: 0
    },
    error: result.error
  }
}

export async function saveToolReturn(
  params: SmisToolReturnSavePayload,
  action: SmisToolReturnSaveAction = 'add'
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_tool_return_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id'])),
        p_action: action
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '归还单已更新' : '归还单已生成'
    }
  )
}

export async function deleteToolReturns(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_tool_returns_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '归还单已删除'
    }
  )
}

export async function submitToolReturn(id: string, options: { showMessage?: boolean } = {}) {
  return await responseHandle<string>(
    () => supabase.rpc('smis_submit_tool_return_secure', { p_return_id: id }),
    { showMessage: options.showMessage ?? true, breakReturn: true, message: '归还单已提交审批' }
  )
}
