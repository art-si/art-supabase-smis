<template>
  <ArtPermissionGuard :permission="permissions.view" :resource-name="businessName">
    <div
      class="hazardous-document-page business-workspace-page art-full-height flex min-h-0 min-w-0 flex-col gap-[14px]"
    >
      <BusinessWorkspaceHeader
        :eyebrow="direction === 'inbound' ? 'HAZARDOUS WASTE RECEIPT' : 'HAZARDOUS WASTE DISPATCH'"
        :title="businessName"
        :description="
          direction === 'inbound'
            ? '登记危废入库仓库、经办人和批次明细；单据按月自动编号，审核通过后形成可用库存。'
            : '登记危废出库仓库、经办人和转移信息；审核时校验可用库存，避免超量出库。'
        "
        :icon="direction === 'inbound' ? 'ri:inbox-archive-line' : 'ri:send-plane-line'"
        :tags="[
          { label: '3 位月度流水', type: 'primary', effect: 'plain' },
          { label: '审核后计入库存', type: 'success', effect: 'light' },
          { label: '全程可追溯', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
        ><template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template
      ></BusinessWorkspaceHeader>
      <div class="hazardous-document-workspace flex min-h-0 min-w-0 flex-1 flex-col gap-[14px]">
        <MasterDeleteProcessingNotice :table="tableQueryRef" />
        <ArtTableQuery
          ref="tableQueryRef"
          v-model="searchQuery"
          class="min-h-0 min-w-0 flex-1"
          :api-fn="fetchData"
          :search-items="searchItems"
          :columns-factory="columnsFactory"
          :header-actions="headerActions"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 6, labelWidth: 78 }"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            emptyText: `暂无${businessName}单据`,
            emptyDescription: '可点击新增建立草稿，核对无误后提交审核。'
          }"
          focusable
          focus-scope-selector=".hazardous-document-workspace"
        />
      </div>
      <DocumentDialog ref="dialogRef" :direction="direction" @success="refresh" />
      <MasterDataDeleteGuard ref="deleteGuardRef" />
    </div>
  </ArtPermissionGuard>
</template>
<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import { replaceReactiveModel } from '@/utils/form/model'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import { sumBy } from 'lodash-es'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useMasterDataDeleteProcessingContext } from '@/hooks/core/useMasterDataDeleteProcessing'
  import MasterDeleteProcessingNotice from '@/components/business/master-delete-processing-notice/index.vue'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import { DeleteReferenceBlockedError } from '@/utils/supabase/delete-reference'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import type { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteHazardousWasteDocuments,
    fetchHazardousWasteDocumentList,
    fetchHazardousWasteWarehouseList,
    transitionHazardousWasteDocument,
    type SmisHazardousWasteDocument,
    type SmisHazardousWasteDocumentDirection,
    type SmisHazardousWasteDocumentOverview,
    type SmisHazardousWasteDocumentSearchParams,
    type SmisHazardousWasteWarehouse
  } from '@smis/api'
  import DocumentDialog, { type DocumentDialogOpenData } from './document-dialog.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  interface DocumentPermissions {
    view: string
    add: string
    edit: string
    delete: string
    export: string
    submit: string
    review: string
  }

  const props = defineProps<{
    direction: SmisHazardousWasteDocumentDirection
    permissions: DocumentPermissions
  }>()
  const direction = toRef(props, 'direction')
  const permissions = toRef(props, 'permissions')
  const businessName = computed(() => (direction.value === 'inbound' ? '危废入库' : '危废出库'))
  type TableParams = SmisHazardousWasteDocumentSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: DocumentDialogOpenData) => Promise<void>
  }
  const { confirmAction, confirmDelete, promptReason } = useArtFeedback()
  const { hasAnyAuth } = useAuth()
  const { deleteGuardRef, inspectDeleteReferences } = useRecordDeleteGuard(
    'smis_hazardous_waste_document',
    '危废单据'
  )
  const deleteBusy = ref(false)
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const deleteProcessing = useMasterDataDeleteProcessingContext()
  const route = useRoute()
  const isWarehouseReference = computed(
    () => route.query.resourceType === 'smis_hazardous_waste_warehouse'
  )
  const referenceQuery = (): SmisHazardousWasteDocumentSearchParams => ({
    documentNo: deleteProcessing.value.recordNo || undefined,
    warehouseId: isWarehouseReference.value
      ? deleteProcessing.value.resourceId || undefined
      : undefined
  })
  const searchQuery = ref<SmisHazardousWasteDocumentSearchParams>(referenceQuery())
  watch(
    () => [
      deleteProcessing.value.active,
      deleteProcessing.value.recordNo,
      deleteProcessing.value.resourceId,
      isWarehouseReference.value
    ],
    () => {
      replaceReactiveModel(searchQuery.value, referenceQuery())
      void tableQueryRef.value?.getData()
    }
  )
  const warehouses = ref<SmisHazardousWasteWarehouse[]>([])
  const overview = reactive<SmisHazardousWasteDocumentOverview>({
    total: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    quantity: 0
  })
  const statusOptions = computed(() =>
    (getDictMap.value.smisHazardousWasteDocumentStatus ?? []).map(toDictionaryOption)
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '单据总数',
      value: overview.total,
      description: '当前查询范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '待审核',
      value: overview.pending,
      description: '等待业务审核',
      icon: 'ri:time-line',
      tone: 'warning'
    },
    {
      label: '已通过',
      value: overview.approved,
      description: '已计入仓库库存',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '明细总量',
      value: overview.quantity,
      description: '按危废明细汇总',
      icon: 'ri:scales-3-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '单据编码',
      key: 'documentNo',
      type: 'input',
      props: { clearable: true, placeholder: '请输入单据编码' }
    },
    {
      label: direction.value === 'inbound' ? '入库时间' : '出库时间',
      key: 'dateRange',
      type: 'daterange',
      props: { valueFormat: 'YYYY-MM-DD', startPlaceholder: '开始日期', endPlaceholder: '结束日期' }
    },
    {
      label: '仓库',
      key: 'warehouseId',
      type: 'dataSelect',
      props: {
        mode: 'table',
        multiple: false,
        apiFn: (params: DataSelectFetchParams) =>
          fetchHazardousWasteWarehouseList(
            {
              ...buildSupabasePageRange({ current: params.page, size: params.pageSize }),
              keyword: params.keyword,
              status: 'enabled'
            },
            { showErrorMessage: false }
          ),
        selectedData: warehouses.value,
        rowKey: 'id',
        labelKey: 'warehouseName',
        descriptionKey: 'warehouseCode',
        columns: [
          { prop: 'warehouseCode', label: '仓库编号', width: 140 },
          { prop: 'warehouseName', label: '仓库名称', minWidth: 180 }
        ],
        title: '选择危废仓库',
        searchPlaceholder: '搜索仓库名称或编号',
        showPagination: true,
        clearable: true,
        placeholder: '全部仓库'
      }
    },
    {
      label: '经办人',
      key: 'handlerKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名或工号' }
    },
    {
      label: '单据状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
    }
  ])
  const editable = (row: SmisHazardousWasteDocument) => ['draft', 'rejected'].includes(row.status)
  const open = (row?: SmisHazardousWasteDocument) => void dialogRef.value?.handleOpen({ row })
  const refresh = async () => {
    await tableQueryRef.value?.getData()
  }

  const exportColumns = [
    { key: 'documentNo', title: '单据编码' },
    { key: 'operationDate', title: direction.value === 'inbound' ? '入库日期' : '出库日期' },
    { key: 'warehouseName', title: '仓库' },
    { key: 'handlerEmployeeName', title: '经办人' },
    { key: 'itemSummary', title: '危废明细' },
    { key: 'statusLabel', title: '单据状态' },
    { key: 'description', title: '说明' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    { permission: permissions.value.add, type: 'add', label: '新增', onClick: () => open() },
    {
      permission: permissions.value.edit,
      key: 'edit',
      label: '编辑',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) =>
        selectedRows.length !== 1 || !editable(selectedRows[0] as SmisHazardousWasteDocument),
      onClick: ({ selectedRows }) => open(selectedRows[0] as SmisHazardousWasteDocument)
    },
    {
      permission: permissions.value.delete,
      type: 'delete',
      confirm: false,
      disabled: ({ selectedRows }) =>
        deleteBusy.value ||
        selectedRows.some((row) => !editable(row as SmisHazardousWasteDocument)),
      onClick: async ({ selectedRows, api }) => {
        await removeDocuments(selectedRows as SmisHazardousWasteDocument[], () =>
          api.refreshRemove()
        )
      }
    },
    {
      permission: permissions.value.export,
      type: 'export',
      exportFilename: businessName.value,
      exportSheetName: businessName.value,
      exportColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const exportDirection = direction.value
        const query = searchParams as SmisHazardousWasteDocumentSearchParams
        const selected = new Set(selectedIds.map(String))
        const exportQuery: SmisHazardousWasteDocumentSearchParams = {
          ...query,
          dateRange: query.dateRange ? [...query.dateRange] : undefined,
          purpose: 'export'
        }
        const rows = await loadAllDocumentPages(
          (params) => fetchHazardousWasteDocumentList(exportDirection, params),
          exportQuery
        )
        await Promise.all([
          userStore.ensureDictLoaded('smisHazardousWasteDocumentStatus'),
          userStore.ensureDictLoaded('smisMaterialUnit')
        ])
        return {
          data: rows
            .filter((row) => !selected.size || selected.has(row.id))
            .map((row) => ({
              ...row,
              itemSummary: row.items
                .map(
                  (item) =>
                    `${item.wasteName} × ${item.quantity}${userStore.getDictLabelByValue('smisMaterialUnit', item.unit) || item.unit}`
                )
                .join('；'),
              statusLabel:
                statusOptions.value.find((item) => item.value === row.status)?.label || row.status
            }))
        }
      }
    }
  ])
  const handleSubmit = async (row: SmisHazardousWasteDocument) => {
    try {
      await confirmAction(`确认提交单据 ${row.documentNo} 进入审核？`, {
        title: '提交审核',
        confirmButtonText: '确认提交'
      })
      await transitionHazardousWasteDocument(direction.value, row.id, 'submit')
      await refresh()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close')
        notifyFriendlyError(error, '单据提交失败，请检查网络后重试')
    }
  }
  const handleReview = async (row: SmisHazardousWasteDocument, approved: boolean) => {
    try {
      let remark = ''
      if (!approved)
        remark = await promptReason(`请填写单据 ${row.documentNo} 的退回原因`, '审核退回', {
          maxLength: 500
        })
      else
        await confirmAction(
          `确认审核通过单据 ${row.documentNo}？${direction.value === 'outbound' ? '系统将同步校验可用库存。' : ''}`,
          { title: '审核确认', confirmButtonText: '审核通过' }
        )
      await transitionHazardousWasteDocument(
        direction.value,
        row.id,
        approved ? 'approve' : 'reject',
        remark
      )
      await refresh()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close')
        notifyFriendlyError(error, '单据审核失败，请检查网络后重试')
    }
  }
  const removeDocuments = async (
    rows: SmisHazardousWasteDocument[],
    refreshRows: () => unknown | Promise<unknown>
  ) => {
    if (deleteBusy.value || !rows.length) return
    if (!hasAnyAuth([permissions.value.delete]) || rows.some((row) => !editable(row))) {
      ElMessage.error('当前账号无权删除所选单据，或单据状态已变化，请刷新后重试')
      return
    }
    deleteBusy.value = true
    const operationDirection = direction.value
    const resources = rows.map((row) => ({ id: row.id, label: row.documentNo }))
    try {
      if (await inspectDeleteReferences(resources)) return
      await confirmDelete(
        rows.length === 1
          ? `确定删除单据“${rows[0].documentNo}”吗？`
          : `确定删除选中的 ${rows.length} 张草稿或退回单据吗？`
      )
      try {
        await deleteHazardousWasteDocuments(
          operationDirection,
          rows.map((row) => row.id)
        )
      } catch (error) {
        // 共享响应层已打开引用检查时，由其完成约束级重查，避免重复弹窗。
        if (error instanceof DeleteReferenceBlockedError) return
        if (await inspectDeleteReferences(resources)) return
        throw error
      }
      ElMessage.success('危废单据已删除')
      await refreshRows()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close')
        notifyFriendlyError(error, '危废单据删除失败，请检查网络后重试')
    } finally {
      deleteBusy.value = false
    }
  }
  const handleDelete = (row: SmisHazardousWasteDocument) =>
    removeDocuments([row], () => tableQueryRef.value?.refreshRemove())
  const columnsFactory = (): ColumnOption<SmisHazardousWasteDocument>[] => {
    const columns: ColumnOption<SmisHazardousWasteDocument>[] = [
      { type: 'selection', width: 48 },
      {
        prop: 'documentNo',
        label: '单据编码',
        width: 160,
        fixed: 'left',
        formatter: (row) => (
          <strong class="hazardous-document-page__number">{row.documentNo}</strong>
        )
      },
      {
        prop: 'operationDate',
        label: direction.value === 'inbound' ? '入库日期' : '出库日期',
        width: 116,
        align: 'center'
      },
      { prop: 'warehouseName', label: '仓库', minWidth: 150, showOverflowTooltip: true },
      {
        prop: 'handlerEmployeeName',
        label: '经办人',
        minWidth: 130,
        formatter: (row) => (
          <BusinessTableIdentityCell
            primary={row.handlerEmployeeName}
            secondary={row.handlerEmployeeNo}
          />
        )
      },
      {
        prop: 'items',
        label: '危废明细',
        minWidth: 280,
        showOverflowTooltip: true,
        formatter: (row) =>
          row.items
            .map(
              (item) =>
                `${item.wasteName} × ${item.quantity}${userStore.getDictLabelByValue('smisMaterialUnit', item.unit) || item.unit}`
            )
            .join('；')
      },
      {
        prop: 'status',
        label: '单据状态',
        width: 106,
        align: 'center',
        formatter: (row) => (
          <ArtDictDisplay
            dictCode="smisHazardousWasteDocumentStatus"
            value={row.status}
            display="tag"
          />
        )
      },
      {
        prop: 'description',
        label: '说明',
        minWidth: 160,
        showOverflowTooltip: true,
        formatter: (row) => row.description || '—'
      },
      {
        prop: 'createTime',
        label: '创建时间',
        width: 164,
        formatter: (row) => formatTableDateTime(row.createTime)
      },
      {
        prop: 'operation',
        label: '操作',
        width: 160,
        fixed: 'right',
        formatter: (row) => (
          <BusinessTableRowActions>
            {editable(row) && (
              <ArtButtonTable
                permission={permissions.value.submit}
                type="sign"
                icon="ri:send-plane-line"
                label="提交"
                onClick={() => void handleSubmit(row)}
              />
            )}
            {row.status === 'pending' && (
              <ArtButtonTable
                permission={permissions.value.review}
                type="sign"
                icon="ri:checkbox-circle-line"
                label="通过"
                onClick={() => void handleReview(row, true)}
              />
            )}
            <ArtButtonMore
              list={[
                ...(editable(row)
                  ? [
                      {
                        key: 'edit',
                        label: '编辑',
                        icon: 'ri:edit-line',
                        auth: permissions.value.edit
                      },
                      {
                        key: 'delete',
                        label: '删除',
                        icon: 'ri:delete-bin-line',
                        auth: permissions.value.delete,
                        color: 'var(--el-color-danger)'
                      }
                    ]
                  : []),
                ...(row.status === 'pending'
                  ? [
                      {
                        key: 'reject',
                        label: '审核退回',
                        icon: 'ri:close-circle-line',
                        auth: permissions.value.review,
                        color: 'var(--el-color-danger)'
                      }
                    ]
                  : [])
              ]}
              onClick={(item: ButtonMoreItem) => {
                if (item.key === 'edit') open(row)
                if (item.key === 'delete') void handleDelete(row)
                if (item.key === 'reject') void handleReview(row, false)
              }}
            />
          </BusinessTableRowActions>
        )
      }
    ]
    return columns.filter(
      (column) =>
        column.prop !== 'operation' ||
        hasAnyAuth([
          permissions.value.edit,
          permissions.value.delete,
          permissions.value.submit,
          permissions.value.review
        ])
    )
  }
  const fetchData = async (params: TableParams, options?: TableRequestOptions) => {
    const reference = deleteProcessing.value
    if (reference.active && reference.recordId && reference.recordNo && reference.resourceId) {
      const referenceDirection = direction.value
      const rows = await loadAllDocumentPages<
        SmisHazardousWasteDocument,
        SmisHazardousWasteDocumentSearchParams
      >(
        (query) =>
          fetchHazardousWasteDocumentList(referenceDirection, query, { showErrorMessage: false }),
        referenceQuery()
      )
      const records = rows.filter(
        (row) =>
          row.id === reference.recordId &&
          (isWarehouseReference.value
            ? row.warehouseId === reference.resourceId
            : row.items.some((item) => item.catalogId === reference.resourceId))
      )
      if (!options?.signal?.aborted) {
        Object.assign(overview, {
          total: records.length,
          draft: records.filter((row) => row.status === 'draft').length,
          pending: records.filter((row) => row.status === 'pending').length,
          approved: records.filter((row) => row.status === 'approved').length,
          rejected: records.filter((row) => row.status === 'rejected').length,
          quantity: sumBy(records, (row) => sumBy(row.items, (item) => item.quantity))
        })
      }
      return { records, total: records.length }
    }
    const result = await fetchHazardousWasteDocumentList(
      direction.value,
      { ...params, ...buildSupabasePageRange(params) },
      { showErrorMessage: false }
    )
    if (result.error) {
      throw new Error(`${businessName.value}列表加载失败，请重新加载`, { cause: result.error })
    }
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }
  onMounted(async () => {
    const [result] = await Promise.all([
      searchQuery.value.warehouseId
        ? fetchHazardousWasteWarehouseList(
            { ids: [searchQuery.value.warehouseId] },
            { showErrorMessage: false }
          )
        : Promise.resolve({ data: [] }),
      userStore.ensureDictLoaded('smisHazardousWasteDocumentStatus'),
      userStore.ensureDictLoaded('smisMaterialUnit')
    ])
    warehouses.value = result.data
  })
</script>
<style scoped lang="scss">
  .hazardous-document-page {
    :deep(.hazardous-document-page__number) {
      font-variant-numeric: tabular-nums;
      color: var(--theme-color);
    }
  }
</style>
