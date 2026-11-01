import type { ApiFeedbackOptions } from '@/types/api/request'
import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { chunk, omit, uniq } from 'lodash-es'
import {
  fetchRecordDeleteDependencies,
  type RecordDeleteDependency
} from '@/api/master-data-delete'
import { fetchAllRangePages } from '@/utils/supabase/pagination'
import { useSupabase } from '@/hooks/core/useSupabase'
import TreeUtils from '@/utils/tree'
import type {
  SmisHazardousWasteCatalogItem,
  SmisHazardousWasteCatalogOverview,
  SmisHazardousWasteCatalogSavePayload,
  SmisHazardousWasteCatalogSearchParams,
  SmisHazardousWasteCategory,
  SmisHazardousWasteCategorySavePayload,
  SmisHazardousWasteDocument,
  SmisHazardousWasteDocumentDirection,
  SmisHazardousWasteDocumentOverview,
  SmisHazardousWasteDocumentSavePayload,
  SmisHazardousWasteDocumentSearchParams,
  SmisHazardousWasteWarehouse,
  SmisHazardousWasteWarehouseOverview,
  SmisHazardousWasteWarehouseSavePayload,
  SmisHazardousWasteWarehouseSearchParams
} from '@smis/api/types'

interface WarehouseListResult {
  records?: SmisHazardousWasteWarehouse[]
  total?: number
  overview?: SmisHazardousWasteWarehouseOverview
}

interface CatalogListResult {
  records?: SmisHazardousWasteCatalogItem[]
  total?: number
  categories?: SmisHazardousWasteCategory[]
  overview?: SmisHazardousWasteCatalogOverview
}

interface DocumentListResult {
  records?: SmisHazardousWasteDocument[]
  total?: number
  overview?: SmisHazardousWasteDocumentOverview
}

const categoryTree = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchHazardousWasteWarehouseList(
  params: SmisHazardousWasteWarehouseSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<WarehouseListResult>(
    () =>
      supabase.rpc('smis_list_hazardous_waste_warehouses_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_ids: params.ids?.length ? params.ids : null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? { total: 0, enabled: 0, managed: 0, regionCount: 0 },
    error: result.error
  }
}

export async function saveHazardousWasteWarehouse(params: SmisHazardousWasteWarehouseSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_hazardous_waste_warehouse_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '危废仓库已更新' : '危废仓库已新增'
    }
  )
}

export async function deleteHazardousWasteWarehouses(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_hazardous_waste_warehouses_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      breakReturn: true,
      requireAffected: true,
      noAffectedMessage: '所选仓库未删除，请刷新列表核对状态和权限后重试'
    }
  )
}

export async function fetchHazardousWasteCatalogList(
  params: SmisHazardousWasteCatalogSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<CatalogListResult>(
    () =>
      supabase.rpc('smis_list_hazardous_waste_catalog_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_category_id: params.categoryId || null,
        p_ids: params.ids?.length ? params.ids : null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    categories: categoryTree.listToTree(
      result.data?.categories ?? [],
      (left, right) =>
        (left.sort ?? 0) - (right.sort ?? 0) ||
        left.categoryName.localeCompare(right.categoryName, 'zh-CN')
    ),
    overview: result.data?.overview ?? {
      total: 0,
      enabled: 0,
      categoryCount: 0,
      characteristicCount: 0
    },
    error: result.error
  }
}

export async function saveHazardousWasteCategory(params: SmisHazardousWasteCategorySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_hazardous_waste_category_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '危废分类已更新' : '危废分类已新增'
    }
  )
}

export async function deleteHazardousWasteCategories(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_hazardous_waste_categories_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      breakReturn: true,
      requireAffected: true,
      noAffectedMessage: '所选分类未删除，请刷新列表核对状态和权限后重试'
    }
  )
}

export async function saveHazardousWasteCatalog(params: SmisHazardousWasteCatalogSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_hazardous_waste_catalog_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '危废名录已更新' : '危废名录已新增'
    }
  )
}

export async function deleteHazardousWasteCatalog(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_hazardous_waste_catalog_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      breakReturn: true,
      requireAffected: true,
      noAffectedMessage: '所选名录未删除，请刷新列表核对状态和权限后重试'
    }
  )
}

export interface HazardousWasteCatalogDeleteDependency extends RecordDeleteDependency {
  documentDirection?: SmisHazardousWasteDocumentDirection
}

export async function fetchHazardousWasteCatalogDeleteDependencies(
  ids: string[]
): Promise<HazardousWasteCatalogDeleteDependency[]> {
  const references = await fetchRecordDeleteDependencies({
    table: 'smis_hazardous_waste_catalog',
    ids
  })
  interface DocumentItemReference {
    id: string
    document: Pick<SmisHazardousWasteDocument, 'id' | 'documentNo' | 'direction' | 'status'> | null
  }
  const documents = new Map<string, DocumentItemReference['document']>()
  const itemIds = uniq(
    references
      .filter((row) => row.sourceTable === 'smis_hazardous_waste_document_item')
      .map((row) => row.targetId)
  )
  for (const batch of chunk(itemIds, 100)) {
    const { data, error } = await fetchAllRangePages<DocumentItemReference>(({ from, to }) =>
      responseHandle<DocumentItemReference[]>(
        () =>
          supabase
            .from('smis_hazardous_waste_document_item')
            .select(
              'id,document:smis_hazardous_waste_document!smis_hazardous_waste_document_item_document_id_fkey(id,document_no,direction,status)'
            )
            .in('id', batch)
            .range(from, to),
        { breakReturn: true, showErrorMessage: false, errorMessage: '关联单据定位失败，请重试' }
      )
    )
    if (error || !data) throw new Error('关联单据定位失败，请重试', { cause: error })
    for (const row of data) documents.set(row.id, row.document)
  }
  return references.map((row) => {
    if (row.sourceTable !== 'smis_hazardous_waste_document_item') return row
    const document = documents.get(row.targetId)
    if (
      !document?.id ||
      !document.documentNo ||
      (document.direction !== 'inbound' && document.direction !== 'outbound')
    ) {
      throw new Error('关联单据暂不可见，请核对查看权限后重新检查')
    }
    return {
      ...row,
      targetId: document.id,
      recordNo: document.documentNo,
      recordStatus: document.status,
      documentDirection: document.direction
    }
  })
}

export async function fetchHazardousWasteDocumentList(
  direction: SmisHazardousWasteDocumentDirection,
  params: SmisHazardousWasteDocumentSearchParams = {},
  options: ApiFeedbackOptions = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<DocumentListResult>(
    () =>
      supabase.rpc('smis_list_hazardous_waste_documents_secure', {
        p_direction: direction,
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_document_no: normalizeNullableText(params.documentNo),
        p_date_from: params.dateRange?.[0] ?? null,
        p_date_to: params.dateRange?.[1] ?? null,
        p_warehouse_id: params.warehouseId || null,
        p_handler_keyword: normalizeNullableText(params.handlerKeyword),
        p_status: params.status || null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: options.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? {
      total: 0,
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      quantity: 0
    },
    error: result.error
  }
}

export async function saveHazardousWasteDocument(
  direction: SmisHazardousWasteDocumentDirection,
  params: SmisHazardousWasteDocumentSavePayload
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_hazardous_waste_document_secure', {
        p_direction: direction,
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: `${direction === 'inbound' ? '入库' : '出库'}单草稿已保存`
    }
  )
}

export async function deleteHazardousWasteDocuments(
  direction: SmisHazardousWasteDocumentDirection,
  ids: string[]
) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_delete_hazardous_waste_documents_secure', {
        p_direction: direction,
        p_ids: ids
      }),
    {
      showReferenceFeedback: false,
      breakReturn: true,
      showErrorMessage: false,
      requireAffected: true,
      noAffectedMessage: '所选单据未删除，请刷新列表核对状态和权限后重试',
      errorMessage: '危废单据删除失败，请重试'
    }
  )
}

export async function transitionHazardousWasteDocument(
  direction: SmisHazardousWasteDocumentDirection,
  id: string,
  action: 'submit' | 'approve' | 'reject',
  remark?: string
) {
  const actionLabel = { submit: '提交审核', approve: '审核通过', reject: '审核拒绝' }[action]
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_transition_hazardous_waste_document_secure', {
        p_direction: direction,
        p_id: id,
        p_action: action,
        p_remark: normalizeNullableText(remark)
      }),
    { showMessage: true, breakReturn: true, message: `危废单据已${actionLabel}` }
  )
}
