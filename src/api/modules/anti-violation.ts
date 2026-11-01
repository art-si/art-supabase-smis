import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import dayjs from 'dayjs'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import TreeUtils from '@/utils/tree'
import type {
  SmisAntiViolationOrganization,
  SmisAntiViolationStandard,
  SmisAntiViolationStandardOverview,
  SmisAntiViolationStandardSavePayload,
  SmisAntiViolationStandardSearchParams,
  SmisAntiViolationStandardOption,
  SmisThreeViolationEducation,
  SmisThreeViolationEducationListResult,
  SmisThreeViolationEducationOverview,
  SmisThreeViolationEducationRecordPayload,
  SmisThreeViolationEducationSavePayload,
  SmisThreeViolationEducationSearchParams,
  SmisViolationCategory,
  SmisViolationCategoryOverview,
  SmisViolationCategorySavePayload,
  SmisViolationCategorySearchParams
} from '@smis/api/types'

interface ViolationCategoryListPayload {
  records?: SmisViolationCategory[]
  total?: number
  tree?: SmisViolationCategory[]
  overview?: SmisViolationCategoryOverview
}

interface AntiViolationStandardListPayload {
  records?: SmisAntiViolationStandard[]
  total?: number
  overview?: SmisAntiViolationStandardOverview
}

interface ThreeViolationEducationListPayload {
  records?: SmisThreeViolationEducation[]
  total?: number
  overview?: SmisThreeViolationEducationOverview
  organizations?: SmisAntiViolationOrganization[]
  standards?: SmisAntiViolationStandardOption[]
}

const categoryTreeUtils = new TreeUtils({
  idKey: 'id',
  parentKey: 'parentId',
  childrenKey: 'children'
})
const organizationTreeUtils = new TreeUtils({
  idKey: 'id',
  parentKey: 'parentId',
  childrenKey: 'children'
})
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

const emptyCategoryOverview = (): SmisViolationCategoryOverview => ({
  total: 0,
  enabled: 0,
  rootCount: 0,
  usedCount: 0
})

const emptyStandardOverview = (): SmisAntiViolationStandardOverview => ({
  total: 0,
  enabled: 0,
  disabled: 0,
  totalPoints: 0
})

const emptyEducationOverview = (): SmisThreeViolationEducationOverview => ({
  total: 0,
  pending: 0,
  educated: 0,
  warning: 0
})

const buildCategoryTree = (items: SmisViolationCategory[]): SmisViolationCategory[] =>
  categoryTreeUtils.listToTree(
    items,
    (a, b) => a.sort - b.sort || a.categoryName.localeCompare(b.categoryName, 'zh-CN')
  )

const buildOrganizationTree = (
  items: SmisAntiViolationOrganization[]
): SmisAntiViolationOrganization[] =>
  organizationTreeUtils.listToTree(
    items,
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, 'zh-CN')
  )

export async function fetchViolationCategoryList(params: SmisViolationCategorySearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<ViolationCategoryListPayload>(
    () =>
      supabase.rpc('smis_list_violation_categories_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_ancestor_id: params.ancestorId || null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    tree: buildCategoryTree(result.data?.tree ?? []),
    overview: result.data?.overview ?? emptyCategoryOverview(),
    error: result.error
  }
}

export async function saveViolationCategory(params: SmisViolationCategorySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_violation_category_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '违章分类已更新' : '违章分类已新增'
    }
  )
}

export async function deleteViolationCategories(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_violation_categories_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '违章分类已删除'
    }
  )
}

export async function fetchAntiViolationStandardList(
  params: SmisAntiViolationStandardSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<AntiViolationStandardListPayload>(
    () =>
      supabase.rpc('smis_list_anti_violation_standards_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_category_id: params.categoryId || null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyStandardOverview(),
    error: result.error
  }
}

export async function saveAntiViolationStandard(params: SmisAntiViolationStandardSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_anti_violation_standard_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '反违章标准已更新' : '反违章标准已新增'
    }
  )
}

export async function deleteAntiViolationStandards(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_anti_violation_standards_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '反违章标准已删除'
    }
  )
}

export async function fetchThreeViolationEducationList(
  params: SmisThreeViolationEducationSearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const [startTime, endTime] = params.inspectionTimeRange ?? []
  const result = await responseHandle<ThreeViolationEducationListPayload>(
    () =>
      supabase.rpc('smis_list_three_violation_education_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_organization_id: params.organizationId || null,
        p_checker_employee_id: params.checkerEmployeeId || null,
        p_education_status: params.educationStatus || null,
        p_warning_status: params.warningStatus || null,
        p_start_time: startTime ? dayjs(startTime).startOf('day').toISOString() : null,
        p_end_time: endTime ? dayjs(endTime).endOf('day').toISOString() : null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: true }
  )

  const payload: SmisThreeViolationEducationListResult = {
    records: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyEducationOverview(),
    organizations: buildOrganizationTree(result.data?.organizations ?? []),
    standards: result.data?.standards ?? []
  }
  return {
    data: payload.records,
    total: payload.total,
    overview: payload.overview,
    organizations: payload.organizations,
    standards: payload.standards,
    error: result.error
  }
}

export async function saveThreeViolationEducation(params: SmisThreeViolationEducationSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_three_violation_education_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '三违人员信息已更新' : '三违人员信息已新增'
    }
  )
}

export async function recordThreeViolationEducation(
  id: string,
  params: SmisThreeViolationEducationRecordPayload
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_record_three_violation_education_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(params)
      }),
    { showMessage: true, breakReturn: true, message: '教育信息已记录' }
  )
}

export async function deleteThreeViolationEducation(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_three_violation_education_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '三违人员信息已删除'
    }
  )
}
