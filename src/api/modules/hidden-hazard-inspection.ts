import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  SmisSafetyInspectionOrganization,
  SmisSafetyInspectionTypeOption
} from '@smis/api/modules/safety-inspection'

export type SmisHiddenHazardPlanStatus = 'enabled' | 'disabled' | 'voided'
export type SmisHiddenHazardTaskStatus =
  'not_started' | 'in_progress' | 'overdue' | 'completed' | 'cancelled'
export type SmisHiddenHazardDeadlineUnit = 'minute' | 'hour' | 'day'
export type SmisHiddenHazardCycleType = 'once' | 'day' | 'week' | 'month'
export type SmisHiddenHazardInspectionResult = 'pending' | 'normal' | 'abnormal'

export interface SmisHiddenHazardPlanOverview {
  total: number
  enabled: number
  disabled: number
  voided: number
}

export interface SmisHiddenHazardPlanItem {
  id: string
  inspectionItemId?: string | null
  standardCode: string
  standardName: string
  itemCode: string
  inspectionContent: string
  sort: number
}

export interface SmisHiddenHazardInspectionPlan {
  id: string
  planNo: string
  planName: string
  inspectionTypeId: string
  inspectionTypeName: string
  inspectionTypeCode?: string
  inspectionTypeTextColor?: string | null
  inspectionTypeTagStyle?: SmisSafetyInspectionTypeOption['tagStyle']
  inspectionOrganizationId: string
  inspectionOrganizationName: string
  inspectedOrganizationId: string
  inspectedOrganizationName: string
  executorEmployeeId: string
  executorEmployeeName: string
  executorEmployeeNo: string
  plannedStartAt: string
  plannedEndAt: string
  taskDeadlineValue: number
  taskDeadlineUnit: SmisHiddenHazardDeadlineUnit
  cycleType: SmisHiddenHazardCycleType
  cycleInterval: number
  attachmentUrls: string[]
  inspectionDescription?: string | null
  status: SmisHiddenHazardPlanStatus
  itemCount: number
  taskCount: number
  createBy?: string | null
  createTime: string
  updateBy?: string | null
  updateTime: string
}

export interface SmisHiddenHazardInspectionPlanDetail extends Omit<
  SmisHiddenHazardInspectionPlan,
  'itemCount' | 'taskCount'
> {
  items: SmisHiddenHazardPlanItem[]
}

export interface SmisHiddenHazardPlanSearchParams {
  planNo?: string
  planName?: string
  plannedFrom?: string
  plannedTo?: string
  status?: SmisHiddenHazardPlanStatus
  executorKeyword?: string
  inspectionTypeId?: string
  ids?: string[]
  from?: number
  to?: number
}

export interface SmisHiddenHazardInspectionPlanPayload {
  id?: string
  planName: string
  inspectionTypeId: string
  inspectionOrganizationId: string
  inspectedOrganizationId: string
  executorEmployeeId: string
  plannedStartAt: string
  plannedEndAt: string
  taskDeadlineValue: number
  taskDeadlineUnit: SmisHiddenHazardDeadlineUnit
  cycleType: SmisHiddenHazardCycleType
  cycleInterval: number
  attachmentUrls: string[]
  inspectionDescription?: string | null
  status: Exclude<SmisHiddenHazardPlanStatus, 'voided'>
  inspectionItemIds: string[]
}

export interface SmisHiddenHazardPlanOptions {
  // This separate RPC does not return the tenant identity added to safety-inspection options.
  inspectionTypes: Omit<SmisSafetyInspectionTypeOption, 'tenantId'>[]
  organizations: Array<
    Omit<SmisSafetyInspectionOrganization, 'tenantId' | 'children'> & {
      children?: SmisHiddenHazardPlanOptions['organizations']
    }
  >
}

export interface SmisHiddenHazardTaskOverview {
  total: number
  notStarted: number
  inProgress: number
  overdue: number
  completed: number
  cancelled: number
}

export interface SmisHiddenHazardInspectionTask {
  id: string
  sourcePlanId: string
  sourcePlanNo: string
  sourcePlanName: string
  taskNo: string
  inspectionObject: string
  inspectionTypeName: string
  status: SmisHiddenHazardTaskStatus
  executorEmployeeId: string
  executorEmployeeName: string
  executorEmployeeNo: string
  plannedStartAt: string
  plannedEndAt: string
  inspectionDescription?: string | null
  itemCount: number
  normalCount: number
  abnormalCount: number
  createTime: string
  updateTime: string
}

export interface SmisHiddenHazardTaskSearchParams {
  taskNo?: string
  inspectionObject?: string
  plannedFrom?: string
  plannedTo?: string
  status?: SmisHiddenHazardTaskStatus
  executorKeyword?: string
  sourcePlanNo?: string
  ids?: string[]
  from?: number
  to?: number
}

export interface SmisHiddenHazardTaskItem {
  id: string
  standardCode: string
  standardName: string
  itemCode: string
  inspectionContent: string
  result: SmisHiddenHazardInspectionResult
  hiddenHazardNo?: string | null
  remark?: string | null
  attachmentUrls: string[]
  sort: number
}

export interface SmisHiddenHazardTaskEvent {
  id: string
  eventType: 'generated' | 'transferred' | 'progress_saved' | 'completed' | 'cancelled'
  eventContent?: string | null
  operatorName?: string | null
  eventAt: string
}

export interface SmisHiddenHazardInspectionTaskDetail extends Omit<
  SmisHiddenHazardInspectionTask,
  'itemCount' | 'normalCount' | 'abnormalCount' | 'createTime' | 'updateTime'
> {
  inspectionOrganizationName: string
  inspectedOrganizationName: string
  actualStartAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  executionSummary?: string | null
  attachmentUrls: string[]
  transferReason?: string | null
  cancellationReason?: string | null
  items: SmisHiddenHazardTaskItem[]
  events: SmisHiddenHazardTaskEvent[]
}

export interface SmisHiddenHazardExecutionPayload {
  id: string
  executionSummary?: string | null
  attachmentUrls: string[]
  items: Array<Pick<SmisHiddenHazardTaskItem, 'id' | 'result' | 'remark' | 'attachmentUrls'>>
  complete: boolean
}

interface PlanListResult {
  records?: SmisHiddenHazardInspectionPlan[]
  total?: number
  overview?: SmisHiddenHazardPlanOverview
}

interface TaskListResult {
  records?: SmisHiddenHazardInspectionTask[]
  total?: number
  overview?: SmisHiddenHazardTaskOverview
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
const emptyPlanOverview = (): SmisHiddenHazardPlanOverview => ({
  total: 0,
  enabled: 0,
  disabled: 0,
  voided: 0
})
const emptyTaskOverview = (): SmisHiddenHazardTaskOverview => ({
  total: 0,
  notStarted: 0,
  inProgress: 0,
  overdue: 0,
  completed: 0,
  cancelled: 0
})

export async function fetchHiddenHazardPlanOptions(): Promise<SmisHiddenHazardPlanOptions> {
  const result = await responseHandle<Partial<SmisHiddenHazardPlanOptions>>(
    () => supabase.rpc('smis_list_hidden_hazard_plan_options_secure'),
    { showErrorMessage: true }
  )
  return {
    inspectionTypes: result.data?.inspectionTypes ?? [],
    organizations: result.data?.organizations ?? []
  }
}

export async function fetchHiddenHazardInspectionPlanList(
  params: SmisHiddenHazardPlanSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<PlanListResult>(
    () =>
      supabase.rpc('smis_list_hidden_hazard_inspection_plans_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_plan_no: normalizeNullableText(params.planNo),
        p_plan_name: normalizeNullableText(params.planName),
        p_planned_from: params.plannedFrom || null,
        p_planned_to: params.plannedTo || null,
        p_status: params.status || null,
        p_executor_keyword: normalizeNullableText(params.executorKeyword),
        p_inspection_type_id: params.inspectionTypeId || null
      }),
    { showErrorMessage: true }
  )
  const records = result.data?.records ?? []
  const idSet = params.ids?.length ? new Set(params.ids) : null
  const data = idSet ? records.filter((item) => idSet.has(item.id)) : records
  return {
    data,
    total: idSet ? data.length : (result.data?.total ?? 0),
    overview: result.data?.overview ?? emptyPlanOverview(),
    error: result.error
  }
}

export async function fetchHiddenHazardInspectionPlanDetail(id: string) {
  const result = await responseHandle<SmisHiddenHazardInspectionPlanDetail>(
    () => supabase.rpc('smis_get_hidden_hazard_inspection_plan_secure', { p_id: id }),
    { showErrorMessage: true }
  )
  return result.data ?? null
}

export async function saveHiddenHazardInspectionPlan(
  payload: SmisHiddenHazardInspectionPlanPayload
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_hidden_hazard_inspection_plan_secure', {
        p_id: payload.id ?? null,
        p_payload: keysToSnakeDeep(omit(payload, ['id', 'inspectionItemIds'])),
        p_inspection_item_ids: payload.inspectionItemIds
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.id ? '隐患排查计划已更新' : '隐患排查计划已创建'
    }
  )
}

export async function deleteHiddenHazardInspectionPlans(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_hidden_hazard_inspection_plans_secure', { p_ids: ids }),
    { showMessage: true, breakReturn: true, message: '隐患排查计划已删除' }
  )
}

export async function voidHiddenHazardInspectionPlans(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_void_hidden_hazard_inspection_plans_secure', { p_ids: ids }),
    { showMessage: true, breakReturn: true, message: '隐患排查计划已作废' }
  )
}

export async function fetchHiddenHazardInspectionTaskList(
  params: SmisHiddenHazardTaskSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<TaskListResult>(
    () =>
      supabase.rpc('smis_list_hidden_hazard_inspection_tasks_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_task_no: normalizeNullableText(params.taskNo),
        p_inspection_object: normalizeNullableText(params.inspectionObject),
        p_planned_from: params.plannedFrom || null,
        p_planned_to: params.plannedTo || null,
        p_status: params.status || null,
        p_executor_keyword: normalizeNullableText(params.executorKeyword),
        p_source_plan_no: normalizeNullableText(params.sourcePlanNo)
      }),
    { showErrorMessage: true }
  )
  const records = result.data?.records ?? []
  const idSet = params.ids?.length ? new Set(params.ids) : null
  const data = idSet ? records.filter((item) => idSet.has(item.id)) : records
  return {
    data,
    total: idSet ? data.length : (result.data?.total ?? 0),
    overview: result.data?.overview ?? emptyTaskOverview(),
    error: result.error
  }
}

export async function fetchHiddenHazardInspectionTaskDetail(id: string) {
  const result = await responseHandle<SmisHiddenHazardInspectionTaskDetail>(
    () => supabase.rpc('smis_get_hidden_hazard_inspection_task_secure', { p_id: id }),
    { showErrorMessage: true }
  )
  return result.data ?? null
}

export async function cancelHiddenHazardInspectionTask(id: string, reason: string) {
  return await responseHandle<boolean>(
    () =>
      supabase.rpc('smis_cancel_hidden_hazard_inspection_task_secure', {
        p_id: id,
        p_reason: reason
      }),
    { showMessage: true, breakReturn: true, message: '隐患排查任务已取消' }
  )
}

export async function transferHiddenHazardInspectionTask(
  id: string,
  employeeId: string,
  reason: string
) {
  return await responseHandle<boolean>(
    () =>
      supabase.rpc('smis_transfer_hidden_hazard_inspection_task_secure', {
        p_id: id,
        p_employee_id: employeeId,
        p_reason: reason
      }),
    { showMessage: true, breakReturn: true, message: '隐患排查任务已转交' }
  )
}

export async function saveHiddenHazardInspectionExecution(
  payload: SmisHiddenHazardExecutionPayload
) {
  return await responseHandle<boolean>(
    () =>
      supabase.rpc('smis_save_hidden_hazard_inspection_execution_secure', {
        p_id: payload.id,
        p_payload: keysToSnakeDeep(omit(payload, ['id', 'items', 'complete'])),
        p_items: keysToSnakeDeep(payload.items),
        p_complete: payload.complete
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.complete ? '隐患排查任务已完成' : '排查进度已保存'
    }
  )
}
