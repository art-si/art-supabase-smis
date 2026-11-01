<template>
  <div class="inspection-category-page business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      eyebrow="INSPECTION CATEGORY MASTER DATA"
      title="检验类别"
      description="按租户维护统一的检验类别编码、名称与启停状态，为设备检验和安全业务提供一致的分类口径。"
      icon="ri:filter-3-line"
      :tags="[
        { label: '租户级配置', type: 'primary', effect: 'plain' },
        { label: '统一分类口径', type: 'success', effect: 'light' },
        { label: '启停可控', type: 'info', effect: 'plain' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions>
        <BusinessTableWorkspaceActions :table="tableQueryRef" />
      </template>
    </BusinessWorkspaceHeader>

    <ArtTableQuery
      ref="tableQueryRef"
      v-model="table.searchQuery"
      :api-fn="fetchTableData"
      :search-items="table.searchItems"
      :columns-factory="columnsFactory"
      :header-actions="table.headerActions"
      header-actions-placement="workspace"
      :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无检验类别',
        emptyDescription: '可新增外部检验、内部检验等租户专属分类。'
      }"
      focusable
    />

    <InspectionCategoryDialog ref="dialogRef" @success="handleSaveSuccess" />
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </div>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { ElTag } from 'element-plus'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
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
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteInspectionCategories,
    fetchInspectionCategoryList,
    type SmisInspectionCategory,
    type SmisInspectionCategoryOverview,
    type SmisInspectionCategorySearchParams
  } from '@smis/api'
  import InspectionCategoryDialog, {
    type InspectionCategoryDialogOpenData
  } from './modules/inspection-category-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_inspection_category',
    '检验类别'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisInspectionCategory' })

  type TableParams = SmisInspectionCategorySearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface DialogExpose {
    handleOpen: (data: InspectionCategoryDialogOpenData) => Promise<void>
  }

  interface TableGroup {
    searchQuery: SmisInspectionCategorySearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
  }
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { getDictMap, isPlatformSuper, getUserInfo } = storeToRefs(userStore)
  const { effectiveTenantId, selectedTenant, revision, scopeLabel } = storeToRefs(tenantScopeStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const overview = reactive<SmisInspectionCategoryOverview>({
    total: 0,
    enabled: 0,
    disabled: 0,
    recentlyUpdated: 0
  })

  const statusOptions = computed(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '类别总数',
      value: overview.total,
      description: isPlatformSuper.value ? `${scopeLabel.value}配置` : '当前租户配置',
      icon: 'ri:stack-line'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可用于业务选择',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '已停用',
      value: overview.disabled,
      description: '保留历史口径',
      icon: 'ri:pause-circle-line',
      tone: 'warning'
    },
    {
      label: '近 30 日更新',
      value: overview.recentlyUpdated,
      description: '新增或调整记录',
      icon: 'ri:history-line'
    }
  ])

  const openDialog = (row?: SmisInspectionCategory): void => {
    const tenantId = row?.tenantId || effectiveTenantId.value

    void dialogRef.value?.handleOpen({
      row,
      tenantId,
      tenantName:
        row?.tenantName ||
        selectedTenant.value?.tenantName ||
        getUserInfo.value.tenant?.tenantName ||
        '当前租户'
    })
  }

  async function deleteRowsByTenant(rows: SmisInspectionCategory[]): Promise<void> {
    const idsByTenant = new Map<string, string[]>()
    rows.forEach((row) => {
      if (!row.id || !row.tenantId) return
      const ids = idsByTenant.get(row.tenantId) ?? []
      ids.push(row.id)
      idsByTenant.set(row.tenantId, ids)
    })

    await Promise.all(
      [...idsByTenant.entries()].map(([tenantId, ids]) => deleteInspectionCategories(ids, tenantId))
    )
  }

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisInspectionCategory:Add',
      type: 'add',
      label: '新增检验类别',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisInspectionCategory:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个检验类别吗？删除后无法恢复。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.categoryName ?? '检验类别')
          })),
          permission: 'SmisInspectionCategory:Delete',
          remove: async () => {
            await deleteRowsByTenant(selectedRows as SmisInspectionCategory[])
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
        props: { clearable: true, placeholder: '检验类别编码、名称或备注' }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'select',
        props: {
          options: statusOptions.value,
          clearable: true,
          placeholder: '全部状态'
        }
      }
    ]),
    headerActions
  })

  const columnsFactory = (): ColumnOption<SmisInspectionCategory>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 76 },
    {
      prop: 'categoryName',
      label: '检验类别名称',
      minWidth: 210,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell primary={row.categoryName} icon="ri:filter-3-line" />
      )
    },
    {
      prop: 'categoryCode',
      label: '检验类别编码',
      minWidth: 170,
      formatter: (row) => (
        <span title={row.categoryCode}>
          <ElTag type="primary" effect="light" size="small" round>
            {row.categoryCode}
          </ElTag>
        </span>
      )
    },
    ...(isPlatformSuper.value
      ? [
          {
            prop: 'tenantName',
            label: '所属租户',
            minWidth: 190,
            formatter: (row: SmisInspectionCategory) =>
              row.tenantName ? (
                <BusinessTableIdentityCell primary={row.tenantName} secondary={row.tenantCode} />
              ) : (
                '—'
              )
          }
        ]
      : []),
    {
      prop: 'status',
      label: '启用状态',
      width: 106,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonEnabledStatus" value={row.status} display="tag" />
      )
    },
    { prop: 'remark', label: '备注', minWidth: 280, showOverflowTooltip: true },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
      formatter: (row) => formatTableDateTime(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) => (
        <div class="inspection-category-page__actions">
          <ArtButtonTable
            type="edit"
            permission="SmisInspectionCategory:Edit"
            label="编辑检验类别"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisInspectionCategory:Delete"
            label="删除检验类别"
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchInspectionCategoryList({
      keyword: params.keyword,
      status: params.status,
      tenantId: effectiveTenantId.value,
      from,
      to
    })
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    return response
  }

  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }

  const handleDelete = async (row: SmisInspectionCategory): Promise<void> => {
    if (!row.id) return

    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.categoryName ?? '检验类别')
        }
      ],
      permission: 'SmisInspectionCategory:Delete',
      confirmMessage: `确定删除检验类别“${row.categoryName}”吗？删除后无法恢复。`,
      remove: async () => {
        await deleteInspectionCategories([row.id ?? ''], row.tenantId)
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }

  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('commonEnabledStatus'),
      tenantScopeStore.loadTenantOptions()
    ])
  })

  watch(revision, () => {
    const tableQuery = tableQueryRef.value
    tableQuery?.clearSelection()
    void tableQuery?.refreshContext()
  })
</script>

<style scoped lang="scss">
  .inspection-category-page {
    min-width: 0;

    :deep(.inspection-category-page__actions) {
      display: flex;
      align-items: center;
    }
  }
</style>
