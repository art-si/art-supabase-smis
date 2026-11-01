<template>
  <ArtPermissionGuard
    permission="SmisHazardousWasteWarehouseDefinition:View"
    resource-name="仓库定义"
  >
    <div class="business-workspace-page art-full-height flex min-h-0 min-w-0 flex-col gap-[14px]">
      <BusinessWorkspaceHeader
        eyebrow="HAZARDOUS WASTE STORAGE"
        title="仓库定义"
        description="统一维护危废库房、责任人员、行政区域与展示标识，为入库、出库和库存核验提供可信主数据。"
        icon="ri:archive-drawer-line"
        :tags="[
          { label: '花名册联动', type: 'primary', effect: 'plain' },
          { label: '区域字典', type: 'success', effect: 'light' },
          { label: '租户级隔离', type: 'info', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="min-h-0 min-w-0 flex-1"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无危废仓库',
          emptyDescription: '新增仓库并明确库管员、负责人及库房地址后，即可办理危废入出库。'
        }"
        focusable
      />
      <WarehouseDialog ref="dialogRef" @success="handleSaveSuccess" />
      <MasterDataDeleteGuard ref="deleteGuardRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteHazardousWasteWarehouses,
    fetchHazardousWasteWarehouseList,
    fetchHazardousWasteDocumentList,
    type SmisHazardousWasteDocument,
    type SmisHazardousWasteDocumentSearchParams,
    type SmisHazardousWasteWarehouse,
    type SmisHazardousWasteWarehouseOverview,
    type SmisHazardousWasteWarehouseSearchParams
  } from '@smis/api'
  import WarehouseDialog, { type WarehouseDialogOpenData } from './modules/warehouse-dialog.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisHazardousWasteWarehouseDefinition' })
  type TableParams = SmisHazardousWasteWarehouseSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: WarehouseDialogOpenData) => Promise<void>
  }

  const { confirmDelete } = useArtFeedback()
  const { deleteGuardRef, inspectDeleteReferences } = useRecordDeleteGuard(
    'smis_hazardous_waste_warehouse',
    '危废仓库',
    {
      smis_hazardous_waste_document: {
        canNavigate: () =>
          hasAnyAuth(['SmisHazardousWasteInbound:View', 'SmisHazardousWasteOutbound:View']),
        routeNames: ['SmisHazardousWasteInbound', 'SmisHazardousWasteOutbound'],
        resolveRouteName: async (record) => {
          for (const direction of ['inbound', 'outbound'] as const) {
            const name =
              direction === 'inbound' ? 'SmisHazardousWasteInbound' : 'SmisHazardousWasteOutbound'
            if (!hasAnyAuth([`${name}:View`])) continue
            const rows = await loadAllDocumentPages<
              SmisHazardousWasteDocument,
              SmisHazardousWasteDocumentSearchParams
            >(
              (params) =>
                fetchHazardousWasteDocumentList(direction, params, { showErrorMessage: false }),
              { documentNo: record.recordNo, warehouseId: record.resourceId }
            )
            if (rows.some((row) => row.id === record.targetId)) return name
          }
          return null
        }
      }
    }
  )
  const deleteBusy = ref(false)
  const { hasAnyAuth } = useAuth()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { isAllTenants, scopeLabel } = storeToRefs(useTenantScopeStore())
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<SmisHazardousWasteWarehouseSearchParams>({})
  const overview = reactive<SmisHazardousWasteWarehouseOverview>({
    total: 0,
    enabled: 0,
    managed: 0,
    regionCount: 0
  })
  const statusOptions = computed(() =>
    (getDictMap.value.commonEnabledDisabledStatus ?? []).map(toDictionaryOption)
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '仓库总数',
      value: overview.total,
      description: `${scopeLabel.value}危废库房`,
      icon: 'ri:archive-stack-line'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可办理入出库',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '责任到人',
      value: overview.managed,
      description: '库管与负责人齐备',
      icon: 'ri:user-star-line',
      tone: 'warning'
    },
    {
      label: '覆盖区域',
      value: overview.regionCount,
      description: '已关联行政区域',
      icon: 'ri:map-pin-range-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '仓库编号、名称、人员或地址' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
    }
  ])
  const exportColumns = [
    { key: 'warehouseCode', title: '仓库编号' },
    { key: 'warehouseName', title: '仓库名称' },
    { key: 'keeperEmployeeName', title: '库管员' },
    { key: 'responsibleEmployeeName', title: '负责人' },
    { key: 'address', title: '库房地址' },
    { key: 'statusLabel', title: '状态' },
    { key: 'sort', title: '排序' }
  ]
  const openDialog = (row?: SmisHazardousWasteWarehouse): void => {
    void dialogRef.value?.handleOpen({ row })
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisHazardousWasteWarehouseDefinition:Add',
      type: 'add',
      label: '新增仓库',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisHazardousWasteWarehouseDefinition:Export',
      type: 'export',
      exportFilename: '危废仓库定义',
      exportSheetName: '危废仓库',
      exportColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const exportQuery: SmisHazardousWasteWarehouseSearchParams = {
          ...(searchParams as SmisHazardousWasteWarehouseSearchParams),
          ids: selectedIds.map(String),
          purpose: 'export'
        }
        const rows = await loadAllDocumentPages(fetchHazardousWasteWarehouseList, exportQuery)
        await userStore.ensureDictLoaded('commonEnabledDisabledStatus')
        return {
          data: rows.map((row) => ({
            ...row,
            address: [...(row.regionPath || []), row.addressDetail].filter(Boolean).join(' / '),
            statusLabel: userStore.getDictLabelByValue('commonEnabledDisabledStatus', row.status)
          }))
        }
      }
    },
    {
      permission: 'SmisHazardousWasteWarehouseDefinition:Delete',
      type: 'delete',
      confirm: false,
      disabled: deleteBusy.value,
      onClick: async ({ selectedRows, api }) => {
        await removeWarehouses(
          selectedRows.map((row) => ({
            id: String(row.id),
            warehouseName: String(row.warehouseName),
            warehouseCode: String(row.warehouseCode)
          })),
          () => api.refreshRemove()
        )
      }
    }
  ])
  const columnsFactory = (): ColumnOption<SmisHazardousWasteWarehouse>[] => {
    const columns: ColumnOption<SmisHazardousWasteWarehouse>[] = [
      { type: 'selection', width: 48 },
      { prop: 'sort', label: '排序', width: 78, align: 'center', sortable: true },
      ...(isAllTenants.value
        ? [
            {
              prop: 'tenantName',
              label: '所属租户',
              minWidth: 160,
              showOverflowTooltip: true,
              formatter: (row: SmisHazardousWasteWarehouse) => row.tenantName || '—'
            } as ColumnOption<SmisHazardousWasteWarehouse>
          ]
        : []),
      {
        prop: 'warehouseName',
        label: '仓库',
        minWidth: 220,
        fixed: 'left',
        formatter: (row) => (
          <BusinessTableIdentityCell
            primary={row.warehouseName}
            secondary={row.warehouseCode}
            icon="ri:archive-drawer-line"
          />
        )
      },
      {
        prop: 'keeperEmployeeName',
        label: '库管员',
        minWidth: 145,
        showOverflowTooltip: true,
        formatter: (row) =>
          row.keeperEmployeeName ? (
            <BusinessTableIdentityCell
              primary={row.keeperEmployeeName}
              secondary={row.keeperEmployeeNo}
            />
          ) : (
            '未配置'
          )
      },
      {
        prop: 'responsibleEmployeeName',
        label: '负责人',
        minWidth: 145,
        showOverflowTooltip: true,
        formatter: (row) =>
          row.responsibleEmployeeName ? (
            <BusinessTableIdentityCell
              primary={row.responsibleEmployeeName}
              secondary={row.responsibleEmployeeNo}
            />
          ) : (
            '未配置'
          )
      },
      {
        prop: 'addressDetail',
        label: '库房地址',
        minWidth: 230,
        showOverflowTooltip: true,
        formatter: (row) =>
          [...(row.regionPath || []), row.addressDetail].filter(Boolean).join(' / ') || '—'
      },
      {
        prop: 'tagStyle',
        label: '标签样式',
        width: 130,
        align: 'center',
        formatter: (row) => (
          <ElTag type={row.tagStyle || 'info'} effect="light">
            <span style={{ color: row.textColor || undefined }}>{row.warehouseName}</span>
          </ElTag>
        )
      },
      {
        prop: 'status',
        label: '状态',
        width: 100,
        align: 'center',
        formatter: (row) => (
          <ArtDictDisplay dictCode="commonEnabledDisabledStatus" value={row.status} display="tag" />
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
          <BusinessTableRowActions>
            <ArtButtonTable
              type="edit"
              permission="SmisHazardousWasteWarehouseDefinition:Edit"
              onClick={() => openDialog(row)}
            />
            <ArtButtonTable
              type="delete"
              disabled={deleteBusy.value}
              permission="SmisHazardousWasteWarehouseDefinition:Delete"
              onClick={() => void handleDelete(row)}
            />
          </BusinessTableRowActions>
        )
      }
    ]
    return columns.filter(
      (column) =>
        column.prop !== 'operation' ||
        hasAnyAuth([
          'SmisHazardousWasteWarehouseDefinition:Edit',
          'SmisHazardousWasteWarehouseDefinition:Delete'
        ])
    )
  }
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const response = await fetchHazardousWasteWarehouseList(
      { ...params, ...buildSupabasePageRange(params) },
      { showErrorMessage: false }
    )
    if (response.error) {
      throw new Error('危废仓库列表加载失败，请重新加载', { cause: response.error })
    }
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    return { records: response.data, total: response.total }
  }
  const removeWarehouses = async (
    rows: Array<Pick<SmisHazardousWasteWarehouse, 'id' | 'warehouseName' | 'warehouseCode'>>,
    refresh: () => unknown | Promise<unknown>
  ): Promise<void> => {
    if (deleteBusy.value || !rows.length) return
    deleteBusy.value = true
    const resources = rows.map((row) => ({
      id: row.id,
      label: `${row.warehouseName} · ${row.warehouseCode}`
    }))
    try {
      if (await inspectDeleteReferences(resources)) return
      await confirmDelete(
        rows.length === 1
          ? `确定删除危废仓库“${rows[0].warehouseName}”吗？`
          : `确定删除选中的 ${rows.length} 个危废仓库吗？`
      )
      try {
        await deleteHazardousWasteWarehouses(rows.map((row) => row.id))
      } catch (cause) {
        if (await inspectDeleteReferences(resources)) return
        throw cause
      }
      ElMessage.success('危废仓库已删除')
      await refresh()
    } catch (cause) {
      if (cause !== 'cancel' && cause !== 'close') {
        ElMessage.error(getFriendlySupabaseErrorMessage(cause, '危废仓库删除失败，请重试'))
      }
    } finally {
      deleteBusy.value = false
    }
  }
  const handleDelete = (row: SmisHazardousWasteWarehouse): Promise<void> =>
    removeWarehouses([row], () => tableQueryRef.value?.refreshRemove())
  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }
  onMounted(() => void userStore.ensureDictLoaded('commonEnabledDisabledStatus'))
</script>
