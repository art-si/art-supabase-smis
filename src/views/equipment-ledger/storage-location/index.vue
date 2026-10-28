<template>
  <div class="storage-location-page business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      eyebrow="PHYSICAL LOCATION MASTER"
      title="存放位置"
      description="按厂区、车间和具体区域维护租户级位置树，为设备安装、责任分工和后续台账检索提供统一位置口径。"
      icon="ri:road-map-line"
      :tags="[
        { label: '租户级隔离', type: 'primary', effect: 'plain' },
        { label: '组织与花名册联动', type: 'success', effect: 'light' },
        { label: '树形位置', type: 'info', effect: 'plain' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions>
        <BusinessTableWorkspaceActions :table="tableQueryRef" />
      </template>
    </BusinessWorkspaceHeader>

    <div class="storage-location-page__workspace">
      <ArtWorkspaceSplitter
        primary-size="300px"
        primary-min="250px"
        primary-max="400px"
        :breakpoint="900"
        :stacked-primary-size="treeError || !tree.data.length ? 'auto' : '36vh'"
      >
        <template #primary>
          <StorageLocationNavigator
            :data="tree.data"
            :loading="treeLoading"
            :error="treeError"
            :selected-key="tree.selectedKey"
            :global-scope="isAllTenants"
            @select="handleTreeSelect"
            @refresh="handleTreeRefresh"
          />
        </template>

        <ArtTableQuery
          ref="tableQueryRef"
          v-model="table.searchQuery"
          class="storage-location-page__table"
          :api-fn="fetchTableData"
          :response-adapter="adaptStorageLocationResponse"
          :on-success="acceptStorageLocationResponse"
          :on-cache-hit="acceptStorageLocationResponse"
          :search-items="table.searchItems"
          :columns-factory="columnsFactory"
          :header-actions="table.headerActions"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            emptyText: tree.selectedKey === ALL_KEY ? '暂无存放位置' : '当前位置下暂无数据',
            emptyDescription:
              tree.selectedKey === ALL_KEY
                ? '请先新增一级位置，再逐步维护厂区、车间和具体区域。'
                : '可新增下级位置，或切换左侧节点查看其他区域。'
          }"
          focusable
          focus-scope-selector=".storage-location-page__workspace"
        />
      </ArtWorkspaceSplitter>
    </div>

    <StorageLocationDialog ref="dialogRef" @success="handleSaveSuccess" />
  </div>
</template>

<script setup lang="tsx">
  import { ElTag } from 'element-plus'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import type { ApiResponse } from '@/utils/table/table-cache'
  import { defaultResponseAdapter } from '@/utils/table/table-utils'
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
  import {
    deleteStorageLocations,
    fetchStorageLocationList,
    type SmisStorageLocation,
    type SmisStorageLocationOverview,
    type SmisStorageLocationSearchParams
  } from '@smis/api'
  import StorageLocationNavigator from './modules/storage-location-navigator.vue'
  import StorageLocationDialog, {
    type StorageLocationDialogOpenData
  } from './modules/storage-location-dialog.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisStorageLocation' })

  const ALL_KEY = 'all'
  type TableParams = SmisStorageLocationSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface DialogExpose {
    handleOpen: (data: StorageLocationDialogOpenData) => Promise<void>
  }

  interface TableGroup {
    searchQuery: SmisStorageLocationSearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
  }

  interface TreeGroup {
    data: SmisStorageLocation[]
    selectedKey: string
  }

  const { confirmDelete } = useArtFeedback()
  const userStore = useUserStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const { effectiveTenantId, isAllTenants, scopeLabel } = storeToRefs(useTenantScopeStore())
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const overview = shallowRef<SmisStorageLocationOverview | null>(null)
  const tree = reactive<TreeGroup>({
    data: [],
    selectedKey: ALL_KEY
  })
  const treeKnown = ref(false)
  const tableState = computed(() => tableQueryRef.value?.dataState)
  const treeLoading = computed(() => tableState.value?.loading.value ?? true)
  const treeError = computed(() =>
    tableState.value?.error.value
      ? '存放位置树加载失败，请稍后重试。'
      : !treeLoading.value && !treeKnown.value
        ? '位置层级暂不可用，请重新加载。'
        : null
  )
  const visibleOverview = computed(() =>
    tableState.value && !tableState.value.loading.value && !tableState.value.error.value
      ? overview.value
      : null
  )

  const statusOptions = computed(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )

  const selectedLocation = computed(() =>
    tree.selectedKey === ALL_KEY ? null : treeUtils.findNode(tree.data, tree.selectedKey)
  )

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '位置总数',
      value: visibleOverview.value?.total ?? '—',
      description: `${scopeLabel.value}位置节点`,
      icon: 'ri:map-pin-range-line'
    },
    {
      label: '已启用',
      value: visibleOverview.value?.enabled ?? '—',
      description: '可用于新增设备',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '一级位置',
      value: visibleOverview.value?.rootCount ?? '—',
      description: '位置树根节点',
      icon: 'ri:git-branch-line'
    },
    {
      label: '已配置负责人',
      value: visibleOverview.value?.managedCount ?? '—',
      description: '已明确位置责任人',
      icon: 'ri:user-star-line',
      tone: 'warning'
    }
  ])

  const openDialog = (row?: SmisStorageLocation): void => {
    const selected = selectedLocation.value
    const targetTenantId =
      row?.tenantId || effectiveTenantId.value || getUserInfo.value.tenantId || ''
    const presetParentId = !row && selected?.tenantId === targetTenantId ? selected?.id : undefined
    void dialogRef.value?.handleOpen({
      row,
      tenantId: targetTenantId,
      allTenants: isAllTenants.value,
      tree: tree.data,
      presetParentId
    })
  }

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisStorageLocation:Add',
      type: 'add',
      label: selectedLocation.value ? '新增下级位置' : '新增存放位置',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisStorageLocation:Delete',
      type: 'delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个存放位置吗？存在未选中的下级位置时将无法删除。`,
      onClick: async ({ selectedRows, api }) => {
        const ids = selectedRows
          .map((row) => row.id)
          .filter((id): id is string => typeof id === 'string')
        if (ids.includes(tree.selectedKey)) resetTreeSelection()
        await deleteStorageLocations(ids)
        await api.refreshRemove()
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
        props: { clearable: true, placeholder: '位置编码、名称、简称或详细位置' }
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

  const columnsFactory = (): ColumnOption<SmisStorageLocation>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 72 },
    ...(isAllTenants.value
      ? [
          {
            prop: 'tenant.tenantName',
            label: '所属租户',
            minWidth: 170,
            showOverflowTooltip: true,
            formatter: (row: SmisStorageLocation) => row.tenant?.tenantName || '—'
          } as ColumnOption<SmisStorageLocation>
        ]
      : []),
    {
      prop: 'locationName',
      label: '存放位置',
      minWidth: 210,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.locationName}
          secondary={row.locationShortName || '未设置简称'}
          icon={row.childCount ? 'ri:folder-line' : 'ri:map-pin-line'}
        />
      )
    },
    {
      prop: 'locationCode',
      label: '位置编码',
      minWidth: 160,
      formatter: (row) => (
        <span title={row.locationCode}>
          <ElTag type="primary" effect="light" size="small" round>
            {row.locationCode}
          </ElTag>
        </span>
      )
    },
    {
      prop: 'parentLocationName',
      label: '上级位置',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.parentLocationName || '一级位置'
    },
    {
      prop: 'organization',
      label: '归属部门',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => row.organization?.organizationName || '—'
    },
    {
      prop: 'responsible',
      label: '位置负责人',
      minWidth: 160,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.responsible ? (
          <BusinessTableIdentityCell
            primary={row.responsible.employeeName}
            secondary={row.responsible.employeeNo}
          />
        ) : (
          '未配置'
        )
    },
    {
      prop: 'detailLocation',
      label: '详细位置',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.detailLocation || '—'
    },
    {
      prop: 'status',
      label: '启用状态',
      width: 106,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonEnabledStatus" value={row.status} display="tag" />
      )
    },
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
        <div class="storage-location-page__actions">
          <ArtButtonTable
            type="edit"
            permission="SmisStorageLocation:Edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisStorageLocation:Delete"
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]

  const adaptStorageLocationResponse = (
    response: Awaited<ReturnType<typeof fetchStorageLocationList>>
  ) => {
    // 独立模块固定的旧主仓适配器尚不拒绝读取错误。
    if (response.error) throw response.error
    return {
      ...defaultResponseAdapter<SmisStorageLocation>(response),
      tree: response.tree,
      overview: response.overview
    }
  }
  const acceptStorageLocationResponse = (
    _rows: SmisStorageLocation[],
    response: ApiResponse<SmisStorageLocation> & {
      tree?: SmisStorageLocation[] | null
      overview?: SmisStorageLocationOverview | null
    }
  ): void => {
    overview.value = response.overview ?? null
    if (response.tree) tree.data = response.tree
    treeKnown.value = response.tree !== null && response.tree !== undefined
  }
  const fetchTableData = (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return fetchStorageLocationList(
      {
        keyword: params.keyword,
        status: params.status,
        ancestorId: params.ancestorId,
        from,
        to
      },
      { ...options, showErrorMessage: false }
    )
  }

  const resetTreeSelection = (): void => {
    tree.selectedKey = ALL_KEY
    table.searchQuery.ancestorId = undefined
  }

  const handleTreeSelect = (key: string): void => {
    tree.selectedKey = key
    table.searchQuery.ancestorId = key === ALL_KEY ? undefined : key
    void tableQueryRef.value?.getData()
  }

  const handleTreeRefresh = (): void => {
    void tableQueryRef.value?.refreshData()
  }

  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }

  const handleDelete = async (row: SmisStorageLocation): Promise<void> => {
    if (!row.id) return
    try {
      await confirmDelete(
        `确定删除存放位置“${row.locationName}”吗？存在下级位置或已被设备引用时将无法删除。`
      )
      if (tree.selectedKey === row.id) resetTreeSelection()
      await deleteStorageLocations([row.id])
      await tableQueryRef.value?.refreshRemove()
    } catch {
      /* 用户取消或业务校验未通过 */
    }
  }

  onMounted(async () => {
    await userStore.ensureDictLoaded('commonEnabledStatus')
  })
</script>

<style scoped lang="scss">
  .storage-location-page {
    gap: 12px;
    min-width: 0;

    &__workspace {
      flex: 1;
      width: 100%;
      min-height: 0;
    }

    &__table {
      min-width: 0;
      height: 100%;
    }

    :deep(.storage-location-page__actions) {
      display: flex;
      align-items: center;
    }

    @media (width <= 900px) {
      &__workspace {
        overflow: visible;
      }
    }
  }
</style>
