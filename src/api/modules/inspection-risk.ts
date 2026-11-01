import { normalizeNullableText } from '@/utils/form/normalize'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { fetchAllRangePages } from '@/utils/supabase/pagination'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  SmisConfigurableMenuOption,
  SmisDuplicateConfiguration,
  SmisDuplicateConfigurationPayload,
  SmisDuplicateConfigurationSearchParams,
  SmisInspectionItem,
  SmisInspectionItemPayload,
  SmisInspectionItemSearchParams,
  SmisInspectionStandard,
  SmisInspectionStandardPayload,
  SmisInspectionType,
  SmisInspectionTypePayload,
  SmisInspectionTypeSearchParams,
  SmisRiskAssessmentCriterion,
  SmisRiskAssessmentCriterionPayload,
  SmisRiskAssessmentLevel,
  SmisRiskAssessmentLevelPayload,
  SmisRiskAssessmentModel,
  SmisRiskControlMeasure,
  SmisRiskControlMeasurePayload,
  SmisRiskEvaluationPayload,
  SmisRiskEvaluationResult,
  SmisRiskFactorCategoryOption,
  SmisRiskItem,
  SmisRiskItemPayload,
  SmisRiskItemSearchParams,
  SmisRiskPositionOption
} from '@smis/api/types'

interface PagedResponse<TRecord> {
  data: TRecord[]
  total: number
  error: unknown
}

interface PositionListPayload {
  records?: SmisRiskPositionOption[]
  total?: number
}

interface RiskItemRow extends Omit<SmisRiskItem, 'evaluation' | 'measureCount'> {
  evaluation?: SmisRiskItem['evaluation'] | SmisRiskItem['evaluation'][]
  measures?: Array<{ count?: number }>
}

interface RiskMeasureRow extends Omit<SmisRiskControlMeasure, 'positions'> {
  positions?: Array<
    SmisRiskControlMeasure['positions'][number] & {
      position?: {
        id: string
        positionCode: string
        positionName: string
        organizationId?: string | null
      } | null
    }
  >
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

function applyRange<TQuery extends { range: (from: number, to: number) => TQuery }>(
  query: TQuery,
  from?: number,
  to?: number
): TQuery {
  if (from === undefined && to === undefined) return query
  const safeFrom = Math.max(from ?? 0, 0)
  return query.range(safeFrom, Math.max(to ?? safeFrom + 19, safeFrom))
}

export async function fetchInspectionStandards(tenantId?: string | null) {
  return await responseHandle<SmisInspectionStandard[]>(
    () =>
      fetchAllRangePages<SmisInspectionStandard>(async ({ from, to }) => {
        let query = supabase
          .from('smis_inspection_standard')
          .select('*')
          .order('sort')
          .order('standard_name')
          .order('id')
          .range(from, to)
        if (tenantId) query = query.eq('tenant_id', tenantId)
        return await query
      }),
    { showErrorMessage: false }
  )
}

export async function saveInspectionStandard(payload: SmisInspectionStandardPayload) {
  const writePayload = keysToSnakeDeep(omit(payload, ['id']))
  return await responseHandle(
    () =>
      payload.id
        ? supabase.from('smis_inspection_standard').update(writePayload).eq('id', payload.id)
        : supabase.from('smis_inspection_standard').insert(writePayload),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.id ? '排查标准已更新' : '排查标准已新增'
    }
  )
}

export async function deleteInspectionStandards(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_inspection_standard').delete({ count: 'exact' }).in('id', ids),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '排查标准已删除'
    }
  )
}

export async function voidInspectionStandards(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_inspection_standard').update({ status: 'voided' }).in('id', ids),
    { showMessage: true, breakReturn: true, message: '排查标准已作废' }
  )
}

export async function fetchInspectionItems(
  params: SmisInspectionItemSearchParams = {}
): Promise<PagedResponse<SmisInspectionItem>> {
  let query = supabase
    .from('smis_inspection_item')
    .select(
      '*, standard:smis_inspection_standard!smis_inspection_item_standard_fk(id, standard_code, standard_name)',
      { count: 'exact' }
    )
    .order('sort')
    .order('item_code')
  if (params.tenantId) query = query.eq('tenant_id', params.tenantId)
  if (params.ancestorStandardIds?.length)
    query = query.in('standard_id', params.ancestorStandardIds)
  else if (params.standardId) query = query.eq('standard_id', params.standardId)
  if (params.status) query = query.eq('status', params.status)
  if (params.ids?.length) query = query.in('id', params.ids)
  if (params.keyword?.trim()) {
    const keyword = params.keyword.trim()
    query = query.or(buildOrIlikeFilter(['item_code', 'inspection_content'], keyword))
  }
  const result = await responseHandle<SmisInspectionItem[]>(
    () => applyRange(query, params.from, params.to),
    { showErrorMessage: true }
  )
  return { data: result.data ?? [], total: result.total ?? 0, error: result.error }
}

export async function saveInspectionItem(payload: SmisInspectionItemPayload) {
  const writePayload = keysToSnakeDeep(omit(payload, ['id']))
  return await responseHandle(
    () =>
      payload.id
        ? supabase.from('smis_inspection_item').update(writePayload).eq('id', payload.id)
        : supabase.from('smis_inspection_item').insert(writePayload),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.id ? '排查项已更新' : '排查项已新增'
    }
  )
}

export async function deleteInspectionItems(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_inspection_item').delete({ count: 'exact' }).in('id', ids),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '排查项已删除'
    }
  )
}

export async function voidInspectionItems(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_inspection_item').update({ status: 'voided' }).in('id', ids),
    { showMessage: true, breakReturn: true, message: '排查项已作废' }
  )
}

export async function fetchInspectionTypes(
  params: SmisInspectionTypeSearchParams = {}
): Promise<PagedResponse<SmisInspectionType>> {
  let query = supabase
    .from('smis_inspection_type')
    .select('*', { count: 'exact' })
    .order('sort')
    .order('type_name')
  if (params.tenantId) query = query.eq('tenant_id', params.tenantId)
  if (params.status) query = query.eq('status', params.status)
  if (params.tagStyle) query = query.eq('tag_style', params.tagStyle)
  if (params.ids?.length) query = query.in('id', params.ids)
  if (params.keyword?.trim()) {
    const keyword = params.keyword.trim()
    query = query.or(buildOrIlikeFilter(['type_code', 'type_name'], keyword))
  }
  const result = await responseHandle<SmisInspectionType[]>(
    () => applyRange(query, params.from, params.to),
    { showErrorMessage: true }
  )
  return { data: result.data ?? [], total: result.total ?? 0, error: result.error }
}

export async function saveInspectionType(payload: SmisInspectionTypePayload) {
  const writePayload = keysToSnakeDeep(omit(payload, ['id']))
  return await responseHandle(
    () =>
      payload.id
        ? supabase.from('smis_inspection_type').update(writePayload).eq('id', payload.id)
        : supabase.from('smis_inspection_type').insert(writePayload),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.id ? '排查类型已更新' : '排查类型已新增'
    }
  )
}

export async function deleteInspectionTypes(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_inspection_type').delete({ count: 'exact' }).in('id', ids),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '排查类型已删除'
    }
  )
}

export async function voidInspectionTypes(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_inspection_type').update({ status: 'voided' }).in('id', ids),
    { showMessage: true, breakReturn: true, message: '排查类型已作废' }
  )
}

export async function fetchConfigurableMenuOptions() {
  const result = await responseHandle<SmisConfigurableMenuOption[]>(
    () => supabase.rpc('smis_list_configurable_menus_secure'),
    { showErrorMessage: true }
  )
  return result.data ?? []
}

export async function fetchDuplicateConfigurations(
  params: SmisDuplicateConfigurationSearchParams = {}
): Promise<PagedResponse<SmisDuplicateConfiguration>> {
  let query = supabase
    .from('smis_duplicate_configuration')
    .select('*, menu:sys_menu(id, name, path, meta)', { count: 'exact' })
    .order('sort')
    .order('content_item')
  if (params.tenantId) query = query.eq('tenant_id', params.tenantId)
  if (params.menuId) query = query.eq('menu_id', params.menuId)
  if (typeof params.repeatEnabled === 'boolean')
    query = query.eq('repeat_enabled', params.repeatEnabled)
  if (params.status) query = query.eq('status', params.status)
  if (params.ids?.length) query = query.in('id', params.ids)
  if (params.keyword?.trim()) {
    const keyword = params.keyword.trim()
    query = query.ilike('content_item', `%${keyword}%`)
  }
  const result = await responseHandle<SmisDuplicateConfiguration[]>(
    () => applyRange(query, params.from, params.to),
    { showErrorMessage: true }
  )
  return { data: result.data ?? [], total: result.total ?? 0, error: result.error }
}

export async function saveDuplicateConfiguration(payload: SmisDuplicateConfigurationPayload) {
  const writePayload = keysToSnakeDeep(omit(payload, ['id']))
  return await responseHandle(
    () =>
      payload.id
        ? supabase.from('smis_duplicate_configuration').update(writePayload).eq('id', payload.id)
        : supabase.from('smis_duplicate_configuration').insert(writePayload),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.id ? '重复配置已更新' : '重复配置已新增'
    }
  )
}

export async function deleteDuplicateConfigurations(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_duplicate_configuration').delete({ count: 'exact' }).in('id', ids),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '重复配置已删除'
    }
  )
}

export async function voidDuplicateConfigurations(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_duplicate_configuration').update({ status: 'voided' }).in('id', ids),
    { showMessage: true, breakReturn: true, message: '重复配置已作废' }
  )
}

export async function fetchRiskAssessmentModels(tenantId?: string | null) {
  let query = supabase
    .from('smis_risk_assessment_model')
    .select(
      `
        *,
        dimensions:smis_risk_assessment_dimension(
          *, criteria:smis_risk_assessment_criterion(*)
        ),
        levels:smis_risk_assessment_level(*)
      `
    )
    .order('method_code')
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const result = await responseHandle<SmisRiskAssessmentModel[]>(() => query, {
    showErrorMessage: true
  })
  const records = result.data ?? []
  records.forEach((model) => {
    model.dimensions.sort((a, b) => a.sort - b.sort)
    model.dimensions.forEach((dimension) =>
      dimension.criteria.sort((a, b) => a.sort - b.sort || b.score - a.score)
    )
    model.levels.sort((a, b) => a.sort - b.sort)
  })
  return { ...result, data: records }
}

export async function saveRiskAssessmentCriterion(payload: SmisRiskAssessmentCriterionPayload) {
  const writePayload = keysToSnakeDeep(omit(payload, ['id']))
  return await responseHandle(
    () =>
      payload.id
        ? supabase.from('smis_risk_assessment_criterion').update(writePayload).eq('id', payload.id)
        : supabase.from('smis_risk_assessment_criterion').insert(writePayload),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.id ? '判定标准已更新' : '判定标准已新增'
    }
  )
}

export async function deleteRiskAssessmentCriteria(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_risk_assessment_criterion').delete({ count: 'exact' }).in('id', ids),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '判定标准已删除'
    }
  )
}

export async function saveRiskAssessmentLevel(payload: SmisRiskAssessmentLevelPayload) {
  const writePayload = keysToSnakeDeep(omit(payload, ['id']))
  return await responseHandle(
    () => supabase.from('smis_risk_assessment_level').update(writePayload).eq('id', payload.id),
    { showMessage: true, breakReturn: true, message: '风险等级阈值已更新' }
  )
}

export async function fetchRiskFactorCategoryOptions() {
  const result = await responseHandle<SmisRiskFactorCategoryOption[]>(
    () => supabase.rpc('smis_list_active_hazard_factor_categories_secure'),
    { showErrorMessage: true }
  )
  return result.data ?? []
}

export async function fetchRiskItems(
  params: SmisRiskItemSearchParams = {}
): Promise<PagedResponse<SmisRiskItem>> {
  let query = supabase
    .from('smis_risk_item')
    .select(
      `
        *,
        factorCategory:smis_hazard_factor_category!smis_risk_item_factor_category_fk(
          id, category_code, category_name, factor_type
        ),
        riskPointRecord:smis_risk_point!smis_risk_item_point_fk(id, point_no, point_name),
        evaluation:smis_risk_evaluation!smis_risk_evaluation_item_fk(
          *, level:smis_risk_assessment_level!smis_risk_evaluation_level_fk(*)
        ),
        measures:smis_risk_control_measure(count)
      `,
      { count: 'exact' }
    )
    .order('sort')
    .order('item_no')
  if (params.tenantId) query = query.eq('tenant_id', params.tenantId)
  if (params.factorCategoryId) query = query.eq('factor_category_id', params.factorCategoryId)
  if (params.status) query = query.eq('status', params.status)
  if (params.ids?.length) query = query.in('id', params.ids)
  if (params.keyword?.trim()) {
    const keyword = params.keyword.trim().replace(/[,%_().:"\\]/g, ' ')
    query = query.or(buildOrIlikeFilter(['item_no', 'risk_point', 'hazard_factor'], keyword))
  }
  const result = await responseHandle<RiskItemRow[]>(
    () => applyRange(query, params.from, params.to),
    { showErrorMessage: true }
  )
  return {
    error: result.error,
    total: result.total ?? 0,
    data: (result.data ?? []).map((row) => ({
      ...omit(row, ['measures']),
      evaluation: Array.isArray(row.evaluation) ? row.evaluation[0] : row.evaluation,
      measureCount: row.measures?.[0]?.count ?? 0
    })) as SmisRiskItem[]
  }
}

export async function saveRiskItem(payload: SmisRiskItemPayload) {
  const writePayload = keysToSnakeDeep(omit(payload, ['id']))
  return await responseHandle(
    () =>
      payload.id
        ? supabase.from('smis_risk_item').update(writePayload).eq('id', payload.id)
        : supabase.from('smis_risk_item').insert(writePayload),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.id ? '危险有害因素已更新' : '危险有害因素已辨识'
    }
  )
}

export async function deleteRiskItems(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_risk_item').delete({ count: 'exact' }).in('id', ids),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '危险有害因素已删除'
    }
  )
}

export async function voidRiskItems(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_risk_item').update({ status: 'voided' }).in('id', ids),
    { showMessage: true, breakReturn: true, message: '危险有害因素已作废' }
  )
}

export async function saveRiskEvaluation(payload: SmisRiskEvaluationPayload) {
  return await responseHandle<SmisRiskEvaluationResult>(
    () =>
      supabase.rpc('smis_save_risk_evaluation_secure', {
        p_risk_item_id: payload.riskItemId,
        p_method_code: payload.methodCode,
        p_l_value: payload.lValue,
        p_e_value: payload.eValue ?? null,
        p_c_value: payload.cValue ?? null,
        p_s_value: payload.sValue ?? null
      }),
    { showMessage: true, breakReturn: true, message: '定量风险评价已保存' }
  )
}

export async function fetchRiskControlMeasures(riskItemId: string) {
  const result = await responseHandle<RiskMeasureRow[]>(
    () =>
      supabase
        .from('smis_risk_control_measure')
        .select(
          `
            *,
            positions:smis_risk_control_measure_position(
              *, position:mdm_position(id, position_code, position_name, organization_id)
            )
          `
        )
        .eq('risk_item_id', riskItemId)
        .order('sort'),
    { showErrorMessage: true }
  )
  return {
    ...result,
    data: (result.data ?? []).map((row) => ({ ...row, positions: row.positions ?? [] }))
  }
}

export async function fetchRiskPositionOptions(keyword = '', from = 0, to = 49) {
  const result = await responseHandle<PositionListPayload>(
    () =>
      supabase.rpc('smis_list_active_risk_positions_secure', {
        p_keyword: normalizeNullableText(keyword),
        p_from: from,
        p_to: to
      }),
    { showErrorMessage: true }
  )
  return { data: result.data?.records ?? [], total: result.data?.total ?? 0 }
}

export async function saveRiskControlMeasure(payload: SmisRiskControlMeasurePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_risk_control_measure_secure', {
        p_id: payload.id ?? null,
        p_risk_item_id: payload.riskItemId,
        p_payload: keysToSnakeDeep(omit(payload, ['id', 'riskItemId', 'positions'])),
        p_positions: keysToSnakeDeep(payload.positions)
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: payload.id ? '控制措施已更新' : '控制措施已新增'
    }
  )
}

export async function deleteRiskControlMeasures(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_risk_control_measure').delete({ count: 'exact' }).in('id', ids),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '控制措施已删除'
    }
  )
}

export async function voidRiskControlMeasures(ids: string[]) {
  return await responseHandle(
    () => supabase.from('smis_risk_control_measure').update({ status: 'voided' }).in('id', ids),
    { showMessage: true, breakReturn: true, message: '控制措施已作废' }
  )
}

export type { SmisRiskAssessmentCriterion, SmisRiskAssessmentLevel, SmisRiskAssessmentModel }
