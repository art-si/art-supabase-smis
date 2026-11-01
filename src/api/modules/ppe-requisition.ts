import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  SmisPpeDueGenerateResult,
  SmisPpeIssuanceRecord,
  SmisPpeIssuanceRecordOverview,
  SmisPpeIssuanceRecordSavePayload,
  SmisPpeIssuanceRecordSearchParams,
  SmisPpeIssuanceStatistics,
  SmisPpePersonalRequisitionItem,
  SmisPpePersonalRequisitionOverview,
  SmisPpePersonalRequisitionSearchParams,
  SmisPpeSetting
} from '@smis/api/types'

interface RequisitionListResult {
  records?: SmisPpePersonalRequisitionItem[]
  total?: number
  overview?: SmisPpePersonalRequisitionOverview
}

interface IssuanceListResult {
  records?: SmisPpeIssuanceRecord[]
  total?: number
  overview?: SmisPpeIssuanceRecordOverview
}

interface PersonalPlanItem {
  id: string
  initialIssueDate: string
  nextIssueDate: string
  issuanceCycle: string
  issuanceFrequency: number
}

const emptyRequisitionOverview = (): SmisPpePersonalRequisitionOverview => ({
  total: 0,
  pending: 0,
  waitingConfirmation: 0,
  confirmed: 0,
  overdue: 0
})

const emptyIssuanceOverview = (): SmisPpeIssuanceRecordOverview => ({
  total: 0,
  draft: 0,
  posted: 0,
  today: 0,
  quantity: 0
})

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchPpePersonalRequisitionList(
  params: SmisPpePersonalRequisitionSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<RequisitionListResult>(
    () =>
      supabase.rpc('smis_list_ppe_personal_requisitions_secure', {
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

export async function fetchPpeIssuanceRecordList(params: SmisPpeIssuanceRecordSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<IssuanceListResult>(
    () =>
      supabase.rpc('smis_list_ppe_issuance_records_secure', {
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

export async function savePpeIssuanceRecord(params: SmisPpeIssuanceRecordSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_ppe_issuance_record_secure', {
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

export async function deletePpeIssuanceRecords(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_ppe_issuance_records_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '发放记录草稿已删除'
    }
  )
}

export async function postPpeIssuanceRecord(id: string) {
  return await responseHandle<string>(
    () => supabase.rpc('smis_post_ppe_issuance_record_secure', { p_record_id: id }),
    { showMessage: true, breakReturn: true, message: '防护用品已发放并完成过账' }
  )
}

export async function pushPpeRequisitionItems(
  items: Array<{ id: string; issueQuantity: number }>,
  warehouseId: string,
  issuerEmployeeId: string,
  issueDate: string
) {
  return await responseHandle<{ id: string; issuanceNo: string }>(
    () =>
      supabase.rpc('smis_push_ppe_requisition_items_secure', {
        p_items: keysToSnakeDeep(items),
        p_warehouse_id: warehouseId,
        p_issuer_employee_id: issuerEmployeeId,
        p_issue_date: issueDate
      }),
    { showMessage: true, breakReturn: true, message: '领用明细已下推并发放过账' }
  )
}

export async function confirmPpeRequisitionItems(
  itemIds: string[],
  confirmed: boolean,
  reason?: string
) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_confirm_ppe_requisition_items_secure', {
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

export async function fetchPpeSetting() {
  return await responseHandle<SmisPpeSetting>(() => supabase.rpc('smis_get_ppe_setting_secure'), {
    showErrorMessage: true
  })
}

export async function savePpeSetting(autoConfirmDays: number) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_save_ppe_setting_secure', { p_auto_confirm_days: autoConfirmDays }),
    { showMessage: true, breakReturn: true, message: '自动确认规则已保存' }
  )
}

export async function generateDuePpeRequisitions(dueDate?: string) {
  return await responseHandle<SmisPpeDueGenerateResult>(
    () =>
      supabase.rpc('smis_generate_due_ppe_requisitions_secure', {
        p_due_date: dueDate || null
      }),
    { showMessage: true, breakReturn: true, message: '到期个人领用单已生成' }
  )
}

export async function savePpePersonalIssuePlan(employeeId: string, items: PersonalPlanItem[]) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_set_ppe_personal_issue_plan_secure', {
        p_employee_id: employeeId,
        p_items: keysToSnakeDeep(items)
      }),
    { showMessage: true, breakReturn: true, message: '个人领用时间与周期已保存' }
  )
}

export async function fetchPpeIssuanceStatistics(params: {
  dateRange?: [string, string]
  organizationId?: string
  employeeId?: string
}) {
  return await responseHandle<SmisPpeIssuanceStatistics>(
    () =>
      supabase.rpc('smis_get_ppe_issuance_statistics_secure', {
        p_date_from: params.dateRange?.[0] ?? null,
        p_date_to: params.dateRange?.[1] ?? null,
        p_organization_id: params.organizationId || null,
        p_employee_id: params.employeeId || null
      }),
    { showErrorMessage: true }
  )
}
