import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  EmployeeIntegrationItem,
  EmployeeSelectorContractParams
} from '@/api/integration/employees'
import type {
  LeaveInformation,
  LeaveInformationOverview,
  LeaveInformationSavePayload,
  LeaveInformationSearchParams
} from '@smis/api/types'

interface LeaveInformationListResult {
  records?: LeaveInformation[]
  total?: number
}

interface LeaveEmployeeListResult {
  records?: EmployeeIntegrationItem[]
  total?: number
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchLeaveInformationList(params: LeaveInformationSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<LeaveInformationListResult>(
    () =>
      supabase.rpc('smis_list_leave_information_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_organization_id: params.organizationId || null,
        p_company_keyword: normalizeNullableText(params.companyKeyword),
        p_applicant_keyword: normalizeNullableText(params.applicantKeyword),
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null
      }),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}

export async function fetchLeaveInformationOverview() {
  return await responseHandle<LeaveInformationOverview>(
    () => supabase.rpc('smis_leave_information_overview_secure'),
    { showErrorMessage: true }
  )
}

export async function fetchLeaveInformationDetail(id: string) {
  return await responseHandle<LeaveInformation>(
    () => supabase.rpc('smis_get_leave_information_secure', { p_id: id }),
    { showErrorMessage: true }
  )
}

export async function fetchLeaveEmployeeDetail(employeeId: string) {
  return await responseHandle<EmployeeIntegrationItem & { idCardNo?: string | null }>(
    () => supabase.rpc('smis_get_leave_employee_secure', { p_employee_id: employeeId }),
    { showErrorMessage: true }
  )
}

export async function fetchLeaveEmployeeOptions(params: EmployeeSelectorContractParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<LeaveEmployeeListResult>(
    () =>
      supabase.rpc('smis_list_leave_employees_secure', {
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

export async function saveLeaveInformation(params: LeaveInformationSavePayload) {
  const payload = keysToSnakeDeep(omit(params, ['id']))
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_leave_information_secure', {
        p_id: params.id ?? null,
        p_payload: payload
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '请假信息已更新' : '请假信息已新增'
    }
  )
}

export async function deleteLeaveInformation(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_leave_information_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '请假信息已删除'
    }
  )
}
