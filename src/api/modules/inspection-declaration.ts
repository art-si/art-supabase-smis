import type { ApiFeedbackOptions } from '@/types/api/request'
import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  SmisEquipmentInspection,
  SmisEquipmentInspectionOverview,
  SmisEquipmentInspectionSavePayload,
  SmisEquipmentInspectionSearchParams
} from '@smis/api/types'

interface InspectionListResult {
  records?: SmisEquipmentInspection[]
  total?: number
  overview?: SmisEquipmentInspectionOverview
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export type SmisEquipmentInspectionReference = Pick<
  SmisEquipmentInspection,
  | 'id'
  | 'equipmentId'
  | 'inspectionNo'
  | 'inspectionDate'
  | 'conclusion'
  | 'nextDueDate'
  | 'status'
  | 'remark'
  | 'inspectionInstitution'
> & {
  inspectionCategory: SmisEquipmentInspection['inspectionCategory'] | null
}

export async function fetchEquipmentInspectionReference(id: string, equipmentId: string) {
  return await responseHandle<SmisEquipmentInspectionReference | null>(
    () =>
      supabase
        .from('smis_equipment_inspection')
        .select(
          `id,equipment_id,inspection_no,inspection_date,conclusion,next_due_date,status,remark,
          inspectionCategory:smis_inspection_category!smis_equipment_inspection_category_fkey(id,category_code,category_name),
          inspectionInstitution:mdm_supplier!smis_equipment_inspection_institution_fkey(id,supplier_code,supplier_name)`
        )
        .eq('id', id)
        .eq('equipment_id', equipmentId)
        .maybeSingle(),
    { breakReturn: true, showErrorMessage: false }
  )
}

const emptyOverview = (): SmisEquipmentInspectionOverview => ({
  total: 0,
  completed: 0,
  dueSoon: 0,
  imageCount: 0
})

export async function fetchEquipmentInspectionList(
  params: SmisEquipmentInspectionSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<InspectionListResult>(
    () =>
      supabase.rpc('smis_list_equipment_inspections_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_equipment_id: params.equipmentId || null,
        p_organization_id: params.organizationId || null,
        p_inspection_category_id: params.inspectionCategoryId || null,
        p_status: params.status || null
      }),
    { showErrorMessage: options.showErrorMessage ?? false, breakReturn: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyOverview(),
    error: result.error
  }
}

export async function saveEquipmentInspection(params: SmisEquipmentInspectionSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_equipment_inspection_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '检验申报已更新' : '检验申报已新增'
    }
  )
}

export async function deleteEquipmentInspections(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_equipment_inspections_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '检验申报已删除'
    }
  )
}
