import { buildSupabaseRpcRange } from '@/utils/supabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { omit } from 'lodash-es'
import TreeUtils from '@/utils/tree'
import { useSupabase } from '@/hooks/core/useSupabase'
import type {
  SmisAnnouncement,
  SmisAnnouncementCategory,
  SmisAnnouncementCategoryOption,
  SmisAnnouncementCategoryOverview,
  SmisAnnouncementCategorySavePayload,
  SmisAnnouncementCategorySearchParams,
  SmisAnnouncementOrganization,
  SmisAnnouncementOverview,
  SmisAnnouncementReadStats,
  SmisAnnouncementSavePayload,
  SmisAnnouncementSearchParams
} from '@smis/api/types'

interface AnnouncementCategoryListPayload {
  records?: SmisAnnouncementCategory[]
  total?: number
  overview?: SmisAnnouncementCategoryOverview
}

interface AnnouncementListPayload {
  records?: SmisAnnouncement[]
  total?: number
  overview?: SmisAnnouncementOverview
  canManage?: boolean
  categories?: SmisAnnouncementCategoryOption[]
  organizations?: SmisAnnouncementOrganization[]
}

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
const organizationTreeUtils = new TreeUtils({
  idKey: 'id',
  parentKey: 'parentId',
  childrenKey: 'children'
})

const emptyCategoryOverview = (): SmisAnnouncementCategoryOverview => ({
  total: 0,
  enabled: 0,
  disabled: 0,
  used: 0
})
const emptyAnnouncementOverview = (): SmisAnnouncementOverview => ({
  total: 0,
  draft: 0,
  published: 0,
  expired: 0,
  unread: 0
})

export async function fetchAnnouncementCategoryList(
  params: SmisAnnouncementCategorySearchParams = {}
) {
  const from = Math.max(params.from ?? 0, 0)
  const result = await responseHandle<AnnouncementCategoryListPayload>(
    () =>
      supabase.rpc('smis_list_announcement_categories_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 99),
        p_keyword: normalizeNullableText(params.keyword),
        p_status: params.status || null,
        p_purpose: params.purpose ?? 'list'
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyCategoryOverview(),
    error: result.error
  }
}

export async function saveAnnouncementCategory(params: SmisAnnouncementCategorySavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_announcement_category_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '公告分类已更新' : '公告分类已新增'
    }
  )
}

export async function deleteAnnouncementCategories(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_announcement_categories_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '公告分类已删除'
    }
  )
}

export async function fetchAnnouncementList(params: SmisAnnouncementSearchParams = {}) {
  const from = Math.max(params.from ?? 0, 0)
  const [startDate, endDate] = params.effectiveDateRange ?? []
  const result = await responseHandle<AnnouncementListPayload>(
    () =>
      supabase.rpc('smis_list_announcements_secure', {
        ...buildSupabaseRpcRange(from, params.to ?? from + 19),
        p_keyword: normalizeNullableText(params.keyword),
        p_category_id: params.categoryId || null,
        p_status: params.status || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      }),
    { showErrorMessage: true }
  )
  const organizations = organizationTreeUtils.listToTree(
    result.data?.organizations ?? [],
    (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.organizationName.localeCompare(b.organizationName)
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    overview: result.data?.overview ?? emptyAnnouncementOverview(),
    canManage: result.data?.canManage ?? false,
    categories: result.data?.categories ?? [],
    organizations,
    error: result.error
  }
}

export async function saveAnnouncement(params: SmisAnnouncementSavePayload) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_announcement_secure', {
        p_id: params.id ?? null,
        p_payload: keysToSnakeDeep(omit(params, ['id']))
      }),
    {
      showMessage: true,
      breakReturn: true,
      message: params.id ? '公告草稿已更新' : '公告草稿已保存'
    }
  )
}

export async function publishAnnouncement(id: string) {
  return await responseHandle<string>(
    () => supabase.rpc('smis_publish_announcement_secure', { p_id: id }),
    { showMessage: true, breakReturn: true, message: '公告已发布' }
  )
}

export async function withdrawAnnouncement(id: string) {
  return await responseHandle<string>(
    () => supabase.rpc('smis_withdraw_announcement_secure', { p_id: id }),
    { showMessage: true, breakReturn: true, message: '公告已撤回' }
  )
}

export async function deleteAnnouncements(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('smis_delete_announcements_secure', { p_ids: ids }),
    {
      showReferenceFeedback: false,
      showErrorMessage: false,
      showMessage: true,
      breakReturn: true,
      message: '公告草稿已删除'
    }
  )
}

export async function markAnnouncementRead(id: string) {
  return await responseHandle<boolean>(
    () => supabase.rpc('smis_mark_announcement_read_secure', { p_id: id }),
    { showErrorMessage: true }
  )
}

export async function fetchAnnouncementReadStats(id: string) {
  return await responseHandle<SmisAnnouncementReadStats>(
    () => supabase.rpc('smis_get_announcement_read_stats_secure', { p_id: id }),
    { showErrorMessage: true }
  )
}
