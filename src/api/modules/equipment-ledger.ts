import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import TreeUtils from '@/utils/tree'
import {
  compareEquipmentCategoryOrder,
  fetchEquipmentCategoryProfiles
} from '@smis/api/modules/equipment-category'
import type {
  SmisEquipment,
  SmisEquipmentAttachment,
  SmisEquipmentCategory,
  SmisEquipmentOverview,
  SmisEquipmentSavePayload,
  SmisEquipmentSearchParams,
  SmisStorageLocation
} from '@smis/api/types'

interface EquipmentLedgerListResult {
  records?: SmisEquipment[]
  total?: number
  categoryTree?: SmisEquipmentCategory[]
  locationTree?: SmisStorageLocation[]
  overview?: SmisEquipmentOverview
}

const emptyOverview = (): SmisEquipmentOverview => ({
  total: 0,
  inUse: 0,
  boilerCount: 0,
  dueSoon: 0
})

const categoryTreeUtils = new TreeUtils({
  idKey: 'id',
  parentKey: 'parentId',
  childrenKey: 'children'
})
const locationTreeUtils = new TreeUtils({
  idKey: 'id',
  parentKey: 'parentId',
  childrenKey: 'children'
})
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchEquipmentLedgerList(params: SmisEquipmentSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const [result, profileResult] = await Promise.all([
    responseHandle<EquipmentLedgerListResult>(
      () =>
        supabase.rpc('smis_list_equipment_ledger_secure', {
          ...buildSupabaseRpcRange(from, params.to ?? from + 19),
          p_keyword: normalizeNullableText(params.keyword),
          p_category_id: params.categoryId || null,
          p_location_id: params.locationId || null,
          p_equipment_kind: params.equipmentKind || null,
          p_model: normalizeNullableText(params.model),
          p_operation_status: params.operationStatus || null,
          p_supplier_id: params.supplierId || null,
          p_importance_level: params.importanceLevel || null,
          p_enable_date_from: params.enableDateFrom || null,
          p_enable_date_to: params.enableDateTo || null,
          p_asset_status: params.assetStatus || null,
          p_use_status: params.useStatus || null
        }),
      { showErrorMessage: false, breakReturn: true }
    ),
    fetchEquipmentCategoryProfiles()
  ])

  const profileMap = new Map(
    (profileResult.data ?? []).map((item) => [item.id, item.profileType] as const)
  )
  const categoryFlat = (result.data?.categoryTree ?? []).map((item) => ({
    ...item,
    profileType: profileMap.get(item.id || '') ?? item.profileType ?? 'general'
  }))
  const locationFlat = result.data?.locationTree ?? []
  return {
    data: (result.data?.records ?? []).map((item) => {
      const profileType = profileMap.get(item.categoryId) ?? 'general'
      return {
        ...item,
        profileType,
        category: { ...item.category, profileType }
      }
    }),
    total: result.data?.total ?? 0,
    categoryTree: categoryTreeUtils.listToTree(categoryFlat, compareEquipmentCategoryOrder),
    locationTree: locationTreeUtils.listToTree(locationFlat, (a, b) =>
      a.locationName.localeCompare(b.locationName, 'zh-CN')
    ),
    overview: result.data?.overview ?? emptyOverview(),
    error: result.error
  }
}

export async function saveEquipmentLedger(params: SmisEquipmentSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_equipment_archive_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '设备台账已更新' : '设备台账已新增'
    }
  )
}

export async function fetchEquipmentLedgerDetail(equipmentId: string) {
  return await responseHandle<SmisEquipment | null>(
    () => supabase.rpc('smis_get_equipment_archive_secure', { p_equipment_id: equipmentId }),
    { showErrorMessage: true }
  )
}

export async function deleteEquipmentLedger(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_equipment_ledger_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '设备台账已删除'
    }
  )
}

export async function fetchEquipmentAttachments(equipmentId: string) {
  return await responseHandle<SmisEquipmentAttachment[]>(
    () =>
      supabase
        .from('smis_equipment_attachment')
        .select('*, attachment:sys_attachment!smis_equipment_attachment_file_fkey(*)')
        .eq('equipment_id', equipmentId)
        .order('create_time', { ascending: false }),
    { showErrorMessage: true }
  )
}

export async function linkEquipmentAttachment(
  equipmentId: string,
  attachmentId: string,
  attachmentType: string,
  remark?: string
) {
  return await responseHandle(
    () =>
      supabase.from('smis_equipment_attachment').insert({
        equipment_id: equipmentId,
        attachment_id: attachmentId,
        attachment_type: attachmentType,
        remark: normalizeNullableText(remark)
      }),
    { showMessage: true, breakReturn: true, message: '设备附件已关联' }
  )
}

export async function deleteEquipmentAttachment(equipmentId: string, attachmentId: string) {
  return await responseHandle(
    () =>
      supabase
        .from('smis_equipment_attachment')
        .delete()
        .eq('equipment_id', equipmentId)
        .eq('attachment_id', attachmentId),
    {
      showMessage: true,
      breakReturn: true,
      message: '设备附件已移除'
    }
  )
}
