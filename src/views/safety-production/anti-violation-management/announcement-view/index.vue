<template>
  <ArtPermissionGuard permission="SmisViolationAnnouncement:View" resource-name="公告管理">
    <div class="announcement-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="ANNOUNCEMENT CENTER"
        title="公告管理"
        description="从草稿编制、范围发布到查阅回执统一管理，让重要通知可检索、可追踪、可审计。"
        icon="ri:notification-3-line"
        :tags="[
          { label: '富文本公告', type: 'primary', effect: 'plain' },
          { label: '按人员或组织发布', type: 'success', effect: 'plain' },
          { label: '查阅情况可追踪', type: 'warning', effect: 'light' }
        ]"
        :metrics="workspaceMetrics"
        ><template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template
      ></BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="announcement-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 82, showExpand: true, defaultExpanded: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无公告',
          emptyDescription: '新建公告将先保存为草稿，确认内容与范围后再发布。'
        }"
        focusable
      />

      <AnnouncementEditorDialog ref="editorDialogRef" @success="handleSaveSuccess" />
      <AnnouncementDetailDialog ref="detailDialogRef" @read="handleRead" />
      <AnnouncementReadStatsDialog ref="statsDialogRef" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteAnnouncements,
    fetchAnnouncementList,
    publishAnnouncement,
    withdrawAnnouncement,
    type SmisAnnouncement,
    type SmisAnnouncementCategoryOption,
    type SmisAnnouncementOrganization,
    type SmisAnnouncementOverview,
    type SmisAnnouncementSearchParams
  } from '@smis/api'
  import AnnouncementEditorDialog, {
    type AnnouncementEditorDialogOpenData
  } from './modules/announcement-editor-dialog.vue'
  import AnnouncementDetailDialog from './modules/announcement-detail-dialog.vue'
  import AnnouncementReadStatsDialog from './modules/announcement-read-stats-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('smis_announcement', '公告')

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '待发布',
    invalidText: '待发布'
  })

  defineOptions({ name: 'SmisViolationAnnouncement' })
  type TableParams = SmisAnnouncementSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface EditorDialogExpose {
    handleOpen: (data: AnnouncementEditorDialogOpenData) => Promise<void>
  }
  interface RecordDialogExpose {
    handleOpen: (row: SmisAnnouncement) => Promise<void>
  }

  const { confirmAction } = useArtFeedback()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const editorDialogRef = ref<EditorDialogExpose>()
  const detailDialogRef = ref<RecordDialogExpose>()
  const statsDialogRef = ref<RecordDialogExpose>()
  const searchQuery = ref<SmisAnnouncementSearchParams>({})
  const categories = shallowRef<SmisAnnouncementCategoryOption[]>([])
  const organizations = shallowRef<SmisAnnouncementOrganization[]>([])
  const canManage = ref(false)
  const overview = reactive<SmisAnnouncementOverview>({
    total: 0,
    draft: 0,
    published: 0,
    expired: 0,
    unread: 0
  })
  const statusOptions = computed(() =>
    (getDictMap.value.smisAnnouncementStatus ?? []).map(toDictionaryOption)
  )
  const categoryOptions = computed(() =>
    categories.value.map((item) => ({ label: item.categoryName, value: item.id }))
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '公告总数',
      value: overview.total,
      description: '当前筛选范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '生效公告',
      value: overview.published,
      description: '当前有效可查阅',
      icon: 'ri:notification-badge-line',
      tone: 'success'
    },
    {
      label: '待发布草稿',
      value: overview.draft,
      description: '需要确认内容与范围',
      icon: 'ri:draft-line',
      tone: 'warning'
    },
    {
      label: '我的未读',
      value: overview.unread,
      description: '待完成查阅',
      icon: 'ri:mail-unread-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '公告内容',
      key: 'keyword',
      type: 'input',
      span: 12,
      props: { clearable: true, placeholder: '搜索公告标题、正文、分类或发布人' }
    },
    {
      label: '公告分类',
      key: 'categoryId',
      type: 'select',
      options: categoryOptions.value,
      props: { clearable: true, filterable: true, placeholder: '全部分类' }
    },
    {
      label: '公告状态',
      key: 'status',
      type: 'select',
      options: statusOptions.value,
      props: { clearable: true, placeholder: '全部状态' }
    },
    {
      label: '生效时间',
      key: 'effectiveDateRange',
      type: 'date',
      span: 12,
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        rangeSeparator: '至',
        clearable: true,
        class: '!w-full'
      }
    }
  ])

  const openEditor = (row?: SmisAnnouncement): void => {
    void editorDialogRef.value?.handleOpen({
      row,
      categories: categories.value,
      organizations: organizations.value
    })
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisViolationAnnouncement:Add',
      type: 'add',
      label: '新建公告',
      onClick: () => openEditor()
    },
    {
      permission: 'SmisViolationAnnouncement:Edit',
      key: 'edit',
      label: '编辑草稿',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) =>
        selectedRows.length !== 1 || selectedRows[0]?.lifecycleStatus !== 'draft',
      onClick: ({ selectedRows }) => openEditor(selectedRows[0] as SmisAnnouncement)
    },
    {
      permission: 'SmisViolationAnnouncement:Publish',
      key: 'publish',
      label: '发布',
      icon: 'ri:send-plane-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) =>
        selectedRows.length !== 1 || selectedRows[0]?.lifecycleStatus !== 'draft',
      onClick: ({ selectedRows }) => void handlePublish(selectedRows[0] as SmisAnnouncement)
    },
    {
      permission: 'SmisViolationAnnouncement:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条公告草稿吗？`,
      disabled: ({ selectedRows }) =>
        !selectedRows.length || selectedRows.some((row) => row.lifecycleStatus !== 'draft'),
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.title ?? '公告')
          })),
          permission: 'SmisViolationAnnouncement:Delete',
          remove: async () => {
            await deleteAnnouncements(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])

  const audienceSummary = (row: SmisAnnouncement): string => {
    if (row.audienceType === 'all') return '所有人员'
    if (row.audienceType === 'employees') return `${row.audienceEmployees.length} 名指定人员`
    return `${row.audienceOrganizations.length} 个指定组织`
  }
  const columnsFactory = (): ColumnOption<SmisAnnouncement>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'title',
      label: '公告标题',
      minWidth: 340,
      fixed: 'left',
      formatter: (row) => (
        <button
          type="button"
          class="announcement-page__title"
          onClick={() => void detailDialogRef.value?.handleOpen(row)}
        >
          <span>
            {row.isPinned ? (
              <ElTag size="small" type="warning" effect="plain">
                置顶
              </ElTag>
            ) : null}
            <strong>{row.title}</strong>
          </span>
          <small>{row.contentText}</small>
        </button>
      )
    },
    { prop: 'categoryName', label: '公告分类', width: 128, showOverflowTooltip: true },
    {
      prop: 'displayStatus',
      label: '公告状态',
      width: 106,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisAnnouncementStatus" value={row.displayStatus} display="tag" />
      )
    },
    { prop: 'effectiveStartDate', label: '生效日期', width: 118 },
    {
      prop: 'effectiveEndDate',
      label: '结束日期',
      width: 118,
      formatter: (row) => row.effectiveEndDate || '长期有效'
    },
    {
      prop: 'audienceType',
      label: '发布范围',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: audienceSummary
    },
    { prop: 'createByName', label: '创建人', width: 112, showOverflowTooltip: true },
    {
      prop: 'publishedAt',
      label: '发布时间',
      width: 158,
      formatter: (row) => formatTableDateTime(row.publishedAt)
    },
    {
      prop: 'readCount',
      label: '已查阅',
      width: 94,
      align: 'right',
      formatter: (row) => (row.lifecycleStatus === 'published' ? `${row.readCount} 人` : '—')
    },
    {
      prop: 'operation',
      label: '操作',
      width: 188,
      fixed: 'right',
      formatter: (row) => (
        <div class="announcement-page__actions">
          <ArtButtonTable
            permission="SmisViolationAnnouncement:View"
            type="view"
            icon="ri:eye-line"
            label="查看"
            onClick={() => void detailDialogRef.value?.handleOpen(row)}
          />
          <ArtButtonMore
            list={buildMoreActions(row)}
            onClick={(item: ButtonMoreItem) => void handleMoreAction(item, row)}
          />
        </div>
      )
    }
  ]
  const buildMoreActions = (row: SmisAnnouncement): ButtonMoreItem[] => [
    {
      key: 'edit',
      label: '编辑草稿',
      icon: 'ri:edit-line',
      disabled: row.lifecycleStatus !== 'draft',
      auth: 'SmisViolationAnnouncement:Edit'
    },
    {
      key: 'publish',
      label: '发布公告',
      icon: 'ri:send-plane-line',
      disabled: row.lifecycleStatus !== 'draft',
      auth: 'SmisViolationAnnouncement:Publish'
    },
    {
      key: 'withdraw',
      label: '撤回公告',
      icon: 'ri:arrow-go-back-line',
      disabled: row.lifecycleStatus !== 'published',
      auth: 'SmisViolationAnnouncement:Withdraw'
    },
    {
      key: 'stats',
      label: '查阅情况',
      icon: 'ri:bar-chart-box-line',
      disabled: row.lifecycleStatus !== 'published',
      auth: 'SmisViolationAnnouncement:ReadStats'
    },
    {
      key: 'delete',
      label: '删除草稿',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)',
      disabled: row.lifecycleStatus !== 'draft',
      auth: 'SmisViolationAnnouncement:Delete'
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchAnnouncementList({ ...params, ...buildSupabasePageRange(params) })
    categories.value = result.categories
    organizations.value = result.organizations
    canManage.value = result.canManage
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }
  const handlePublish = async (row: SmisAnnouncement): Promise<void> => {
    try {
      await confirmAction(
        `发布后公告正文和发布范围将锁定。确定发布“${row.title}”吗？`,
        '发布公告',
        { confirmButtonText: '确认发布', type: 'warning' }
      )
      await publishAnnouncement(row.id)
      await tableQueryRef.value?.getData()
    } catch {
      /* 用户取消 */
    }
  }
  const handleWithdraw = async (row: SmisAnnouncement): Promise<void> => {
    try {
      await confirmAction(
        `撤回后公告将不再面向接收范围展示，但会保留查阅记录。确定撤回吗？`,
        '撤回公告',
        { confirmButtonText: '确认撤回', type: 'warning' }
      )
      await withdrawAnnouncement(row.id)
      await tableQueryRef.value?.getData()
    } catch {
      /* 用户取消 */
    }
  }
  const handleDelete = async (row: SmisAnnouncement): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.title ?? '公告')
        }
      ],
      permission: 'SmisViolationAnnouncement:Delete',
      confirmMessage: `确定删除公告草稿“${row.title}”吗？`,
      remove: async () => {
        await deleteAnnouncements([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }
  const handleMoreAction = async (item: ButtonMoreItem, row: SmisAnnouncement): Promise<void> => {
    if (item.key === 'edit') openEditor(row)
    if (item.key === 'publish') await handlePublish(row)
    if (item.key === 'withdraw') await handleWithdraw(row)
    if (item.key === 'stats') await statsDialogRef.value?.handleOpen(row)
    if (item.key === 'delete') await handleDelete(row)
  }
  const handleSaveSuccess = (): void => void tableQueryRef.value?.getData()
  const handleRead = (): void => void tableQueryRef.value?.getData()
  onMounted(
    () =>
      void Promise.all([
        userStore.ensureDictLoaded('smisAnnouncementStatus'),
        userStore.ensureDictLoaded('smisAnnouncementAudienceType')
      ])
  )
</script>

<style scoped lang="scss">
  .announcement-page {
    gap: 12px;
    min-width: 0;

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.announcement-page__title) {
      display: grid;
      width: 100%;
      min-width: 0;
      padding: 4px 0;
      color: var(--el-text-color-primary);
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
    }

    :deep(.announcement-page__title > span) {
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }

    :deep(.announcement-page__title strong),
    :deep(.announcement-page__title small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.announcement-page__title strong) {
      font-weight: 600;
    }

    :deep(.announcement-page__title small) {
      margin-top: 5px;
      color: var(--el-text-color-secondary);
    }

    :deep(.announcement-page__title:hover strong),
    :deep(.announcement-page__title:focus-visible strong) {
      color: var(--theme-color);
    }

    :deep(.announcement-page__title:focus-visible) {
      outline: 2px solid color-mix(in srgb, var(--theme-color) 45%, transparent);
      outline-offset: 2px;
      border-radius: var(--el-border-radius-small);
    }
  }
</style>
