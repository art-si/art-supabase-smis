import { emptySafetyQualificationAnalysis } from '@smis/domain/report-defaults'
import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import dayjs from 'dayjs'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type { ApiFeedbackOptions } from '@/types/api/request'
import TreeUtils from '@/utils/tree'
import type {
  EmployeeIntegrationItem,
  EmployeeSelectorContractParams
} from '@/api/integration/employees'
import type {
  SmisPersonnelCertificate,
  SmisPersonnelCertificateOverview,
  SmisPersonnelCertificateSavePayload,
  SmisPersonnelCertificateSearchParams,
  SmisSafetyQualificationAnalysisResult,
  SmisSafetyQualificationAnalysisSearchParams,
  SmisQualificationCatalog,
  SmisQualificationCatalogNavigationNode,
  SmisQualificationCatalogOverview,
  SmisQualificationCatalogSavePayload,
  SmisQualificationCatalogSearchParams,
  SmisQualificationMaintenanceCatalogType
} from '@smis/api/types'

interface QualificationCatalogPayload {
  records?: SmisQualificationCatalog[]
  total?: number
  tree?: SmisQualificationCatalog[]
  workCategories?: SmisQualificationCatalog[]
  overview?: SmisQualificationCatalogOverview
}

interface PersonnelCertificatePayload {
  records?: SmisPersonnelCertificate[]
  total?: number
  overview?: SmisPersonnelCertificateOverview
}

interface PersonnelCertificateEmployeePayload {
  records?: PersonnelCertificateEmployee[]
  total?: number
}

interface PersonnelCertificateCatalogPayload {
  records?: SmisQualificationCatalog[]
}

export interface PersonnelCertificateEmployee extends EmployeeIntegrationItem {
  idCardNo?: string | null
  educationLevel?: string | null
}

const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchQualificationCatalogList(
  params: SmisQualificationCatalogSearchParams,
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<QualificationCatalogPayload>(
    () =>
      supabase.rpc('smis_list_qualification_catalog_secure', {
        p_catalog_type: params.catalogType,
        ...buildSupabaseRpcRange(from, params.to ?? from + 99),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_ancestor_id: params.ancestorId || null,
        p_purpose: params.purpose ?? 'list',
        p_work_category_id: params.workCategoryId || null
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  const sorter = (a: SmisQualificationCatalog, b: SmisQualificationCatalog) =>
    a.sort - b.sort || a.itemName.localeCompare(b.itemName, 'zh-CN')
  const items = result.data?.tree ?? []
  const workCategories = result.data?.workCategories ?? []
  const navigationRecords: SmisQualificationCatalogNavigationNode[] =
    params.catalogType === 'permitted_operation_item'
      ? [
          ...workCategories.map((item) => ({
            ...omit(item, ['children']),
            nodeKind: 'category' as const
          })),
          ...items.map((item) => ({
            ...omit(item, ['children']),
            parentId: item.parentId || item.workCategoryId,
            nodeKind: 'item' as const
          }))
        ]
      : items.map((item) => ({ ...omit(item, ['children']), nodeKind: 'item' as const }))
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    tree: treeUtils.listToTree(items, sorter) as SmisQualificationCatalog[],
    workCategories: treeUtils.listToTree(workCategories, sorter) as SmisQualificationCatalog[],
    navigationTree: treeUtils.listToTree(
      navigationRecords,
      sorter
    ) as SmisQualificationCatalogNavigationNode[],
    overview: result.data?.overview ?? { total: 0, enabled: 0, disabled: 0, rootCount: 0 },
    error: result.error
  }
}

export async function saveQualificationCatalog(params: SmisQualificationCatalogSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_qualification_catalog_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '基础数据已更新' : '基础数据已新增'
    }
  )
}

export async function deleteQualificationCatalog(
  catalogType: SmisQualificationMaintenanceCatalogType,
  ids: string[]
) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_delete_qualification_catalog_secure', {
        p_catalog_type: catalogType,
        p_ids: ids
      }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '基础数据已删除'
    }
  )
}

export async function fetchPersonnelCertificateList(
  params: SmisPersonnelCertificateSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const [startDate, endDate] = params.effectiveDateRange ?? []
  const result = await responseHandle<PersonnelCertificatePayload>(
    () =>
      supabase.rpc('smis_list_personnel_certificates_extended_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_employee_name: normalizeNullableText(params.employeeName),
        p_certificate_number: normalizeNullableText(params.certificateNumber),
        p_certificate_category: params.certificateCategory || null,
        p_start_date: startDate ? dayjs(startDate).format('YYYY-MM-DD') : null,
        p_end_date: endDate ? dayjs(endDate).format('YYYY-MM-DD') : null,
        p_warning_status: params.warningStatus || null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      total: 0,
      normal: 0,
      warning: 0,
      expired: 0,
      employees: 0
    },
    error: result.error
  }
}

export async function fetchPersonnelCertificateEmployeeOptions(
  category: SmisPersonnelCertificateSavePayload['certificateCategory'],
  params: EmployeeSelectorContractParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<PersonnelCertificateEmployeePayload>(
    () =>
      supabase.rpc('smis_list_certificate_employees_secure', {
        p_certificate_category: category,
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

export async function fetchPersonnelCertificateEmployeeDetail(
  category: SmisPersonnelCertificateSavePayload['certificateCategory'],
  employeeId: string
) {
  return await responseHandle<PersonnelCertificateEmployee>(
    () =>
      supabase.rpc('smis_get_certificate_employee_secure', {
        p_certificate_category: category,
        p_employee_id: employeeId
      }),
    { showErrorMessage: true }
  )
}

export async function fetchPersonnelCertificateCatalogOptions(
  category: SmisPersonnelCertificateSavePayload['certificateCategory']
) {
  const result = await responseHandle<PersonnelCertificateCatalogPayload>(
    () =>
      supabase.rpc('smis_list_certificate_catalog_options_secure', {
        p_certificate_category: category
      }),
    { showErrorMessage: true }
  )
  return { data: result.data?.records ?? [], error: result.error }
}

export async function fetchSafetyQualificationAnalysis(
  params: SmisSafetyQualificationAnalysisSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const result = await responseHandle<SmisSafetyQualificationAnalysisResult>(
    () =>
      supabase.rpc('smis_get_safety_qualification_analysis_secure', {
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_organization_id: params.organizationId || null
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  const data = result.data ?? emptySafetyQualificationAnalysis()
  return {
    ...data,
    organizationOptions: treeUtils.listToTree(
      data.organizationOptions,
      (a, b) => a.sort - b.sort || a.organizationName.localeCompare(b.organizationName, 'zh-CN')
    ) as typeof data.organizationOptions,
    error: result.error
  }
}

export async function savePersonnelCertificate(params: SmisPersonnelCertificateSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_personnel_certificate_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '人员证件已更新' : '人员证件已新增'
    }
  )
}

export async function deletePersonnelCertificates(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_personnel_certificates_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '人员证件已删除'
    }
  )
}
