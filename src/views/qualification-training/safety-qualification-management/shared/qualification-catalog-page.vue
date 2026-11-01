<template>
  <ArtPermissionGuard :permission="config.permissions.view" :resource-name="config.title">
    <div
      class="qualification-catalog-page business-workspace-page art-full-height flex min-h-0 flex-col gap-[14px]"
    >
      <BusinessWorkspaceHeader
        :eyebrow="config.eyebrow"
        :title="config.title"
        :description="config.description"
        :icon="config.icon"
        :tags="[
          { label: '树形结构', type: 'primary', effect: 'plain' },
          { label: '证件联动', type: 'success', effect: 'light' },
          { label: '历史引用保护', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <div class="qualification-catalog-page__workspace min-h-0 w-full flex-1">
        <ArtWorkspaceSplitter
          primary-size="300px"
          primary-min="260px"
          primary-max="420px"
          :breakpoint="920"
          stacked-primary-size="36vh"
        >
          <template #primary>
            <QualificationCatalogNavigator
              :data="tree.navigationData"
              :loading="tree.loading"
              :error="tree.error"
              :selected-key="tree.selectedKey"
              :title="navigatorTitle"
              @select="handleTreeSelect"
              @refresh="refresh"
            />
          </template>
          <ArtTableQuery
            ref="tableRef"
            v-model="searchQuery"
            class="qualification-catalog-page__table min-h-0 min-w-0"
            :api-fn="fetchTableData"
            :search-items="searchItems"
            :columns-factory="columnsFactory"
            :header-actions="headerActions"
            header-actions-placement="workspace"
            :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: `暂无${config.title}`,
              emptyDescription: `新增${config.title}后，可在证件明细中直接选择并自动带出编码。`
            }"
            focusable
            focus-scope-selector=".qualification-catalog-page__workspace"
          />
        </ArtWorkspaceSplitter>
      </div>
      <QualificationCatalogDialog ref="dialogRef" @success="refresh" />
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
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'

  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteQualificationCatalog,
    fetchQualificationCatalogList,
    type SmisQualificationCatalog,
    type SmisQualificationCatalogNavigationNode,
    type SmisQualificationCatalogOverview,
    type SmisQualificationCatalogSearchParams,
    type SmisQualificationMaintenanceCatalogType
  } from '@smis/api'
  import QualificationCatalogNavigator from './qualification-catalog-navigator.vue'
  import QualificationCatalogDialog, {
    type QualificationCatalogDialogOpenData
  } from './qualification-catalog-dialog.vue'
  import { qualificationCatalogConfig } from './qualification-catalog-meta'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_qualification_catalog',
    '资质目录'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  const props = defineProps<{ catalogType: SmisQualificationMaintenanceCatalogType }>()
  const ALL_KEY = 'all'
  type TableParams = SmisQualificationCatalogSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: QualificationCatalogDialogOpenData) => Promise<void>
  }
  const config = computed(() => qualificationCatalogConfig[props.catalogType])
  const isPermittedOperationItem = computed(() => props.catalogType === 'permitted_operation_item')
  const navigatorTitle = computed(() =>
    isPermittedOperationItem.value ? '作业类别与准操项目' : config.value.title
  )
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const overview = reactive<SmisQualificationCatalogOverview>({
    total: 0,
    enabled: 0,
    disabled: 0,
    rootCount: 0
  })
  const tree = reactive<{
    data: SmisQualificationCatalog[]
    workCategories: SmisQualificationCatalog[]
    navigationData: SmisQualificationCatalogNavigationNode[]
    selectedKey: string
    loading: boolean
    error: string | null
  }>({
    data: [],
    workCategories: [],
    navigationData: [],
    selectedKey: ALL_KEY,
    loading: false,
    error: null
  })
  const searchQuery = ref<Omit<SmisQualificationCatalogSearchParams, 'catalogType'>>({})
  const selectedNode = computed(() =>
    tree.selectedKey === ALL_KEY
      ? null
      : (treeUtils.findNode(
          tree.navigationData,
          tree.selectedKey
        ) as SmisQualificationCatalogNavigationNode | null)
  )
  const statusOptions = computed(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '节点总数',
      value: overview.total,
      description: '当前租户全部节点',
      icon: 'ri:stack-line'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '证件新增可选',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '已停用',
      value: overview.disabled,
      description: '仅保留历史引用',
      icon: 'ri:forbid-line',
      tone: 'warning'
    },
    {
      label: '一级节点',
      value: overview.rootCount,
      description: isPermittedOperationItem.value ? '类别下一级项目' : '树形结构根节点',
      icon: 'ri:git-branch-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '编码、名称或备注' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
    }
  ])
  const selectedCatalogFilters = computed<
    Pick<SmisQualificationCatalogSearchParams, 'ancestorId' | 'workCategoryId'>
  >(() => {
    if (!selectedNode.value) return {}
    return selectedNode.value.nodeKind === 'category'
      ? { workCategoryId: selectedNode.value.id }
      : { ancestorId: selectedNode.value.id }
  })
  const openDialog = (row?: SmisQualificationCatalog): void =>
    void dialogRef.value?.handleOpen({
      catalogType: props.catalogType,
      row,
      tree: tree.data,
      workCategories: tree.workCategories,
      presetParentId:
        !row && selectedNode.value?.nodeKind === 'item' ? selectedNode.value.id : undefined,
      presetWorkCategoryId: !row
        ? selectedNode.value?.nodeKind === 'category'
          ? selectedNode.value.id
          : selectedNode.value?.workCategoryId || undefined
        : undefined
    })
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: config.value.permissions.add,
      type: 'add',
      label:
        selectedNode.value?.nodeKind === 'category'
          ? '在此类别下新增准操项目'
          : selectedNode.value
            ? `新增下级${config.value.title}`
            : `新增${config.value.title}`,
      onClick: () => openDialog()
    },
    {
      permission: config.value.permissions.delete,
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个${config.value.title}吗？存在下级或证件引用时将无法删除。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.itemName ?? '资质目录')
          })),
          permission: config.value.permissions.delete,
          remove: async () => {
            await deleteQualificationCatalog(
              props.catalogType,
              selectedRows.map((row) => String(row.id))
            )
          },
          onDeleted: async () => {
            tree.selectedKey = ALL_KEY
            await api.refreshRemove()
          }
        })
      }
    },
    {
      permission: config.value.permissions.export,
      type: 'export',
      label: '导出',
      exportFilename: config.value.title,
      exportSheetName: config.value.title,
      exportColumns: [
        ...(isPermittedOperationItem.value ? [{ key: 'workCategoryName', title: '作业类别' }] : []),
        { key: 'itemCode', title: isPermittedOperationItem.value ? '代号' : '编码' },
        { key: 'itemName', title: '名称' },
        { key: 'parentName', title: '上级节点' },
        { key: 'status', title: '启用状态' },
        { key: 'remark', title: '备注' }
      ],
      exportApi: async () => ({
        data: await loadAllDocumentPages<
          SmisQualificationCatalog,
          SmisQualificationCatalogSearchParams
        >(fetchQualificationCatalogList, {
          ...searchQuery.value,
          ...selectedCatalogFilters.value,
          catalogType: props.catalogType,
          purpose: 'export'
        })
      })
    }
  ])
  const columnsFactory = (): ColumnOption<SmisQualificationCatalog>[] => [
    { type: 'selection', width: 48 },
    { prop: 'sort', label: '显示顺序', width: 108, align: 'center', sortable: true },
    {
      prop: 'itemName',
      label: config.value.title,
      minWidth: 220,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.itemName}
          secondary={row.itemCode}
          icon={row.childCount ? 'ri:folder-3-line' : config.value.icon}
        />
      )
    },
    ...(isPermittedOperationItem.value
      ? [
          {
            prop: 'workCategoryName',
            label: '作业类别',
            minWidth: 190,
            showOverflowTooltip: true,
            formatter: (row: SmisQualificationCatalog) => row.workCategoryName || '—'
          } as ColumnOption<SmisQualificationCatalog>
        ]
      : []),
    {
      prop: 'parentName',
      label: isPermittedOperationItem.value ? '上级准操项目' : '上级节点',
      minWidth: 160,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.parentName || (isPermittedOperationItem.value ? '类别下一级项目' : '一级节点')
    },
    {
      prop: 'status',
      label: '启用状态',
      width: 108,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonEnabledStatus" value={row.status} display="tag" />
      )
    },
    { prop: 'remark', label: '备注', minWidth: 240, showOverflowTooltip: true },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
      formatter: (row) => formatTableDateTime(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 120,
      fixed: 'right',
      formatter: (row) => (
        <div class="qualification-catalog-page__actions">
          <ArtButtonTable
            permission={config.value.permissions.edit}
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            permission={config.value.permissions.delete}
            type="delete"
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    tree.loading = !tree.data.length
    tree.error = null
    try {
      const result = await fetchQualificationCatalogList(
        {
          ...params,
          ...buildSupabasePageRange(params),
          ...selectedCatalogFilters.value,
          catalogType: props.catalogType
        },
        { showErrorMessage: false }
      )
      if (options?.signal?.aborted) return { records: result.data, total: result.total }
      if (result.error) {
        throw new Error(`${config.value.title}加载失败，请重新加载`, { cause: result.error })
      }
      tree.data = result.tree
      tree.workCategories = result.workCategories
      tree.navigationData = result.navigationTree
      Object.assign(overview, result.overview)
      return { records: result.data, total: result.total }
    } catch (error) {
      if (!options?.signal?.aborted) tree.error = `${config.value.title}结构加载失败，请重试。`
      throw error
    } finally {
      if (!options?.signal?.aborted) tree.loading = false
    }
  }
  const handleDelete = async (row: SmisQualificationCatalog): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.itemName ?? '资质目录')
        }
      ],
      permission: config.value.permissions.delete,
      confirmMessage: `确定删除${config.value.title}“${row.itemName}”吗？`,
      remove: async () => {
        await deleteQualificationCatalog(props.catalogType, [row.id ?? ''])
      },
      onDeleted: async () => {
        await refresh()
      }
    })
  }
  const handleTreeSelect = (key: string): void => {
    tree.selectedKey = key
    void tableRef.value?.getData()
  }
  const refresh = async (): Promise<void> => {
    await tableRef.value?.getData()
  }
  onMounted(() => void userStore.ensureDictLoaded('commonEnabledStatus'))
</script>
