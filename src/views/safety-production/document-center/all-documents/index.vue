<template>
  <ArtPermissionGuard permission="SmisAllDocuments:View">
    <div
      class="document-center-page business-workspace-page art-full-height"
      :class="{ 'is-focus-mode': focusMode }"
    >
      <BusinessWorkspaceHeader
        v-show="!focusMode"
        density="compact"
        eyebrow="CONTROLLED DOCUMENT LIBRARY"
        title="全部文档"
        description="按分类、版本与实施日期统一管理文档，保留更新链路，并在新版本实施前自动提醒。"
        icon="ri:folder-shield-2-line"
        :tags="[
          { label: '租户级文档库', type: 'primary', effect: 'plain' },
          { label: '同名上传查重', type: 'warning', effect: 'plain' },
          { label: '实施日期提醒', type: 'success', effect: 'light' }
        ]"
        :metrics="workspaceMetrics"
        refreshable
        :refresh-loading="loading"
        @refresh="handleRefresh"
      />

      <section class="document-center-page__workspace art-card-xs" aria-label="文档管理工作区">
        <header class="document-center-page__command-bar">
          <ElSegmented
            class="document-center-page__scopes"
            :model-value="scope"
            :options="scopeOptions"
            aria-label="文档范围"
            block
            @update:model-value="handleScopeSegmentChange"
          >
            <template #default="{ item }">
              <span class="document-center-page__segment-option">
                <ArtSvgIcon :icon="item.icon" />
                <span>{{ item.label }}</span>
              </span>
            </template>
          </ElSegmented>
          <div class="document-center-page__primary-actions">
            <ElButton v-auth="'SmisAllDocuments:Add'" @click="openDocumentDialog('add')">
              <ArtSvgIcon icon="ri:file-add-line" />新增
            </ElButton>
            <ElButton
              v-auth="'SmisAllDocuments:Upload'"
              type="primary"
              @click="openDocumentDialog('upload')"
            >
              <ArtSvgIcon icon="ri:upload-cloud-2-line" />上传
            </ElButton>
            <ElButton
              v-auth="'SmisAllDocuments:Delete'"
              type="danger"
              plain
              :disabled="selectedRows.length === 0"
              @click="handleBatchDelete"
            >
              <ArtSvgIcon icon="ri:delete-bin-line" />删除
            </ElButton>
            <ElButton v-auth="'SmisAllDocuments:Export'" :loading="exporting" @click="handleExport">
              <ArtSvgIcon icon="ri:file-excel-2-line" />导出
            </ElButton>
          </div>
        </header>

        <div class="document-center-page__filter-bar">
          <div class="document-center-page__filters">
            <ElInput
              v-model="query.keyword"
              clearable
              placeholder="按文档标题、文件名或分类路径查询"
              aria-label="关键词"
            >
              <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
            </ElInput>
            <ElSelect v-model="query.status" clearable placeholder="全部状态" aria-label="文档状态">
              <ElOption
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </div>
          <div class="document-center-page__view-control">
            <ElSegmented
              class="document-center-page__view-switch"
              :model-value="viewMode"
              :options="viewOptions"
              aria-label="展示方式"
              block
              @update:model-value="handleViewSegmentChange"
            >
              <template #default="{ item }">
                <ArtTooltip :content="item.label" placement="bottom">
                  <span class="document-center-page__segment-option is-icon-only">
                    <ArtSvgIcon :icon="item.icon" />
                    <span class="sr-only">{{ item.label }}</span>
                  </span>
                </ArtTooltip>
              </template>
            </ElSegmented>
            <ArtTooltip :content="focusMode ? '退出专注模式' : '进入专注模式'" placement="bottom">
              <ArtIconButton
                class="document-center-page__focus-toggle"
                :class="{ 'is-active': focusMode }"
                :icon="focusMode ? 'ri:contract-left-right-line' : 'ri:focus-3-line'"
                :label="focusMode ? '退出专注模式' : '进入专注模式'"
                :aria-pressed="focusMode"
                @click="toggleFocusMode"
              />
            </ArtTooltip>
          </div>
        </div>

        <ElAlert
          v-if="error"
          class="document-center-page__error"
          type="error"
          :closable="false"
          show-icon
          title="文档数据加载失败"
          description="请检查网络或权限后重试，当前查询条件会保留。"
        >
          <template #default
            ><ElButton size="small" @click="handleRefresh">重新加载</ElButton></template
          >
        </ElAlert>

        <div class="document-center-page__content" :class="`is-${viewMode}`" :aria-busy="loading">
          <aside v-if="viewMode === 'tree'" class="document-center-page__category-panel">
            <div class="document-center-page__category-header">
              <div
                ><span>文档分类</span><small>{{ categories.length }} 个一级目录</small></div
              >
              <div class="document-center-page__category-actions">
                <ArtTooltip content="新增分类" placement="bottom">
                  <ArtIconButton
                    v-auth="'SmisAllDocuments:CategoryAdd'"
                    icon="ri:folder-add-line"
                    label="新增文档分类"
                    @click="openCategoryDialog()"
                  />
                </ArtTooltip>
                <ArtTooltip content="编辑当前分类" placement="bottom">
                  <ArtIconButton
                    v-auth="'SmisAllDocuments:CategoryEdit'"
                    icon="ri:edit-2-line"
                    label="编辑当前文档分类"
                    :disabled="!selectedCategory"
                    @click="openCategoryDialog(selectedCategory)"
                  />
                </ArtTooltip>
                <ArtTooltip content="删除当前分类" placement="bottom">
                  <ArtIconButton
                    v-auth="'SmisAllDocuments:CategoryDelete'"
                    icon="ri:delete-bin-6-line"
                    label="删除当前文档分类"
                    :disabled="!selectedCategory"
                    @click="handleDeleteCategory"
                  />
                </ArtTooltip>
              </div>
            </div>
            <div class="document-center-page__category-search">
              <ElInput
                v-model="categoryKeyword"
                clearable
                placeholder="查询文档目录"
                aria-label="查询文档目录"
              >
                <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
              </ElInput>
            </div>
            <button
              type="button"
              class="document-center-page__all-category"
              :class="{ 'is-active': !selectedCategoryId }"
              @click="handleCategorySelect()"
            >
              <span class="art-icon-label"><ArtSvgIcon icon="ri:folders-line" />全部分类</span
              ><strong>{{ overview.total }}</strong>
            </button>
            <ElScrollbar class="document-center-page__category-scrollbar">
              <ElTree
                ref="categoryTreeRef"
                :data="categories"
                :props="categoryProps"
                node-key="id"
                default-expand-all
                highlight-current
                :expand-on-click-node="false"
                :filter-node-method="filterCategoryNode"
                @node-click="handleCategoryNodeClick"
              >
                <template #default="{ data: category }">
                  <span class="document-center-page__tree-node">
                    <span class="art-icon-label">
                      <ArtSvgIcon
                        :icon="category.children?.length ? 'ri:folder-3-line' : 'ri:folder-line'"
                      />
                      <span :title="category.categoryName">{{ category.categoryName }}</span>
                    </span>
                    <small>{{ category.documentCount }}</small>
                  </span>
                </template>
                <template #empty>
                  <ArtEmptyState
                    title="未找到匹配项"
                    description="请调整关键词或清空筛选条件。"
                    size="compact"
                    :visual-size="64"
                  />
                </template>
              </ElTree>
            </ElScrollbar>
          </aside>

          <main class="document-center-page__results">
            <div class="document-center-page__results-heading">
              <div>
                <span class="document-center-page__path-icon" aria-hidden="true">
                  <ArtSvgIcon
                    :icon="viewMode === 'folder' ? 'ri:folder-open-line' : 'ri:file-list-3-line'"
                  />
                </span>
                <div
                  ><strong>{{ resultTitle }}</strong
                  ><p>{{ resultDescription }}</p></div
                >
              </div>
              <span class="document-center-page__result-count">共 {{ pagination.total }} 项</span>
            </div>

            <template v-if="viewMode === 'folder'">
              <nav class="document-center-page__breadcrumbs" aria-label="分类路径">
                <button type="button" @click="handleFolderOpen()">全部文档</button>
                <template v-for="item in breadcrumbs" :key="item.id">
                  <ArtSvgIcon icon="ri:arrow-right-s-line" aria-hidden="true" />
                  <button type="button" @click="handleFolderOpen(item.id)">{{
                    item.categoryName
                  }}</button>
                </template>
              </nav>
              <ElScrollbar class="document-center-page__folder-scrollbar">
                <div v-if="visibleFolders.length" class="document-center-page__folder-grid">
                  <button
                    v-for="folder in visibleFolders"
                    :key="folder.id"
                    type="button"
                    class="document-center-page__folder-card"
                    @click="handleFolderOpen(folder.id)"
                  >
                    <span aria-hidden="true"><ArtSvgIcon icon="ri:folder-5-fill" /></span>
                    <span
                      ><strong :title="folder.categoryName">{{ folder.categoryName }}</strong
                      ><small>{{ folder.documentCount }} 份直接归档文档</small></span
                    >
                    <ArtSvgIcon icon="ri:arrow-right-s-line" aria-hidden="true" />
                  </button>
                </div>
                <ElSkeleton v-if="loading" animated :rows="6" />
                <div v-else-if="data.length" class="document-center-page__document-grid">
                  <article
                    v-for="row in data"
                    :key="row.id"
                    class="document-center-page__document-card"
                  >
                    <div class="document-center-page__document-card-top">
                      <span :class="`is-${getFileTone(row.fileType)}`" aria-hidden="true"
                        ><ArtSvgIcon :icon="getFileIcon(row.fileType)"
                      /></span>
                      <div>
                        <ArtAttachmentLink
                          v-if="row.fileUrl"
                          class="document-center-page__document-link"
                          :file="getDocumentPreviewFile(row)"
                        />
                        <strong v-else :title="`${row.title}（尚未上传文件）`">{{
                          row.title
                        }}</strong>
                        <small>{{ row.fileName || '等待上传首个文件版本' }}</small>
                      </div>
                      <ElDropdown trigger="click" @command="handleCardCommand($event, row)">
                        <ArtIconButton icon="ri:more-2-fill" :label="`${row.title}更多操作`" />
                        <template #dropdown>
                          <ElDropdownMenu>
                            <ElDropdownItem command="edit">编辑</ElDropdownItem>
                            <ElDropdownItem command="upload">上传新版本</ElDropdownItem>
                            <ElDropdownItem command="follow">{{
                              row.isFollowing ? '取消关注' : '关注'
                            }}</ElDropdownItem>
                            <ElDropdownItem command="share">分享</ElDropdownItem>
                            <ElDropdownItem
                              command="delete"
                              divided
                              :disabled="row.status !== 'draft'"
                              >删除草稿</ElDropdownItem
                            >
                          </ElDropdownMenu>
                        </template>
                      </ElDropdown>
                    </div>
                    <div class="document-center-page__document-card-meta">
                      <ArtDictDisplay
                        dict-code="smisDocumentStatus"
                        :value="row.status"
                        display="tag"
                      />
                      <ElTag
                        v-if="row.implementationState === 'scheduled'"
                        type="warning"
                        effect="plain"
                        >{{ formatScheduled(row) }}实施</ElTag
                      >
                      <span v-else>{{ row.versionNo ? `V${row.versionNo}` : '无版本' }}</span>
                    </div>
                    <p>{{ row.summary || '暂无摘要，可通过编辑补充适用范围与使用说明。' }}</p>
                    <footer
                      ><span>{{ row.creatorName }}</span
                      ><time :datetime="row.updateTime">{{
                        formatDateTime(row.updateTime)
                      }}</time></footer
                    >
                  </article>
                </div>
                <ArtEmptyState
                  v-else-if="!visibleFolders.length"
                  title="当前分类暂无文档"
                  description="可上传首份文件，或切换到其他分类继续浏览。"
                  :visual-size="112"
                />
              </ElScrollbar>
              <div class="min-w-0">
                <ElPagination
                  class="document-center-page__folder-pagination"
                  background
                  layout="total, prev, pager, next, sizes, jumper"
                  :total="pagination.total"
                  :current-page="pagination.current"
                  :page-size="pagination.size"
                  :page-sizes="[10, 20, 30, 50]"
                  :pager-count="5"
                  :disabled="loading"
                  @size-change="handleSizeChange"
                  @current-change="handleCurrentChange"
                />
              </div>
            </template>
            <ArtTable
              v-else
              row-key="id"
              class="document-center-page__table"
              :loading="loading"
              :data="data"
              :columns="columns"
              :pagination="pagination"
              :show-table-header="false"
              empty-text="暂无符合条件的文档"
              empty-description="可调整查询条件，或上传新的文档文件。"
              @selection-change="handleSelectionChange"
              @pagination:size-change="handleSizeChange"
              @pagination:current-change="handleCurrentChange"
            />
          </main>
        </div>
      </section>
      <component
        :is="documentDialogComponent"
        v-if="documentDialogComponent"
        ref="documentDialogRef"
        @success="handleDocumentSaved"
      />
      <component
        :is="categoryDialogComponent"
        v-if="categoryDialogComponent"
        ref="categoryDialogRef"
        @success="handleCategorySaved"
      />
      <component
        :is="shareDialogComponent"
        v-if="shareDialogComponent"
        ref="shareDialogRef"
        @success="handleShareSuccess"
      />
    </div>
    <MasterDataDeleteGuard ref="deleteDocumentGuardRef" />
    <MasterDataDeleteGuard ref="deleteCategoryGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'

  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import dayjs from 'dayjs'
  import type { ElTree, TreeNodeData } from 'element-plus'
  import { ElMessage, ElTag } from 'element-plus'
  import { useTable, type TableRequestOptions } from '@/hooks/core/useTable'
  import { useWorkspaceFocus } from '@/hooks/core/useWorkspaceFocus'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { useLazyComponent } from '@/hooks/core/useLazyComponent'
  import { useUserStore } from '@/store/modules/user'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { exportExcel, type ExcelColumn } from '@/utils/file'
  import { formatSize } from '@/utils/file/format-size'
  import TreeUtils from '@/utils/tree'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtAttachmentLink from '@/components/core/media/art-file-viewer/attachment-link.vue'
  import type { FilePreviewTarget } from '@/hooks/core/useFilePreview'
  import {
    deleteDocumentCategories,
    deleteDocuments,
    exportDocumentList,
    fetchDocumentCategories,
    fetchDocumentList,
    toggleDocumentFollow,
    type SmisDocument,
    type SmisDocumentCategory,
    type SmisDocumentOverview,
    type SmisDocumentScope,
    type SmisDocumentSearchParams,
    type SmisDocumentStatus,
    type SmisDocumentViewMode
  } from '@smis/api'
  import type { DocumentDialogMode, DocumentDialogOpenData } from './modules/document-dialog.vue'
  import type { DocumentCategoryDialogOpenData as CategoryDialogOpenData } from '../shared/document-category-dialog.vue'
  import type { ShareDialogOpenData } from './modules/share-dialog.vue'

  const { deleteGuardRef: deleteDocumentGuardRef, deleteRecords: deleteDocumentRecords } =
    useRecordDeleteGuard('smis_document', '文档')
  const { deleteGuardRef: deleteCategoryGuardRef, deleteRecords: deleteCategoryRecords } =
    useRecordDeleteGuard('smis_document_category', '文档分类')

  defineOptions({ name: 'SmisAllDocuments' })
  type TableParams = SmisDocumentSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DocumentDialogExpose {
    handleOpen: (data: DocumentDialogOpenData) => Promise<void>
  }
  interface CategoryDialogExpose {
    handleOpen: (data: CategoryDialogOpenData) => Promise<void>
  }
  interface ShareDialogExpose {
    handleOpen: (data: ShareDialogOpenData) => Promise<void>
  }
  interface QueryGroup {
    keyword: string
    status?: SmisDocumentStatus
  }
  type DocumentExportRow = Record<string, string | number | null | undefined>
  const { focusMode, setFocusMode } = useWorkspaceFocus()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { component: documentDialogComponent, load: loadDocumentDialog } = useLazyComponent(
    () => import('./modules/document-dialog.vue')
  )
  const { component: categoryDialogComponent, load: loadCategoryDialog } = useLazyComponent(
    () => import('../shared/document-category-dialog.vue')
  )
  const { component: shareDialogComponent, load: loadShareDialog } = useLazyComponent(
    () => import('./modules/share-dialog.vue')
  )
  const documentDialogRef = ref<DocumentDialogExpose>()
  const categoryDialogRef = ref<CategoryDialogExpose>()
  const shareDialogRef = ref<ShareDialogExpose>()
  const categoryTreeRef = ref<InstanceType<typeof ElTree>>()
  const categories = shallowRef<SmisDocumentCategory[]>([])
  const categoryKeyword = ref('')
  const selectedCategoryId = ref<string>()
  const scope = ref<SmisDocumentScope>('all')
  const viewMode = ref<SmisDocumentViewMode>('tree')
  const selectedRows = shallowRef<SmisDocument[]>([])
  const exporting = ref(false)
  const query = reactive<QueryGroup>({ keyword: '', status: undefined })
  const overview = reactive<SmisDocumentOverview>({
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
  const categoryProps = { label: 'categoryName', children: 'children' }

  const toggleFocusMode = (): void => setFocusMode(!focusMode.value)

  const scopeOptions: Array<{ label: string; value: SmisDocumentScope; icon: string }> = [
    { label: '全部', value: 'all', icon: 'ri:file-list-3-line' },
    { label: '我创建的', value: 'created', icon: 'ri:user-add-line' },
    { label: '我关注的', value: 'following', icon: 'ri:star-line' },
    { label: '我分享的', value: 'shared_by_me', icon: 'ri:share-forward-line' },
    { label: '分享给我', value: 'shared_to_me', icon: 'ri:inbox-archive-line' }
  ]
  const viewOptions: Array<{
    label: string
    value: SmisDocumentViewMode
    icon: string
  }> = [
    { label: '树结构视图', value: 'tree', icon: 'ri:node-tree' },
    { label: '文件夹视图', value: 'folder', icon: 'ri:folder-5-line' },
    { label: '列表视图', value: 'list', icon: 'ri:list-check-3' }
  ]
  const statusOptions = computed(() =>
    (getDictMap.value.smisDocumentStatus ?? []).map((item) => ({
      label: item.label || item.name,
      value: item.value as SmisDocumentStatus
    }))
  )
  const statusLabel = (value: SmisDocumentStatus): string =>
    statusOptions.value.find((item) => item.value === value)?.label || value
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '文档总数',
      value: overview.total,
      description: '当前范围内文档',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '已发布',
      value: overview.published,
      description: '正式可用文档',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '待实施版本',
      value: overview.scheduled,
      description: '到期自动切换',
      icon: 'ri:calendar-event-line',
      tone: 'warning'
    },
    {
      label: '草稿',
      value: overview.draft,
      description: '可继续维护',
      icon: 'ri:draft-line',
      tone: 'info'
    }
  ])
  const flatCategories = computed(
    () => categoryTree.treeToList(categories.value) as SmisDocumentCategory[]
  )
  const selectedCategory = computed(() =>
    flatCategories.value.find((item) => item.id === selectedCategoryId.value)
  )
  const visibleFolders = computed(() =>
    selectedCategory.value?.children?.length
      ? selectedCategory.value.children
      : selectedCategoryId.value
        ? []
        : categories.value
  )
  const breadcrumbs = computed(() => {
    const result: SmisDocumentCategory[] = []
    let current = selectedCategory.value
    while (current) {
      result.unshift(current)
      current = current.parentId
        ? flatCategories.value.find((item) => item.id === current?.parentId)
        : undefined
    }
    return result
  })
  const resultTitle = computed(() => selectedCategory.value?.categoryName || '全部文档')
  const resultDescription = computed(() =>
    viewMode.value === 'folder'
      ? '按目录浏览文件夹与文档卡片'
      : selectedCategory.value?.description || '按更新时间查看当前范围内的文档'
  )

  const getFileIcon = (fileType?: string | null): string => {
    const type = (fileType || '').toLowerCase()
    if (type.includes('pdf')) return 'ri:file-pdf-2-line'
    if (/(doc|word)/.test(type)) return 'ri:file-word-2-line'
    if (/(xls|sheet|excel)/.test(type)) return 'ri:file-excel-2-line'
    if (/(ppt|presentation)/.test(type)) return 'ri:file-ppt-2-line'
    if (/(zip|rar|archive)/.test(type)) return 'ri:file-zip-line'
    if (/(png|jpg|jpeg|gif|image)/.test(type)) return 'ri:image-line'
    return 'ri:file-text-line'
  }
  const getFileTone = (fileType?: string | null): string => {
    const type = (fileType || '').toLowerCase()
    if (type.includes('pdf')) return 'danger'
    if (/(xls|sheet|excel)/.test(type)) return 'success'
    if (/(ppt|presentation)/.test(type)) return 'warning'
    return 'primary'
  }
  const formatDateTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })
  const formatScheduled = (row: SmisDocument): string =>
    row.scheduledEffectiveDate ? dayjs(row.scheduledEffectiveDate).format('YYYY-MM-DD') : '待定'
  const getDocumentPreviewFile = (row: SmisDocument): FilePreviewTarget => ({
    name: row.title,
    url: row.fileUrl || undefined,
    fileType: row.fileType || undefined
  })

  const rowActions = (row: SmisDocument): ButtonMoreItem[] => [
    {
      auth: 'SmisAllDocuments:Upload',
      key: 'upload',
      label: '上传新版本',
      icon: 'ri:upload-cloud-2-line'
    },
    {
      auth: 'SmisAllDocuments:Follow',
      key: 'follow',
      label: row.isFollowing ? '取消关注' : '关注',
      icon: row.isFollowing ? 'ri:star-fill' : 'ri:star-line'
    },
    { auth: 'SmisAllDocuments:Share', key: 'share', label: '分享', icon: 'ri:share-forward-line' },
    {
      auth: 'SmisAllDocuments:Delete',
      key: 'delete',
      label: '删除草稿',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)',
      disabled: row.status !== 'draft'
    }
  ]
  const columnsFactory = (): ColumnOption<SmisDocument>[] => [
    { type: 'selection', width: 48, fixed: 'left', reserveSelection: true },
    {
      prop: 'title',
      label: '文档',
      align: 'left',
      headerAlign: 'left',
      minWidth: 280,
      fixed: 'left',
      formatter: (row) => (
        <div class="document-center-page__identity">
          <span class={`is-${getFileTone(row.fileType)}`}>
            <ArtSvgIcon icon={getFileIcon(row.fileType)} />
          </span>
          <span>
            {row.fileUrl ? (
              <ArtAttachmentLink
                class="document-center-page__document-link"
                file={getDocumentPreviewFile(row)}
              />
            ) : (
              <strong title={`${row.title}（尚未上传文件）`}>{row.title}</strong>
            )}
            <small title={row.fileName || ''}>{row.fileName || '尚未上传文件'}</small>
          </span>
        </div>
      )
    },
    { prop: 'categoryPath', label: '分类路径', minWidth: 190, showOverflowTooltip: true },
    {
      prop: 'status',
      label: '状态',
      width: 96,
      dict: { code: 'smisDocumentStatus', display: 'tag' }
    },
    {
      prop: 'implementationState',
      label: '实施状态',
      width: 142,
      formatter: (row) =>
        row.implementationState === 'scheduled' ? (
          <div class="document-center-page__scheduled">
            <ElTag type="warning" effect="plain">
              待实施
            </ElTag>
            <small>{formatScheduled(row)}</small>
          </div>
        ) : row.implementationState === 'effective' ? (
          <div class="document-center-page__scheduled is-effective">
            <ElTag type="success" effect="plain">
              已生效
            </ElTag>
            <small>{row.effectiveDate || '—'}</small>
          </div>
        ) : (
          <ElTag type="info" effect="plain">
            无文件
          </ElTag>
        )
    },
    {
      prop: 'versionNo',
      label: '版本',
      width: 82,
      align: 'center',
      formatter: (row) => (row.versionNo ? `V${row.versionNo}` : '—')
    },
    {
      prop: 'fileSize',
      label: '大小',
      width: 94,
      align: 'right',
      formatter: (row) => formatSize(row.fileSize, { precision: 1 })
    },
    { prop: 'creatorName', label: '创建人', minWidth: 116, showOverflowTooltip: true },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
      formatter: (row) => formatDateTime(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 120,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="edit"
            permission="SmisAllDocuments:Edit"
            onClick={() => void openDocumentDialog('edit', row)}
          />
          <ArtButtonMore
            list={rowActions(row)}
            onClick={(item: ButtonMoreItem) => handleRowAction(item, row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchDocumentList({
      keyword: params.keyword,
      status: params.status,
      categoryId: params.categoryId,
      scope: params.scope,
      from,
      to
    })
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    return response
  }
  const {
    data,
    columns,
    loading,
    error,
    pagination,
    replaceSearchParams,
    getData,
    refreshData,
    cancelRequest,
    refreshCreate,
    refreshUpdate,
    refreshRemove,
    handleSizeChange,
    handleCurrentChange
  } = useTable<SmisDocument, typeof fetchTableData>({
    core: {
      apiFn: fetchTableData,
      apiParams: { current: 1, size: 20, scope: 'all' },
      immediate: false,
      columnsFactory
    }
  })
  const currentSearchParams = (): TableParams => ({
    current: pagination.current,
    size: pagination.size,
    keyword: query.keyword.trim() || undefined,
    status: query.status,
    categoryId: selectedCategoryId.value,
    scope: scope.value
  })
  const reloadByContext = async (resetPage = false): Promise<void> => {
    selectedRows.value = []
    replaceSearchParams({
      ...currentSearchParams(),
      current: resetPage ? 1 : pagination.current
    })
    await getData()
  }
  const loadCategories = async (): Promise<void> => {
    categories.value = await fetchDocumentCategories()
  }
  const handleRefresh = (): void => {
    void Promise.all([loadCategories(), refreshData()])
  }
  const handleScopeChange = (value: SmisDocumentScope): void => {
    if (scope.value !== value) {
      scope.value = value
      void reloadByContext()
    }
  }
  const handleViewChange = (value: SmisDocumentViewMode): void => {
    viewMode.value = value
    selectedRows.value = []
    if (value === 'list') selectedCategoryId.value = undefined
    void reloadByContext()
  }
  const handleScopeSegmentChange = (value: string | number | boolean): void => {
    if (scopeOptions.some((item) => item.value === value)) {
      handleScopeChange(value as SmisDocumentScope)
    }
  }
  const handleViewSegmentChange = (value: string | number | boolean): void => {
    if (viewOptions.some((item) => item.value === value)) {
      handleViewChange(value as SmisDocumentViewMode)
    }
  }
  const handleCategorySelect = (id?: string): void => {
    selectedCategoryId.value = id
    categoryTreeRef.value?.setCurrentKey(id)
    void reloadByContext()
  }
  const handleCategoryNodeClick = (row: SmisDocumentCategory): void => handleCategorySelect(row.id)
  const handleFolderOpen = (id?: string): void => {
    selectedCategoryId.value = id
    void reloadByContext()
  }
  const filterCategoryNode = (value: string, data: TreeNodeData): boolean => {
    const item = data as SmisDocumentCategory
    return (
      !value || item.categoryName.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase())
    )
  }
  watch(categoryKeyword, (value) => categoryTreeRef.value?.filter(value))
  watch(() => query.keyword, cancelRequest, { flush: 'sync' })
  watchDebounced(
    () => query.keyword,
    () => void reloadByContext(true),
    { debounce: 360 }
  )
  watch(
    () => query.status,
    () => void reloadByContext(true)
  )
  const handleSelectionChange = (rows: SmisDocument[]): void => {
    selectedRows.value = rows
  }
  const openDocumentDialog = async (
    dialogMode: DocumentDialogMode,
    row?: SmisDocument
  ): Promise<void> => {
    await loadDocumentDialog()
    await documentDialogRef.value?.handleOpen({
      mode: dialogMode,
      categories: categories.value,
      row,
      presetCategoryId: selectedCategoryId.value
    })
  }
  const openCategoryDialog = async (row?: SmisDocumentCategory): Promise<void> => {
    await loadCategoryDialog()
    await categoryDialogRef.value?.handleOpen({
      categories: categories.value,
      row,
      parentId: row ? undefined : selectedCategoryId.value
    })
  }
  const openShareDialog = async (row: SmisDocument): Promise<void> => {
    await loadShareDialog()
    await shareDialogRef.value?.handleOpen({ row })
  }
  const handleRowAction = (item: ButtonMoreItem, row: SmisDocument): void => {
    if (item.key === 'upload') void openDocumentDialog('upload', row)
    if (item.key === 'follow') void handleFollow(row)
    if (item.key === 'share') void openShareDialog(row)
    if (item.key === 'delete') void handleDeleteDocument(row)
  }
  const handleCardCommand = (command: string, row: SmisDocument): void => {
    if (command === 'edit') void openDocumentDialog('edit', row)
    else handleRowAction({ key: command, label: command }, row)
  }
  const handleFollow = async (row: SmisDocument): Promise<void> => {
    await toggleDocumentFollow(row.id, !row.isFollowing)
    await refreshUpdate()
  }
  const handleDeleteDocument = async (row: SmisDocument): Promise<void> => {
    if (row.status !== 'draft') {
      ElMessage.warning('仅草稿文档允许删除，已发布文档请编辑为作废或归档')
      return
    }
    await deleteDocumentRecords({
      resources: [{ id: row.id, label: row.title }],
      permission: 'SmisAllDocuments:Delete',
      remove: () => deleteDocuments([row.id ?? '']),
      onDeleted: async () => {
        await refreshRemove()
        await loadCategories()
      }
    })
  }
  const handleBatchDelete = async (): Promise<void> => {
    const rows = [...selectedRows.value]
    if (rows.some((row) => row.status !== 'draft')) {
      ElMessage.warning('请仅选择草稿文档后删除')
      return
    }
    await deleteDocumentRecords({
      resources: rows.map((row) => ({ id: row.id, label: row.title })),
      permission: 'SmisAllDocuments:Delete',
      remove: () => deleteDocuments(rows.map((row) => row.id)),
      onDeleted: async () => {
        await refreshRemove()
        await loadCategories()
      }
    })
  }
  const handleDeleteCategory = async (): Promise<void> => {
    const row = selectedCategory.value
    if (!row) return
    await deleteCategoryRecords({
      resources: [{ id: row.id, label: row.categoryName }],
      permission: 'SmisAllDocuments:CategoryDelete',
      remove: () => deleteDocumentCategories([row.id ?? '']),
      onDeleted: async () => {
        selectedCategoryId.value = row.parentId || undefined
        await Promise.all([loadCategories(), reloadByContext()])
      }
    })
  }
  const excelColumns: ExcelColumn<DocumentExportRow>[] = [
    { key: 'title', title: '文档标题' },
    { key: 'categoryPath', title: '分类路径' },
    { key: 'fileName', title: '文件名' },
    { key: 'versionNo', title: '版本号' },
    { key: 'status', title: '状态' },
    { key: 'latestEffectiveDate', title: '实施日期' },
    { key: 'implementationState', title: '实施状态' },
    { key: 'creatorName', title: '创建人' },
    { key: 'updateTime', title: '更新时间' }
  ]
  const handleExport = async (): Promise<void> => {
    exporting.value = true
    try {
      const response = await exportDocumentList({
        keyword: query.keyword.trim() || undefined,
        status: query.status,
        categoryId: selectedCategoryId.value,
        scope: scope.value
      })
      if (!response.data.length) {
        ElMessage.warning('当前条件下暂无可导出的文档')
        return
      }
      const exportRows: DocumentExportRow[] = response.data.map((row) => ({
        title: row.title,
        categoryPath: row.categoryPath,
        fileName: row.fileName ?? '',
        versionNo: row.versionNo ? `V${row.versionNo}` : '',
        status: statusLabel(row.status),
        latestEffectiveDate: row.latestEffectiveDate ?? '',
        implementationState:
          row.implementationState === 'scheduled'
            ? '待实施'
            : row.implementationState === 'effective'
              ? '已生效'
              : '无文件',
        creatorName: row.creatorName,
        updateTime: row.updateTime ? dayjs(row.updateTime).format('YYYY-MM-DD HH:mm:ss') : ''
      }))
      await exportExcel({
        filename: `全部文档-${dayjs().format('YYYYMMDD')}`,
        sheetName: '文档清单',
        columns: excelColumns,
        data: exportRows
      })
    } catch (error) {
      notifyFriendlyError(error, '文档导出失败，请刷新后重试')
    } finally {
      exporting.value = false
    }
  }
  const handleDocumentSaved = async (type: 'add' | 'edit'): Promise<void> => {
    await Promise.all([loadCategories(), type === 'add' ? refreshCreate() : refreshUpdate()])
  }
  const handleCategorySaved = async (): Promise<void> => {
    await loadCategories()
    await reloadByContext()
  }
  const handleShareSuccess = async (): Promise<void> => {
    if (scope.value === 'shared_by_me') await refreshUpdate()
  }
  onMounted(async () => {
    await Promise.all([userStore.ensureDictLoaded('smisDocumentStatus'), loadCategories()])
    await reloadByContext()
  })
</script>

<style scoped lang="scss">
  .document-center-page {
    gap: 12px;
    min-width: 0;

    &__workspace {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    &__command-bar,
    &__filter-bar,
    &__results-heading,
    &__category-header,
    &__category-actions,
    &__filters,
    &__primary-actions,
    &__view-control,
    &__view-switch,
    &__segment-option,
    &__document-card-meta,
    &__document-card footer,
    &__breadcrumbs {
      display: flex;
      align-items: center;
    }

    &__command-bar {
      flex-wrap: wrap;
      gap: 16px;
      justify-content: space-between;
      min-height: 60px;
      padding: 8px 18px;
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__scopes {
      flex: 1 1 560px;
      min-width: 0;
      max-width: 680px;

      :deep(.el-segmented__item-label) {
        padding-inline: 12px;
      }
    }

    &__segment-option {
      gap: 7px;
      justify-content: center;
      min-width: 0;
      white-space: nowrap;

      .art-svg-icon {
        flex: 0 0 auto;
        font-size: 16px;
      }
    }

    &__primary-actions {
      flex-wrap: wrap;
      gap: 8px;

      .el-button + .el-button {
        margin-left: 0;
      }
    }

    &__filter-bar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      min-height: 54px;
      padding: 10px 18px;
      background: var(--art-gray-100);
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__filters {
      display: grid;
      grid-template-columns: minmax(260px, 420px) 150px;
      gap: 8px;
      min-width: 0;
      max-width: 578px;

      > .el-input {
        width: 100%;
      }

      > .el-select {
        width: 100%;
      }
    }

    &__view-control {
      flex: 0 0 auto;
      gap: 6px;
      min-width: 0;
    }

    &__focus-toggle.is-active {
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, transparent);
    }

    &__view-switch {
      width: 116px;

      :deep(.el-segmented__item) {
        justify-content: center;
        padding-inline: 0;
      }

      :deep(.el-segmented__item-label) {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-width: 0;
        padding-inline: 0;
      }
    }

    &__segment-option.is-icon-only {
      width: 18px;
      height: 24px;
    }

    &__error {
      margin: 10px 18px 0;
    }

    &__content {
      display: grid;
      flex: 1;
      grid-template-rows: minmax(0, 1fr);
      grid-template-columns: 260px minmax(0, 1fr);
      min-width: 0;
      min-height: 0;

      &.is-folder,
      &.is-list {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    &__category-panel {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      background: color-mix(in srgb, var(--art-gray-100) 72%, var(--default-box-color));
      border-right: 1px solid var(--el-border-color-lighter);
    }

    &__category-header {
      justify-content: space-between;
      padding: 14px 14px 10px;

      > div:first-child {
        display: grid;

        span {
          font-weight: 650;
          color: var(--el-text-color-primary);
        }

        small {
          margin-top: 2px;
          font-size: 11px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    &__category-actions {
      gap: 2px;
    }

    &__category-search {
      padding: 0 12px 10px;
    }

    &__all-category {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 38px;
      padding: 0 12px;
      margin: 0 8px 6px;
      color: var(--el-text-color-regular);
      text-align: left;
      background: transparent;
      border: 0;
      border-radius: var(--el-border-radius-base);

      span {
        display: flex;
        gap: 7px;
        align-items: center;
      }

      strong {
        min-width: 24px;
        padding: 1px 6px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        text-align: center;
        background: var(--el-fill-color);
        border-radius: 999px;
      }

      &:hover,
      &.is-active {
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      }

      &:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--theme-color) 50%, transparent);
        outline-offset: -2px;
      }
    }

    &__category-scrollbar {
      flex: 1;
      min-height: 0;
      padding: 0 8px 12px;

      :deep(.el-tree) {
        background: transparent;
      }

      :deep(.el-tree-node__content) {
        min-height: 36px;
        margin-bottom: 2px;
        border-radius: var(--el-border-radius-base);
      }

      :deep(.el-tree-node.is-current > .el-tree-node__content) {
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      }
    }

    &__tree-node {
      display: flex;
      flex: 1;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
      padding-right: 8px;

      > span {
        display: flex;
        gap: 6px;
        align-items: center;
        min-width: 0;
      }

      > span span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        flex: 0 0 auto;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__results {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      padding: 0 16px 12px;
    }

    &__results-heading {
      flex: 0 0 auto;
      justify-content: space-between;
      min-height: 64px;
      border-bottom: 1px solid var(--el-border-color-lighter);

      > div {
        display: flex;
        gap: 10px;
        align-items: center;
        min-width: 0;
      }

      > div > div {
        display: grid;
        min-width: 0;
      }

      strong,
      p {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      p {
        margin: 2px 0 0;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__path-icon {
      display: grid;
      flex: 0 0 34px;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    &__result-count {
      flex: 0 0 auto;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__table {
      flex: 1;
      min-height: 0;
      padding-top: 10px;
    }

    &__breadcrumbs {
      flex: 0 0 auto;
      gap: 2px;
      min-height: 40px;
      color: var(--el-text-color-secondary);

      button {
        padding: 4px 6px;
        color: inherit;
        background: transparent;
        border: 0;
        border-radius: var(--el-border-radius-small);

        &:hover,
        &:focus-visible {
          color: var(--theme-color);
          background: color-mix(in srgb, var(--theme-color) 7%, transparent);
        }

        &:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--theme-color) 45%, transparent);
        }
      }
    }

    &__folder-scrollbar {
      flex: 1 1 auto;
      min-height: 0;
    }

    &__folder-grid,
    &__document-grid {
      display: grid;
      gap: 12px;
      padding: 4px 2px 12px;
    }

    &__folder-grid {
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }

    &__folder-card {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 18px;
      gap: 10px;
      align-items: center;
      min-height: 74px;
      padding: 12px 14px;
      color: var(--el-text-color-primary);
      text-align: left;
      background: var(--art-gray-100);
      border: 1px solid transparent;
      border-radius: var(--el-border-radius-base);
      transition:
        color 160ms ease,
        background-color 160ms ease,
        border-color 160ms ease;

      > span:first-child {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        color: var(--el-color-warning);
        background: var(--el-color-warning-light-9);
        border-radius: var(--el-border-radius-base);
      }

      > span:first-child svg {
        width: 24px;
        height: 24px;
      }

      > span:nth-child(2) {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 3px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      &:hover {
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
        border-color: color-mix(in srgb, var(--theme-color) 28%, transparent);
      }

      &:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--theme-color) 50%, transparent);
        outline-offset: 2px;
      }
    }

    &__document-grid {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }

    &__document-card {
      display: grid;
      align-content: start;
      min-width: 0;
      padding: 15px;
      background: var(--default-box-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      > p {
        display: -webkit-box;
        min-height: 38px;
        margin: 10px 0 12px;
        overflow: hidden;
        -webkit-line-clamp: 2;
        font-size: 12px;
        line-height: 1.6;
        color: var(--el-text-color-secondary);
        -webkit-box-orient: vertical;
      }

      footer {
        justify-content: space-between;
        padding-top: 10px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        border-top: 1px solid var(--el-border-color-lighter);
      }
    }

    &__document-card-top {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) 30px;
      gap: 10px;
      align-items: center;

      > span:first-child {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
        border-radius: var(--el-border-radius-base);
      }

      > span:first-child.is-danger {
        color: var(--el-color-danger);
        background: var(--el-color-danger-light-9);
      }

      > span:first-child.is-success {
        color: var(--el-color-success);
        background: var(--el-color-success-light-9);
      }

      > span:first-child.is-warning {
        color: var(--el-color-warning-dark-2);
        background: var(--el-color-warning-light-9);
      }

      > div {
        display: grid;
        min-width: 0;
      }

      strong,
      .document-center-page__document-link {
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 650;
        text-align: left;
        white-space: nowrap;
      }

      .document-center-page__document-link {
        justify-content: flex-start;
        width: 100%;
      }

      strong {
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 3px;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }
    }

    &__document-card-meta {
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }

    &__document-card-meta > span:not(.el-tag) {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__folder-pagination {
      flex: 0 0 auto;
      justify-content: center;
      padding-top: 10px;
      border-top: 1px solid var(--el-border-color-lighter);
    }

    :deep(.document-center-page__identity) {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;

      > span:first-child {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
        border-radius: var(--el-border-radius-base);
      }

      > span:first-child.is-danger {
        color: var(--el-color-danger);
        background: var(--el-color-danger-light-9);
      }

      > span:first-child.is-success {
        color: var(--el-color-success);
        background: var(--el-color-success-light-9);
      }

      > span:first-child.is-warning {
        color: var(--el-color-warning-dark-2);
        background: var(--el-color-warning-light-9);
      }

      > span:last-child {
        display: grid;
        min-width: 0;
      }

      strong,
      .document-center-page__document-link,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong,
      .document-center-page__document-link {
        font-weight: 650;
        text-align: left;
      }

      .document-center-page__document-link {
        justify-content: flex-start;
        width: 100%;
      }

      strong {
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.document-center-page__scheduled) {
      display: grid;
      justify-items: start;

      small {
        margin-top: 2px;
        font-size: 10px;
        color: var(--el-color-warning-dark-2);
      }

      &.is-effective small {
        color: var(--el-text-color-secondary);
      }
    }

    @media (width <= 1100px) {
      &__content {
        grid-template-columns: 230px minmax(0, 1fr);
      }

      &__primary-actions {
        width: 100%;
      }
    }

    @media (width <= 760px) {
      &__command-bar,
      &__filter-bar {
        padding-inline: 12px;
      }

      &__command-bar {
        gap: 10px;
      }

      &__scopes {
        width: 100%;
        max-width: none;
      }

      &__primary-actions {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));

        .el-button {
          width: 100%;
          padding-inline: 8px;
        }
      }

      &__content {
        grid-template-columns: minmax(0, 1fr);
      }

      &__category-panel {
        display: none;
      }

      &__results {
        padding-inline: 10px;
      }

      &__filters {
        grid-template-columns: minmax(0, 1fr) 150px;
        width: 100%;
        max-width: none;

        > .el-input,
        > .el-select {
          width: 100%;
        }
      }

      &__view-control {
        justify-self: end;
      }

      &__view-switch {
        width: 116px;
      }

      &__document-grid,
      &__folder-grid {
        grid-template-columns: 1fr;
      }

      &__folder-pagination {
        flex-wrap: wrap;
        row-gap: var(--art-space-3);
        justify-content: flex-start;
      }
    }

    @media (width <= 560px) {
      &__filter-bar {
        grid-template-columns: minmax(0, 1fr);
      }

      &__filters {
        grid-template-columns: minmax(0, 1fr) 128px;
      }

      &__view-switch :deep(.el-segmented__item-label) {
        min-width: 0;
        padding-inline: 6px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      &__folder-card {
        transition: none;
      }
    }
  }
</style>
