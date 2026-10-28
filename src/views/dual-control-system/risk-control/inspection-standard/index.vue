<template>
  <ArtPermissionGuard permission="SmisDualControlInspectionStandard:View">
    <div class="inspection-standard-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="inspection-standard-page__overview"
        eyebrow="INSPECTION STANDARD LIBRARY"
        title="排查标准"
        description="以层级标准组织可执行排查项，统一内容编号、展示标识和启停状态，作为任务生成的基础口径。"
        icon="ri:survey-line"
        density="compact"
        :tags="[
          { label: '层级标准', type: 'primary', effect: 'plain' },
          { label: '内容可追溯', type: 'success', effect: 'light' },
          { label: '租户级配置', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="inspection-standard-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="292px"
          primary-min="250px"
          primary-max="400px"
          :breakpoint="860"
          :stacked-primary-size="
            treeState.loading || treeState.error || !treeState.rows.length ? 'auto' : '310px'
          "
        >
          <template #primary>
            <ArtSectionCard
              :show-scrollbar="false"
              class="inspection-standard-page__navigation-card"
              title="排查标准导航"
              subtitle="选择层级后查看关联排查项"
              :loading="treeState.loading"
              :error="treeState.error"
              :empty="!treeState.loading && !treeState.rows.length"
              empty-title="暂无排查标准"
              empty-description="先创建一级排查标准，再维护其排查项。"
              @retry="loadStandards"
            >
              <template #actions>
                <ArtTreeExpandToggle
                  :tree="treeRef"
                  :data="standardTree"
                  label="排查标准树"
                  default-expanded
                />
                <ArtIconButton
                  icon="ri:add-line"
                  label="新增一级标准"
                  permission="SmisDualControlInspectionStandard:Add"
                  @click="openStandardDialog()"
                />
                <ArtIconButton
                  icon="ri:refresh-line"
                  label="刷新标准导航"
                  :loading="treeState.loading"
                  @click="loadStandards"
                />
              </template>
              <div class="inspection-standard-page__navigator-content">
                <ElInput
                  v-model="treeState.keyword"
                  clearable
                  placeholder="筛选标准名称或编号"
                  aria-label="筛选排查标准"
                  class="inspection-standard-page__tree-search"
                >
                  <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
                </ElInput>
                <ElScrollbar class="inspection-standard-page__tree-scrollbar">
                  <ElTree
                    ref="treeRef"
                    :data="standardTree"
                    node-key="id"
                    highlight-current
                    default-expand-all
                    :expand-on-click-node="false"
                    :filter-node-method="filterTreeNode"
                    @node-click="handleStandardSelect"
                  >
                    <template #default="{ data }">
                      <div class="inspection-standard-page__tree-node">
                        <span class="inspection-standard-page__tree-label"
                          ><i :style="{ background: data.textColor || 'var(--theme-color)' }"></i
                          ><span
                            ><strong>{{ data.standardName }}</strong
                            ><small>{{ data.standardCode }}</small></span
                          ></span
                        >
                        <span class="inspection-standard-page__tree-actions" @click.stop>
                          <ArtIconButton
                            icon="ri:add-line"
                            label="新增下级标准"
                            permission="SmisDualControlInspectionStandard:Add"
                            @click="openStandardDialog(undefined, data.id)"
                          />
                          <ArtIconButton
                            icon="ri:edit-line"
                            label="编辑标准"
                            permission="SmisDualControlInspectionStandard:Edit"
                            :disabled="data.status === 'voided'"
                            @click="openStandardDialog(data)"
                          />
                          <ArtIconButton
                            icon="ri:delete-bin-line"
                            label="删除标准"
                            tone="danger"
                            permission="SmisDualControlInspectionStandard:Delete"
                            @click="handleDeleteStandard(data)"
                          />
                        </span>
                      </div>
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
              </div>
            </ArtSectionCard>
          </template>

          <main class="inspection-standard-page__main">
            <div class="inspection-standard-page__scope">
              <span class="inspection-standard-page__scope-icon"
                ><ArtSvgIcon icon="ri:focus-3-line"
              /></span>
              <span
                ><small>当前排查标准</small
                ><strong>{{ selectedStandard?.standardName || '全部标准' }}</strong></span
              >
              <ElTag v-if="selectedStandard" effect="plain">{{
                selectedStandard.standardCode
              }}</ElTag>
              <p>{{
                selectedStandard
                  ? '列表显示当前标准及下级标准关联的排查内容'
                  : '正在查看全部排查标准的内容事项'
              }}</p>
            </div>
            <ArtTableQuery
              ref="tableQueryRef"
              class="inspection-standard-page__table"
              v-model="searchQuery"
              :api-fn="fetchTableData"
              :search-items="searchItems"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :search-bar-props="{ span: 8, labelWidth: 78, showExpand: false }"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyText: selectedStandard ? '当前标准暂无排查项' : '暂无排查项',
                emptyDescription: '新增可直接执行、可核验的排查内容。'
              }"
              focusable
              focus-scope-selector=".inspection-standard-page__workspace"
            />
          </main>
        </ArtWorkspaceSplitter>
      </div>

      <StandardDialog ref="standardDialogRef" @success="handleStandardSaved" />
      <ItemDialog ref="itemDialogRef" @success="handleItemSaved" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import { useAuth } from '@/hooks/core/useAuth'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { ElTag, ElTree } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryExcelColumn
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import TreeUtils from '@/utils/tree'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import {
    deleteInspectionItems,
    deleteInspectionStandards,
    fetchInspectionItems,
    fetchInspectionStandards,
    voidInspectionItems,
    type SmisInspectionItem,
    type SmisInspectionItemSearchParams,
    type SmisInspectionStandard
  } from '@smis/api'
  import StandardDialog, { type StandardDialogOpenData } from './modules/standard-dialog.vue'
  import ItemDialog, { type ItemDialogOpenData } from './modules/item-dialog.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisDualControlInspectionStandard' })
  const { hasAnyAuth } = useAuth()
  type TableParams = SmisInspectionItemSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface StandardDialogExpose {
    handleOpen: (data: StandardDialogOpenData) => Promise<void>
  }
  interface ItemDialogExpose {
    handleOpen: (data: ItemDialogOpenData) => Promise<void>
  }

  const { confirmDelete, confirmAction } = useArtFeedback()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { getDictMap } = storeToRefs(userStore)
  const { effectiveTenantId, revision } = storeToRefs(tenantScopeStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const standardDialogRef = ref<StandardDialogExpose>()
  const itemDialogRef = ref<ItemDialogExpose>()
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const searchQuery = ref<SmisInspectionItemSearchParams>({})
  const selectedId = ref<string | null>(null)
  const treeState = reactive({
    rows: [] as SmisInspectionStandard[],
    loading: false,
    error: '',
    keyword: ''
  })
  const totalItems = ref(0)

  const toTree = (rows: SmisInspectionStandard[]) => {
    const nodes = rows.map((row) => ({ ...row, children: [] as SmisInspectionStandard[] }))
    const map = new Map(nodes.map((node) => [node.id, node]))
    const roots: typeof nodes = []
    nodes.forEach((node) => {
      const parent = node.parentId ? map.get(node.parentId) : undefined
      if (parent) parent.children.push(node)
      else roots.push(node)
    })
    return roots
  }
  const standardTree = computed(() => toTree(treeState.rows))
  const standardTreeUtils = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })
  const selectedStandardIds = computed(() => {
    if (!selectedId.value) return undefined
    const ids = standardTreeUtils
      .getDescendants(standardTree.value, selectedId.value, true)
      .map((standard) => String(standard.id))
    return ids.length ? ids : [selectedId.value]
  })
  const selectedStandard = computed(() => treeState.rows.find((row) => row.id === selectedId.value))
  const statusOptions = computed(() =>
    (getDictMap.value.commonEnabledDisabledVoidedStatus ?? []).map(toDictionaryOption)
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '标准节点',
      value: treeState.rows.length,
      description: '当前租户层级',
      icon: 'ri:node-tree'
    },
    {
      label: '排查内容',
      value: totalItems.value,
      description: selectedStandard.value ? '当前筛选结果' : '当前查询结果',
      icon: 'ri:list-check-3'
    },
    {
      label: '启用标准',
      value: treeState.rows.filter((row) => row.status === 'enabled').length,
      description: '可用于新增任务',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '内容编号或排查内容' }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'itemCode', title: '排查内容编号', required: true },
    { key: 'inspectionContent', title: '排查内容', required: true },
    { key: 'sort', title: '排序' },
    { key: 'textColor', title: '文字颜色' },
    { key: 'tagStyle', title: '标签样式' },
    { key: 'status', title: '状态' },
    { key: 'createBy', title: '创建人' },
    { key: 'createTime', title: '创建时间' }
  ]
  const openStandardDialog = (row?: SmisInspectionStandard, parentId?: string) =>
    void standardDialogRef.value?.handleOpen({
      row,
      parentId,
      tenantId: row?.tenantId || effectiveTenantId.value,
      standards: treeState.rows
    })
  const openItemDialog = (row?: SmisInspectionItem) =>
    void itemDialogRef.value?.handleOpen({
      row,
      standardId: row?.standardId || selectedId.value || undefined,
      tenantId: row?.tenantId || effectiveTenantId.value,
      standards: treeState.rows
    })
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlInspectionStandard:Add',
      type: 'add',
      label: '新增排查项',
      disabled: !selectedId.value,
      onClick: () => openItemDialog()
    },
    {
      permission: 'SmisDualControlInspectionStandard:Export',
      type: 'export',
      exportFilename: '排查标准内容',
      exportSheetName: '排查项',
      exportColumns: excelColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const exportQuery: SmisInspectionItemSearchParams = {
          ...(searchParams as SmisInspectionItemSearchParams),
          tenantId: effectiveTenantId.value,
          ancestorStandardIds: selectedStandardIds.value?.slice(),
          ids: selectedIds.map(String)
        }
        const rows = await loadAllDocumentPages(fetchInspectionItems, exportQuery)
        await Promise.all([
          userStore.ensureDictLoaded('commonEnabledDisabledVoidedStatus'),
          userStore.ensureDictLoaded('smisTagStyle')
        ])
        return {
          data: rows.map((row) => ({
            ...row,
            status: userStore.getDictLabelByValue('commonEnabledDisabledVoidedStatus', row.status),
            tagStyle: userStore.getDictLabelByValue('smisTagStyle', row.tagStyle)
          }))
        }
      }
    },
    {
      permission: 'SmisDualControlInspectionStandard:Void',
      key: 'void',
      label: '作废',
      icon: 'ri:forbid-2-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }) => {
        await confirmAction('确定作废选中的排查项吗？作废后仅保留历史引用。', '作废排查项')
        await voidInspectionItems(selectedRows.map((row) => String(row.id)))
        await api.refreshUpdate()
      }
    },
    {
      permission: 'SmisDualControlInspectionStandard:Delete',
      type: 'delete',
      content: ({ selectedCount }: { selectedCount: number }) =>
        `确定删除选中的 ${selectedCount} 个排查项吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteInspectionItems(selectedRows.map((row) => String(row.id)))
        await api.refreshRemove()
      }
    }
  ])
  const columnsFactory = (): ColumnOption<SmisInspectionItem>[] => {
    const columns: ColumnOption<SmisInspectionItem>[] = [
      { type: 'selection', width: 48 },
      { type: 'globalIndex', label: '序号', width: 70 },
      {
        prop: 'itemCode',
        label: '排查内容编号',
        minWidth: 150,
        fixed: 'left',
        showOverflowTooltip: true,
        formatter: (row) => <span class="inspection-standard-page__code">{row.itemCode}</span>
      },
      {
        prop: 'inspectionContent',
        label: '排查内容',
        minWidth: 320,
        showOverflowTooltip: true,
        formatter: (row) => (
          <span style={{ color: row.textColor || undefined }}>{row.inspectionContent}</span>
        )
      },
      {
        prop: 'standard',
        label: '关联排查标准',
        minWidth: 170,
        formatter: (row) => (
          <ElTag type={row.tagStyle || 'info'} effect="light">
            {row.standard?.standardName || '—'}
          </ElTag>
        )
      },
      { prop: 'sort', label: '排序', width: 72, align: 'right' },
      {
        prop: 'status',
        label: '状态',
        width: 96,
        align: 'center',
        formatter: (row) => (
          <ElTag
            type={
              row.status === 'enabled' ? 'success' : row.status === 'disabled' ? 'warning' : 'info'
            }
            effect="plain"
          >
            {statusOptions.value.find((i) => i.value === row.status)?.label || row.status}
          </ElTag>
        )
      },
      { prop: 'createBy', label: '创建人', minWidth: 110, showOverflowTooltip: true },
      {
        prop: 'createTime',
        label: '创建时间',
        width: 164,
        formatter: (row) => formatTableDateTime(row.createTime)
      },
      {
        prop: 'operation',
        label: '操作',
        width: 140,
        fixed: 'right',
        formatter: (row) => (
          <BusinessTableRowActions>
            <ArtButtonTable
              type="edit"
              permission="SmisDualControlInspectionStandard:Edit"
              label="编辑排查项"
              disabled={row.status === 'voided'}
              onClick={() => openItemDialog(row)}
            />
            <ArtButtonTable
              type="delete"
              permission="SmisDualControlInspectionStandard:Delete"
              label="删除排查项"
              onClick={() => void handleDeleteItem(row)}
            />
          </BusinessTableRowActions>
        )
      }
    ]
    return columns.filter(
      (column) =>
        column.prop !== 'operation' ||
        hasAnyAuth([
          'SmisDualControlInspectionStandard:Edit',
          'SmisDualControlInspectionStandard:Delete'
        ])
    )
  }
  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchInspectionItems({
      ...params,
      tenantId: effectiveTenantId.value,
      ancestorStandardIds: selectedStandardIds.value,
      from,
      to
    })
    totalItems.value = result.total
    return result
  }
  const loadStandards = async () => {
    treeState.loading = true
    treeState.error = ''
    try {
      const result = await fetchInspectionStandards(effectiveTenantId.value)
      if (result.error) throw result.error
      treeState.rows = result.data ?? []
      if (selectedId.value && !treeState.rows.some((row) => row.id === selectedId.value))
        selectedId.value = null
    } catch (error) {
      treeState.error = getFriendlySupabaseErrorMessage(error, '排查标准加载失败')
    } finally {
      treeState.loading = false
    }
  }
  const handleStandardSelect = (row: SmisInspectionStandard) => {
    selectedId.value = row.id
    void nextTick(() => tableQueryRef.value?.refreshContext())
  }
  const filterTreeNode = (value: string, data: Record<string, unknown>) =>
    !value ||
    `${String(data.standardCode || '')} ${String(data.standardName || '')}`
      .toLowerCase()
      .includes(value.toLowerCase())
  const handleDeleteStandard = async (row: SmisInspectionStandard) => {
    try {
      await confirmDelete(
        `确定删除排查标准“${row.standardName}”吗？存在下级或排查项时系统会阻止删除。`
      )
      await deleteInspectionStandards([row.id])
      await loadStandards()
      void tableQueryRef.value?.refreshContext()
    } catch {
      /* 用户取消或业务约束阻止 */
    }
  }
  const handleDeleteItem = async (row: SmisInspectionItem) => {
    try {
      await confirmDelete(`确定删除排查项“${row.itemCode}”吗？`)
      await deleteInspectionItems([row.id])
      await tableQueryRef.value?.refreshRemove()
    } catch {
      /* 用户取消 */
    }
  }
  const handleStandardSaved = async () => {
    await loadStandards()
    void tableQueryRef.value?.refreshContext()
  }
  const handleItemSaved = (type: 'add' | 'edit') =>
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  watch(
    () => treeState.keyword,
    (value) => treeRef.value?.filter(value)
  )
  watch(revision, async () => {
    selectedId.value = null
    await loadStandards()
    void tableQueryRef.value?.refreshContext()
  })
  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('commonEnabledDisabledVoidedStatus'),
      userStore.ensureDictLoaded('smisTagStyle'),
      tenantScopeStore.loadTenantOptions(),
      loadStandards()
    ])
  })
</script>

<style scoped lang="scss">
  .inspection-standard-page {
    gap: 12px;
    min-width: 0;
    overflow: hidden;

    &__overview {
      min-width: 0;
      overflow: hidden;
    }

    &__workspace {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
    }

    &__navigation-card {
      height: 100%;

      :deep(.art-section-card__body),
      :deep(.art-async-state),
      :deep(.art-async-state__content) {
        height: 100%;
        min-height: 0;
      }

      :deep(.art-section-card__body) {
        display: flex;
        flex-direction: column;
      }
    }

    &__navigator-content {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
    }

    &__tree-search {
      flex: 0 0 auto;
    }

    &__tree-scrollbar {
      flex: 1 1 auto;
      min-height: 0;
    }

    :deep(.el-tree) {
      min-width: 100%;
      background: transparent;
    }

    :deep(.el-tree-node__content) {
      min-height: 48px;
      margin-bottom: 2px;
      border-radius: var(--el-border-radius-base);
    }

    :deep(.el-tree-node.is-current > .el-tree-node__content) {
      background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      box-shadow: inset 3px 0 0 var(--theme-color);
    }

    &__main,
    &__table {
      min-width: 0;
      min-height: 0;
    }

    &__main {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    &__table {
      flex: 1 1 auto;
    }

    :deep(.inspection-standard-page__code) {
      display: inline-block;
      max-width: 100%;
      padding: 4px 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
      font-weight: 700;
      color: var(--theme-color);
      white-space: nowrap;
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-small);
    }

    &__tree-node {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
      min-width: 0;
      padding-right: 4px;
    }

    &__tree-label {
      display: grid;
      flex: 1;
      grid-template-columns: 8px minmax(0, 1fr);
      gap: 9px;
      align-items: center;
      min-width: 0;

      > i {
        width: 7px;
        height: 30px;
        border-radius: 999px;
      }

      span {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__tree-actions {
      display: none;
      align-items: center;
    }

    &__tree-node:hover &__tree-actions,
    :deep(.is-current > .el-tree-node__content) &__tree-actions {
      display: flex;
    }

    &__scope {
      display: grid;
      flex: 0 0 auto;
      grid-template-columns: 36px max-content max-content minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-height: 56px;
      padding: 8px 14px 8px 12px;
      background: var(--art-gray-100);
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);

      span:nth-child(2) {
        display: flex;
        flex-direction: column;
      }

      small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      p {
        margin: 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
        text-align: right;
      }
    }

    &__scope-icon {
      @include business-icon-box;
    }

    @media (width <= 700px) {
      &__scope {
        grid-template-columns: 36px minmax(0, 1fr) max-content;

        p {
          display: none;
        }
      }
    }
  }
</style>
