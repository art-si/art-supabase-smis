import { buildSupabaseRpcRange } from '@/utils/supabase'
import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeBooleanFilter } from '@/api/providers/supabase/query'
import TreeUtils from '@/utils/tree'
import type {
  SmisDocument,
  SmisDocumentCategory,
  SmisDocumentCategorySavePayload,
  SmisDocumentDuplicate,
  SmisDocumentOverview,
  SmisDocumentRegister,
  SmisDocumentRegisterOverview,
  SmisDocumentRegisterSavePayload,
  SmisDocumentRegisterSearchParams,
  SmisDocumentSavePayload,
  SmisDocumentSaveResult,
  SmisDocumentSearchParams,
  SmisLegalComplianceEvaluation,
  SmisLegalComplianceEvaluationSavePayload,
  SmisLegalComplianceEvaluationSearchParams
} from '@smis/api/types'

interface DocumentListResult {
  records?: SmisDocument[]
  total?: number
  overview?: SmisDocumentOverview
}

interface DocumentRegisterListResult {
  records?: SmisDocumentRegister[]
  total?: number
  overview?: SmisDocumentRegisterOverview
}

interface LegalComplianceEvaluationListResult {
  records?: SmisLegalComplianceEvaluation[]
  total?: number
}

const emptyOverview = (): SmisDocumentOverview => ({
  total: 0,
  published: 0,
  draft: 0,
  scheduled: 0
})

const categoryTree = new TreeUtils({
  idKey: 'id',
  parentKey: 'parentId',
  childrenKey: 'children'
})

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export async function fetchDocumentCategories() {
  const result = await responseHandle<SmisDocumentCategory[]>(
    () => supabase.rpc('smis_list_document_categories_secure'),
    { showErrorMessage: true, breakReturn: true }
  )

  return categoryTree.listToTree(result.data ?? []) as SmisDocumentCategory[]
}

export async function saveDocumentCategory(params: SmisDocumentCategorySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_document_category_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '文档分类已更新' : '文档分类已新增'
    }
  )
}

export async function deleteDocumentCategories(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_document_categories_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '文档分类已删除'
    }
  )
}

export async function findDocumentDuplicate(params: {
  categoryId: string
  fileName: string
  excludeDocumentId?: string
}) {
  const result = await responseHandle<SmisDocumentDuplicate | null>(
    () =>
      supabase.rpc('smis_find_document_duplicate_secure', {
        p_category_id: params.categoryId,
        p_file_name: params.fileName,
        p_exclude_document_id: params.excludeDocumentId ?? null
      }),
    { showErrorMessage: true, breakReturn: true }
  )

  return result.data ?? null
}

export async function fetchDocumentList(params: SmisDocumentSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<DocumentListResult>(
    () =>
      supabase.rpc('smis_list_documents_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status ?? null,
        p_category_id: params.categoryId ?? null,
        p_scope: params.scope ?? 'all',
        p_ids: params.ids?.length ? params.ids : null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyOverview(),
    error: result.error
  }
}

export async function exportDocumentList(params: SmisDocumentSearchParams = {}) {
  let overview = emptyOverview()
  const data = await loadAllDocumentPages(
    async (page) => {
      const result = await fetchDocumentList(page)
      if (page.from === 0) overview = result.overview
      return result
    },
    { ...params, purpose: 'export' as const }
  )
  return { data, total: data.length, overview, error: null }
}

export async function saveDocument(params: SmisDocumentSavePayload) {
  return await responseHandle<SmisDocumentSaveResult>(
    () =>
      supabase.rpc('smis_save_document_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.fileUrl ? '文档版本已保存' : params.id ? '文档已更新' : '文档已新增'
    }
  )
}

export async function deleteDocuments(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_documents_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '草稿文档已删除'
    }
  )
}

export async function toggleDocumentFollow(documentId: string, follow: boolean) {
  return await responseHandle<boolean>(
    () =>
      supabase.rpc('smis_toggle_document_follow_secure', {
        p_document_id: documentId,
        p_follow: follow
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: follow ? '已关注文档' : '已取消关注'
    }
  )
}

export async function shareDocument(params: {
  documentId: string
  userIds: string[]
  message?: string | null
}) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_share_document_secure', {
        p_document_id: params.documentId,
        p_user_ids: params.userIds,
        p_message: normalizeNullableText(params.message)
      }),
    { showMessage: true, breakReturn: true, message: '文档已分享' }
  )
}

const emptyRegisterOverview = (): SmisDocumentRegisterOverview => ({
  total: 0,
  withAttachment: 0,
  specialEquipment: 0,
  evaluated: 0
})

export async function fetchDocumentRegisterList(params: SmisDocumentRegisterSearchParams) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<DocumentRegisterListResult>(
    () =>
      supabase.rpc('smis_list_document_registers_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_file_name: normalizeNullableText(params.fileName),
        p_document_code: normalizeNullableText(params.documentCode),
        p_category_id: params.categoryId || null,
        p_kind: params.kind,
        p_is_special_equipment: normalizeBooleanFilter(params.isSpecialEquipment) ?? null,
        p_obtained_from: params.obtainedDateRange?.[0] || null,
        p_obtained_to: params.obtainedDateRange?.[1] || null,
        p_evaluated_from: params.evaluationDateRange?.[0] || null,
        p_evaluated_to: params.evaluationDateRange?.[1] || null,
        p_ids: params.ids?.length ? params.ids : null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyRegisterOverview(),
    error: result.error
  }
}

export async function exportDocumentRegisterList(params: SmisDocumentRegisterSearchParams) {
  let overview = emptyRegisterOverview()
  const data = await loadAllDocumentPages(
    async (page) => {
      const result = await fetchDocumentRegisterList(page)
      if (page.from === 0) overview = result.overview
      return result
    },
    { ...params, purpose: 'export' as const }
  )
  return { data, total: data.length, overview, error: null }
}

export async function saveDocumentRegister(params: SmisDocumentRegisterSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_document_register_secure', {
        p_id: params.id ?? null,
        p_kind: params.kind,
        p_payload: keysToSnakeDeep(omit(params, ['id', 'kind', 'copySourceId'])),
        p_copy_source_id: params.copySourceId ?? null
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '文档已更新' : params.copySourceId ? '文档已复制新增' : '文档已新增'
    }
  )
}

export async function deleteDocumentRegisters(params: {
  kind: SmisDocumentRegisterSearchParams['kind']
  ids: string[]
}) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_delete_document_registers_secure', {
        p_kind: params.kind,
        p_ids: params.ids
      }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '文档已删除'
    }
  )
}

export async function fetchLegalComplianceEvaluationList(
  params: SmisLegalComplianceEvaluationSearchParams
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<LegalComplianceEvaluationListResult>(
    () =>
      supabase.rpc('smis_list_legal_compliance_evaluations_secure', {
        p_document_id: params.documentId,
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword)
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}

export async function saveLegalComplianceEvaluation(
  params: SmisLegalComplianceEvaluationSavePayload
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_legal_compliance_evaluation_secure', {
        p_id: params.id ?? null,
        p_document_id: params.documentId,
        p_payload: keysToSnakeDeep(omit(params, ['id', 'documentId', 'copySourceId'])),
        p_copy_source_id: params.copySourceId ?? null
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '合规性评价已更新' : '合规性评价已新增'
    }
  )
}

export async function deleteLegalComplianceEvaluations(params: {
  documentId: string
  ids: string[]
}) {
  return await responseHandle<number>(
    () =>
      supabase.rpc('smis_delete_legal_compliance_evaluations_secure', {
        p_document_id: params.documentId,
        p_ids: params.ids
      }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '合规性评价已删除'
    }
  )
}
