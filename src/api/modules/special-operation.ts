import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'

export type SmisSpecialOperationStatus = 'enabled' | 'disabled' | 'voided'
export type SmisSpecialOperationEditableStatus = Exclude<SmisSpecialOperationStatus, 'voided'>
export type SmisSpecialOperationTagStyle =
  '' | 'primary' | 'success' | 'info' | 'warning' | 'danger'
export type SmisSpecialOperationCatalogKind = 'safety_checklist' | 'hazard_factor' | 'site_analysis'
export type SmisSpecialOperationRecordType = 'text' | 'number' | 'single'
export type SmisSpecialOperationFieldType =
  'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'single' | 'multiple' | 'switch'
export type SmisSpecialOperationPermitStatus =
  | 'draft'
  | 'pending_approval'
  | 'rejected'
  | 'in_progress'
  | 'pending_acceptance'
  | 'completed'
  | 'voided'
export type SmisSpecialOperationTransitionAction =
  'start' | 'request_acceptance' | 'accept' | 'void'

export interface SmisSpecialOperationPerson {
  employeeId: string
  employeeNo?: string | null
  employeeName: string
  idCardNo?: string | null
  phone?: string | null
  organizationName?: string | null
  certificateName?: string | null
  certificateNumber?: string | null
}

export interface SmisSpecialOperationBlindPlateItem {
  id: string
  equipmentPipelineName: string
  medium: string
  temperature: string
  pressure: string
  material: string
  specification: string
  blindPlateNo: string
}

export interface SmisSpecialOperationCatalogSelection {
  id: string
  itemName: string
  recordType?: SmisSpecialOperationRecordType | null
  normalValue?: string | null
  abnormalValue?: string | null
  recordedValue?: string | number | null
  involved?: boolean
}

export interface SmisSpecialOperationRelatedPermit {
  id: string
  permitNo: string
  operationTypeName: string
  workContent?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  workLocation?: string | null
}

export interface SmisSpecialOperationPermitEvent {
  id: string
  eventType: string
  eventTitle: string
  eventDescription?: string | null
  fromStatus?: SmisSpecialOperationPermitStatus | null
  toStatus?: SmisSpecialOperationPermitStatus | null
  operatorName?: string | null
  createTime: string
}

export interface SmisSpecialOperationPermit {
  id: string
  tenantId: string
  permitNo: string
  operationTypeId: string
  operationTypeCode: string
  operationTypeName: string
  workContent: string | null
  workStartTime: string | null
  workEndTime: string | null
  workLocation: string | null
  workUnit: string | null
  workSection: string | null
  hotWorkLevel: string | null
  hotWorkMethods: string[]
  hazardFactors: SmisSpecialOperationCatalogSelection[]
  responsibleEmployee: SmisSpecialOperationPerson | null
  guardianEmployees: SmisSpecialOperationPerson[]
  verifierEmployees: SmisSpecialOperationPerson[]
  briefingGiverEmployees: SmisSpecialOperationPerson[]
  briefingReceiverEmployees: SmisSpecialOperationPerson[]
  workers: SmisSpecialOperationPerson[]
  analysts: SmisSpecialOperationPerson[]
  siteAnalysisRecords: SmisSpecialOperationCatalogSelection[]
  relatedPermits: SmisSpecialOperationRelatedPermit[]
  safetyMeasures: SmisSpecialOperationCatalogSelection[]
  customValues: Record<string, unknown>
  workDescription: string | null
  sitePhotoUrls: string[]
  applicantName: string | null
  applicationTime: string | null
  currentNode: string
  status: SmisSpecialOperationPermitStatus
  voidReason?: string | null
  voidedBy?: string | null
  voidedAt?: string | null
  acceptanceResult?: string | null
  acceptanceDescription?: string | null
  acceptedBy?: string | null
  acceptedAt?: string | null
  events?: SmisSpecialOperationPermitEvent[]
  createTime: string
  updateTime: string
}

export interface SmisSpecialOperationPermitOverview {
  total: number
  draft: number
  pendingApproval: number
  rejected: number
  inProgress: number
  pendingAcceptance: number
  completed: number
  voided: number
}

export interface SmisSpecialOperationPermitSearchParams {
  from?: number
  to?: number
  keyword?: string
  operationTypeId?: string | null
  operationTypeCode?: string | null
  workStart?: string | null
  workEnd?: string | null
  applicantKeyword?: string
  status?: SmisSpecialOperationPermitStatus
  tenantId?: string | null
}

export interface SmisSpecialOperationPermitSavePayload {
  operationTypeId: string
  workContent: string | null
  workStartTime: string | null
  workEndTime: string | null
  workLocation: string | null
  workUnit: string | null
  workSection: string | null
  hotWorkLevel: string | null
  hotWorkMethods: string[]
  hazardFactors: SmisSpecialOperationCatalogSelection[]
  responsibleEmployee: SmisSpecialOperationPerson | null
  guardianEmployees: SmisSpecialOperationPerson[]
  verifierEmployees: SmisSpecialOperationPerson[]
  briefingGiverEmployees: SmisSpecialOperationPerson[]
  briefingReceiverEmployees: SmisSpecialOperationPerson[]
  workers: SmisSpecialOperationPerson[]
  analysts: SmisSpecialOperationPerson[]
  siteAnalysisRecords: SmisSpecialOperationCatalogSelection[]
  relatedPermits: SmisSpecialOperationRelatedPermit[]
  safetyMeasures: SmisSpecialOperationCatalogSelection[]
  customValues: Record<string, unknown>
  workDescription: string | null
  sitePhotoUrls: string[]
}

export interface SmisSpecialOperationFieldDefinition {
  id?: string
  fieldCode: string
  fieldLabel: string
  fieldType: SmisSpecialOperationFieldType
  required: boolean
  placeholder: string | null
  unit: string | null
  options: string[]
  sort: number
}

export interface SmisSpecialOperationType {
  id: string
  tenantId: string
  tenantName?: string
  tenantCode?: string
  typeCode: string
  typeName: string
  remark: string | null
  sort: number
  textColor: string | null
  tagStyle: SmisSpecialOperationTagStyle
  status: SmisSpecialOperationStatus
  fieldCount: number
  fieldDefinitions: SmisSpecialOperationFieldDefinition[]
  createBy: string | null
  createTime: string
  updateBy: string | null
  updateTime: string
}

export interface SmisSpecialOperationTypeOverview {
  total: number
  enabled: number
  disabled: number
  voided: number
  customFields: number
}

export interface SmisSpecialOperationTypeSearchParams {
  from?: number
  to?: number
  keyword?: string
  status?: SmisSpecialOperationStatus
  tagStyle?: SmisSpecialOperationTagStyle
  tenantId?: string | null
}

export interface SmisSpecialOperationTypeSavePayload {
  id?: string
  tenantId?: string | null
  typeCode: string
  typeName: string
  remark: string | null
  sort: number
  textColor: string | null
  tagStyle: SmisSpecialOperationTagStyle
  status: SmisSpecialOperationEditableStatus
  fieldDefinitions: SmisSpecialOperationFieldDefinition[]
}

export interface SmisSpecialOperationCatalogItem {
  id: string
  tenantId: string
  tenantName?: string
  tenantCode?: string
  catalogKind: SmisSpecialOperationCatalogKind
  operationTypeId: string
  operationTypeCode: string
  operationTypeName: string
  itemName: string
  recordType: SmisSpecialOperationRecordType | null
  normalValue: string | null
  abnormalValue: string | null
  sort: number
  textColor: string | null
  tagStyle: SmisSpecialOperationTagStyle
  status: SmisSpecialOperationStatus
  createBy: string | null
  createTime: string
  updateBy: string | null
  updateTime: string
}

export interface SmisSpecialOperationCatalogOverview {
  total: number
  enabled: number
  disabled: number
  voided: number
}

export interface SmisSpecialOperationCatalogSearchParams {
  catalogKind: SmisSpecialOperationCatalogKind
  from?: number
  to?: number
  keyword?: string
  operationTypeId?: string | null
  recordType?: SmisSpecialOperationRecordType
  status?: SmisSpecialOperationStatus
  tagStyle?: SmisSpecialOperationTagStyle
  tenantId?: string | null
}

export interface SmisSpecialOperationCatalogSavePayload {
  id?: string
  tenantId?: string | null
  catalogKind: SmisSpecialOperationCatalogKind
  operationTypeId: string
  itemName: string
  recordType: SmisSpecialOperationRecordType | null
  normalValue: string | null
  abnormalValue: string | null
  sort: number
  textColor: string | null
  tagStyle: SmisSpecialOperationTagStyle
  status: SmisSpecialOperationEditableStatus
}

interface OperationTypeListResult {
  records?: SmisSpecialOperationType[]
  total?: number
  overview?: SmisSpecialOperationTypeOverview
}

interface CatalogListResult {
  records?: SmisSpecialOperationCatalogItem[]
  total?: number
  overview?: SmisSpecialOperationCatalogOverview
}

interface PermitListResult {
  records?: SmisSpecialOperationPermit[]
  total?: number
  overview?: SmisSpecialOperationPermitOverview
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

const emptyTypeOverview = (): SmisSpecialOperationTypeOverview => ({
  total: 0,
  enabled: 0,
  disabled: 0,
  voided: 0,
  customFields: 0
})

const emptyCatalogOverview = (): SmisSpecialOperationCatalogOverview => ({
  total: 0,
  enabled: 0,
  disabled: 0,
  voided: 0
})

const emptyPermitOverview = (): SmisSpecialOperationPermitOverview => ({
  total: 0,
  draft: 0,
  pendingApproval: 0,
  rejected: 0,
  inProgress: 0,
  pendingAcceptance: 0,
  completed: 0,
  voided: 0
})

export async function fetchSpecialOperationTypeList(
  params: SmisSpecialOperationTypeSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<OperationTypeListResult>(
    () =>
      supabase.rpc('smis_list_special_operation_types_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_tag_style: params.tagStyle || null,
        p_tenant_id: params.tenantId || null
      }),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyTypeOverview(),
    error: result.error
  }
}

export async function saveSpecialOperationType(params: SmisSpecialOperationTypeSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_special_operation_type_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id', 'tenantId'])),
        p_tenant_id: params.tenantId || null
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '作业类型已更新' : '作业类型已新增'
    }
  )
}

export async function deleteSpecialOperationTypes(ids: string[], tenantId?: string | null) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_delete_special_operation_types_secure', {
        p_ids: ids,
        p_tenant_id: tenantId || null
      }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '作业类型已删除'
    }
  )
}

export async function voidSpecialOperationTypes(ids: string[], tenantId?: string | null) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_void_special_operation_types_secure', {
        p_ids: ids,
        p_tenant_id: tenantId || null
      }),
    { showMessage: true, breakReturn: true, message: '作业类型已作废' }
  )
}

export async function fetchSpecialOperationCatalogList(
  params: SmisSpecialOperationCatalogSearchParams
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<CatalogListResult>(
    () =>
      supabase.rpc('smis_list_special_operation_catalog_secure', {
        p_catalog_kind: params.catalogKind,
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_operation_type_id: params.operationTypeId || null,
        p_record_type: params.recordType || null,
        p_status: params.status || null,
        p_tag_style: params.tagStyle || null,
        p_tenant_id: params.tenantId || null
      }),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyCatalogOverview(),
    error: result.error
  }
}

export async function saveSpecialOperationCatalogItem(
  params: SmisSpecialOperationCatalogSavePayload
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_special_operation_catalog_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id', 'tenantId'])),
        p_tenant_id: params.tenantId || null
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '配置项已更新' : '配置项已新增'
    }
  )
}

export async function deleteSpecialOperationCatalogItems(
  catalogKind: SmisSpecialOperationCatalogKind,
  ids: string[],
  tenantId?: string | null
) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_delete_special_operation_catalog_secure', {
        p_catalog_kind: catalogKind,
        p_ids: ids,
        p_tenant_id: tenantId || null
      }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '配置项已删除'
    }
  )
}

export async function voidSpecialOperationCatalogItems(
  catalogKind: SmisSpecialOperationCatalogKind,
  ids: string[],
  tenantId?: string | null
) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_void_special_operation_catalog_secure', {
        p_catalog_kind: catalogKind,
        p_ids: ids,
        p_tenant_id: tenantId || null
      }),
    { showMessage: true, breakReturn: true, message: '配置项已作废' }
  )
}

export async function fetchSpecialOperationPermitList(
  params: SmisSpecialOperationPermitSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<PermitListResult>(
    () =>
      supabase.rpc('smis_list_special_operation_permits_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_operation_type_id: params.operationTypeId || null,
        p_operation_type_code: params.operationTypeCode || null,
        p_work_start: params.workStart || null,
        p_work_end: params.workEnd || null,
        p_applicant_keyword: normalizeNullableText(params.applicantKeyword),
        p_status: params.status || null,
        p_tenant_id: params.tenantId || null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyPermitOverview(),
    error: result.error
  }
}

export async function fetchSpecialOperationPermit(id: string, tenantId?: string | null) {
  return await responseHandle<SmisSpecialOperationPermit>(
    () =>
      supabase.rpc('smis_get_special_operation_permit_secure', {
        p_id: id,
        p_tenant_id: tenantId || null
      }),
    { showErrorMessage: true, breakReturn: true }
  )
}

export async function fetchSpecialOperationWorkerDefaults(
  employeeIds: string[],
  operationTypeCode = 'HOT_WORK',
  tenantId?: string | null
) {
  return await responseHandle<SmisSpecialOperationPerson[]>(
    () =>
      supabase.rpc('smis_get_special_operation_worker_defaults_secure', {
        p_employee_ids: employeeIds,
        p_operation_type_code: operationTypeCode,
        p_tenant_id: tenantId || null
      }),
    { showErrorMessage: true, breakReturn: true }
  )
}

export async function saveSpecialOperationPermit(
  id: string | undefined,
  payload: SmisSpecialOperationPermitSavePayload,
  submit: boolean,
  tenantId?: string | null
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_special_operation_permit_secure', {
        p_id: id || null,
        p_payload: keysToSnakeDeep(payload),
        p_submit: submit,
        p_tenant_id: tenantId || null
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: submit ? '作业票已提交审批' : '作业票草稿已保存'
    }
  )
}

export async function deleteSpecialOperationPermits(ids: string[], tenantId?: string | null) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_delete_special_operation_permits_secure', {
        p_ids: ids,
        p_tenant_id: tenantId || null
      }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '作业票已删除'
    }
  )
}

export async function transitionSpecialOperationPermit(
  id: string,
  action: SmisSpecialOperationTransitionAction,
  options: { result?: string | null; description?: string | null; tenantId?: string | null } = {}
) {
  const messageMap: Record<SmisSpecialOperationTransitionAction, string> = {
    start: options.result === 'rejected' ? '作业票已拒绝' : '作业票已进入作业中',
    request_acceptance: '验收申请已提交',
    accept: options.result === 'returned' ? '作业票已退回整改' : '作业票已验收完成',
    void: '作业票已作废'
  }
  return await responseHandle<SmisSpecialOperationPermitStatus>(
    () =>
      supabase.rpc('smis_transition_special_operation_permit_secure', {
        p_id: id,
        p_action: action,
        p_result: options.result || null,
        p_description: normalizeNullableText(options.description),
        p_tenant_id: options.tenantId || null
      }),
    { showMessage: true, breakReturn: true, message: messageMap[action] }
  )
}
