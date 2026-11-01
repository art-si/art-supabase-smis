<template>
  <ArtPermissionGuard permission="SmisMaterialCategory:View" resource-name="物料类别">
    <div class="material-category-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="PROTECTIVE EQUIPMENT TAXONOMY"
        title="物料类别"
        description="维护防护用品、工器具与办公用品的统一分类层级，为物料主数据提供稳定、可追溯的归类口径。"
        icon="ri:node-tree"
        :tags="[
          { label: '租户级隔离', type: 'primary', effect: 'plain' },
          { label: '树形分类', type: 'success', effect: 'light' },
          { label: '物料主数据', type: 'info', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="material-category-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="300px"
          primary-min="260px"
          primary-max="420px"
          :breakpoint="900"
          stacked-primary-size="36vh"
        >
          <template #primary>
            <MaterialCategoryNavigator
              :data="tree.data"
              :loading="tree.loading"
              :error="tree.error"
              :selected-key="tree.selectedKey"
              @select="handleTreeSelect"
              @refresh="handleTreeRefresh"
            />
          </template>
          <ArtTableQuery
            ref="tableQueryRef"
            v-model="table.searchQuery"
            class="material-category-page__table"
            :api-fn="fetchTableData"
            :search-items="table.searchItems"
            :columns-factory="columnsFactory"
            :header-actions="table.headerActions"
            header-actions-placement="workspace"
            :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: tree.selectedKey === ALL_KEY ? '暂无物料类别' : '当前类别下暂无数据',
              emptyDescription:
                tree.selectedKey === ALL_KEY
                  ? '请先新增一级物料类别，再逐步维护下级结构。'
                  : '可新增下级类别，或切换左侧节点查看其他类别。'
            }"
            focusable
            focus-scope-selector=".material-category-page__workspace"
          />
        </ArtWorkspaceSplitter>
      </div>
      <MaterialCategoryDialog ref="dialogRef" @success="handleSaveSuccess" />
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
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'

  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import TreeUtils from '@/utils/tree'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import {
    deleteMaterialCategories,
    fetchMaterialCategoryList,
    type SmisMaterialCategory,
    type SmisMaterialCategoryOverview,
    type SmisMaterialCategorySearchParams
  } from '@smis/api'
  import MaterialCategoryNavigator from '../shared/material-category-navigator.vue'
  import MaterialCategoryDialog, {
    type MaterialCategoryDialogOpenData
  } from './modules/material-category-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'mdm_material_category',
    '物料类别'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisMaterialCategory' })
  const ALL_KEY = 'all'
  type TableParams = SmisMaterialCategorySearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: MaterialCategoryDialogOpenData) => Promise<void>
  }
  interface TableGroup {
    searchQuery: SmisMaterialCategorySearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
  }
  interface TreeGroup {
    data: SmisMaterialCategory[]
    selectedKey: string
    loading: boolean
    error: string | null
  }
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const { effectiveTenantId, isAllTenants } = storeToRefs(useTenantScopeStore())
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const overview = reactive<SmisMaterialCategoryOverview>({
    total: 0,
    enabled: 0,
    rootCount: 0,
    usedCount: 0
  })
  const tree = reactive<TreeGroup>({ data: [], selectedKey: ALL_KEY, loading: false, error: null })
  const statusOptions = computed(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )
  const selectedCategory = computed(() =>
    tree.selectedKey === ALL_KEY ? null : treeUtils.findNode(tree.data, tree.selectedKey)
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '类别总数',
      value: overview.total,
      description: '当前租户分类节点',
      icon: 'ri:stack-line'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可用于新增物料',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '一级类别',
      value: overview.rootCount,
      description: '分类树根节点',
      icon: 'ri:git-branch-line'
    },
    {
      label: '已使用类别',
      value: overview.usedCount,
      description: '已关联物料信息',
      icon: 'ri:links-line',
      tone: 'warning'
    }
  ])
  const openDialog = (row?: SmisMaterialCategory): void => {
    const tenantId = row?.tenantId || effectiveTenantId.value || getUserInfo.value.tenantId || ''
    void dialogRef.value?.handleOpen({
      row,
      tenantId,
      allTenants: isAllTenants.value,
      tree: tree.data,
      presetParentId:
        !row && selectedCategory.value?.tenantId === tenantId
          ? selectedCategory.value.id
          : undefined
    })
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisMaterialCategory:Add',
      type: 'add',
      label: selectedCategory.value ? '新增下级类别' : '新增物料类别',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisMaterialCategory:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个物料类别吗？存在未选中的下级类别或已关联物料时将无法删除。`,
      onClick: async ({ selectedRows, api }) => {
        const ids = selectedRows
          .map((row) => row.id)
          .filter((id): id is string => typeof id === 'string')
        if (ids.includes(tree.selectedKey)) tree.selectedKey = ALL_KEY
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.categoryName ?? '物料类别')
          })),
          permission: 'SmisMaterialCategory:Delete',
          remove: async () => {
            await deleteMaterialCategories(ids)
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const table = reactive<TableGroup>({
    searchQuery: {},
    searchItems: computed(() => [
      {
        label: '关键字',
        key: 'keyword',
        type: 'input',
        props: { clearable: true, placeholder: '类别编码、名称或说明' }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'select',
        props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
      }
    ]),
    headerActions
  })
  const columnsFactory = (): ColumnOption<SmisMaterialCategory>[] => [
    { type: 'selection', width: 48 },
    { prop: 'sort', label: '显示顺序', width: 106, align: 'center', sortable: true },
    {
      prop: 'categoryName',
      label: '物料类别',
      minWidth: 220,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.categoryName}
          secondary={row.categoryCode}
          icon={row.childCount ? 'ri:folder-3-line' : 'ri:price-tag-3-line'}
        />
      )
    },
    {
      prop: 'parentCategoryName',
      label: '上级物料类别',
      minWidth: 170,
      showOverflowTooltip: true,
      formatter: (row) => row.parentCategoryName || '一级类别'
    },
    {
      prop: 'materialCount',
      label: '关联物料',
      width: 110,
      align: 'center',
      sortable: true,
      formatter: (row) => `${row.materialCount || 0} 项`
    },
    {
      prop: 'status',
      label: '启用状态',
      width: 110,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonEnabledStatus" value={row.status} display="tag" />
      )
    },
    {
      prop: 'description',
      label: '说明',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.description || '—'
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 168,
      formatter: (row) => formatTableDateTime(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 132,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex items-center gap-1">
          <ArtButtonTable
            permission="SmisMaterialCategory:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            permission="SmisMaterialCategory:Delete"
            type="delete"
            onClick={async () => {
              await deleteRecords({
                resources: [
                  {
                    id: String(row.id ?? ''),
                    label: String(row.categoryName ?? '物料类别')
                  }
                ],
                permission: 'SmisMaterialCategory:Delete',
                confirmMessage: `确定删除物料类别“${row.categoryName}”吗？`,
                remove: async () => {
                  await deleteMaterialCategories(row.id ? [row.id ?? ''] : [])
                },
                onDeleted: async () => {
                  await tableQueryRef.value?.getData()
                }
              })
            }}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    tree.loading = !tree.data.length
    tree.error = null
    try {
      const result = await fetchMaterialCategoryList({
        ...buildSupabasePageRange(params),
        ...params,
        ancestorId: tree.selectedKey === ALL_KEY ? undefined : tree.selectedKey
      })
      tree.data = result.tree
      if (!options?.signal?.aborted) Object.assign(overview, result.overview)
      tree.error = result.error ? '物料类别结构加载失败，请重试。' : null
      return { records: result.data, total: result.total }
    } finally {
      tree.loading = false
    }
  }
  const handleTreeSelect = (key: string): void => {
    tree.selectedKey = key
    void tableQueryRef.value?.getData()
  }
  const handleTreeRefresh = (): void => {
    void tableQueryRef.value?.getData()
  }
  const handleSaveSuccess = async (): Promise<void> => {
    await tableQueryRef.value?.getData()
  }
  onMounted(() => void userStore.ensureDictLoaded('commonEnabledStatus'))
</script>

<style scoped lang="scss">
  .material-category-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;

    &__workspace {
      flex: 1;
      width: 100%;
      min-height: 0;
    }

    &__table {
      min-width: 0;
      min-height: 0;
    }
  }
</style>
