<template>
  <ArtPermissionGuard permission="SmisToolIssuanceRecord:View">
    <div class="tool-issuance-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="TOOL FULFILLMENT"
        title="工器具发放记录"
        description="统一维护领用人、发放仓库、发放人和物料数量；草稿核对完成后发放过账并形成可打印工器具发放单。"
        icon="ri:archive-drawer-line"
        :tags="[
          { label: '4 位月度流水', type: 'primary', effect: 'plain' },
          { label: '同一领用人批量过账', type: 'success', effect: 'light' },
          { label: '发放快照可追溯', type: 'info', effect: 'plain' }
        ]"
        :metrics="deleteReference.active ? [] : metrics"
      >
        <template #actions>
          <BusinessTableWorkspaceActions :table="tableQueryRef" />
        </template>
      </BusinessWorkspaceHeader>

      <MasterDeleteProcessingNotice :table="tableQueryRef" />

      <ElAlert
        v-if="referenceError"
        :title="referenceError"
        type="error"
        show-icon
        :closable="false"
      />

      <ArtTableQuery
        ref="tableQueryRef"
        :model-value="searchQuery"
        @update:model-value="replaceReactiveModel(searchQuery, $event)"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 76 }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无工器具发放记录',
          emptyDescription: '可新增草稿，或从个人领用页面选择同一领用人的明细下推发放。'
        }"
        focusable
      />

      <IssuanceRecordDialog ref="recordDialogRef" @success="refreshData" />
      <IssuanceStatisticsDialog ref="statisticsDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { useMasterDataDeleteProcessingContext } from '@/hooks/core/useMasterDataDeleteProcessing'
  import MasterDeleteProcessingNotice from '@/components/business/master-delete-processing-notice/index.vue'
  import { createTenantScopeReadGuard } from '@/utils/tenant-scope-context'
  import { fetchIssuanceReference } from '../../shared/issuance-reference'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { withSupabaseTableRange } from '@/utils/supabase/pagination'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import {
    createIssuanceImportLookup,
    readIssuanceImportRows,
    resolveIssuanceImportRows
  } from '../../issuance-import'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import type { BusinessWorkspaceMetric } from '@/components/business/business-workspace-header/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import type { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext,
    ArtTableQueryExcelColumn
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types/component'
  import { exportExcel } from '@/utils/file'
  import { printIssuanceRecord } from '../../issuance-print'
  import {
    deleteToolIssuanceRecords,
    fetchToolIssuanceRecordList,
    fetchToolScopeOptions,
    postToolIssuanceRecord,
    saveToolIssuanceRecord,
    type SmisToolIssuanceRecord,
    type SmisToolIssuanceRecordOverview,
    type SmisToolIssuanceRecordSearchParams,
    type SmisToolScopeOption
  } from '@smis/api'
  import IssuanceRecordDialog from './modules/issuance-record-dialog.vue'
  import IssuanceStatisticsDialog from './modules/issuance-statistics-dialog.vue'

  defineOptions({ name: 'SmisToolIssuanceRecord' })

  type TableParams = SmisToolIssuanceRecordSearchParams & {
    current?: number
    size?: number
    page?: number
    pageSize?: number
  }

  interface RecordDialogExpose {
    handleOpen: (data: {
      mode: 'add' | 'edit' | 'copy'
      row?: SmisToolIssuanceRecord
    }) => Promise<void>
  }

  interface StatisticsDialogExpose {
    handleOpen: () => Promise<void>
  }

  const tableQueryRef = ref<ArtTableQueryExpose>()
  const deleteReference = useMasterDataDeleteProcessingContext()
  const userStore = useUserStore()
  const { defaultWriteTenantId } = useTenantScopeFormPolicy()
  const { confirmAction } = useArtFeedback()
  const recordDialogRef = ref<RecordDialogExpose>()
  const statisticsDialogRef = ref<StatisticsDialogExpose>()
  const searchQuery = reactive<SmisToolIssuanceRecordSearchParams>({})
  const referenceError = ref('')
  watch(
    () => [
      deleteReference.value.active,
      deleteReference.value.recordId,
      deleteReference.value.recordNo
    ],
    ([active, recordId, recordNo]) => {
      referenceError.value = ''
      if (!active) {
        replaceReactiveModel(searchQuery, {})
        void tableQueryRef.value?.getData()
        return
      }
      if (!recordId || !recordNo) return
      replaceReactiveModel(searchQuery, { keyword: recordNo })
      void tableQueryRef.value?.getData()
    },
    { immediate: true }
  )
  const organizationOptions = ref<SmisToolScopeOption[]>([])
  const overview = reactive<SmisToolIssuanceRecordOverview>({
    total: 0,
    draft: 0,
    posted: 0,
    today: 0,
    quantity: 0
  })

  const statusOptions = useDictionaryOptions('commonIssuancePostingStatus')
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '发放单据',
      value: overview.total,
      description: '当前查询范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '待过账草稿',
      value: overview.draft,
      description: '需核对后发放',
      icon: 'ri:draft-line',
      tone: 'warning'
    },
    {
      label: '今日发放',
      value: overview.today,
      description: '已登记单据',
      icon: 'ri:calendar-check-line',
      tone: 'success'
    },
    {
      label: '工器具总量',
      value: overview.quantity,
      description: '按发放明细合计',
      icon: 'ri:archive-stack-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '领用时间',
      key: 'dateRange',
      type: 'daterange',
      props: { valueFormat: 'YYYY-MM-DD', startPlaceholder: '开始日期', endPlaceholder: '结束日期' }
    },
    {
      label: '组织名称',
      key: 'organizationId',
      type: 'treeSelect',
      props: {
        data: organizationOptions.value,
        clearable: true,
        checkStrictly: true,
        nodeKey: 'id',
        props: { label: 'name', value: 'id', children: 'children' },
        placeholder: '全部公司或部门'
      }
    },
    {
      label: '单据 / 人员',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '单据号、领用人或仓库' }
    },
    {
      label: '单据状态',
      key: 'status',
      type: 'select',
      options: statusOptions,
      props: { clearable: true, placeholder: '全部状态' }
    }
  ])

  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'employeeNo', title: '领用人工号', required: true },
    { key: 'warehouseCode', title: '发放仓库编码', required: true },
    { key: 'issuerEmployeeNo', title: '发放人工号', required: true },
    { key: 'materialCode', title: '工器具编码', required: true },
    { key: 'issueQuantity', title: '发放数量', required: true },
    { key: 'issueDate', title: '发放日期', required: true },
    { key: 'remark', title: '备注' }
  ]

  const refreshData = async (): Promise<void> => {
    await tableQueryRef.value?.getData()
  }

  const openDialog = (mode: 'add' | 'edit' | 'copy', row?: SmisToolIssuanceRecord): void => {
    void recordDialogRef.value?.handleOpen({ mode, row })
  }

  const importRows = async (rows: Array<Record<string, unknown>>): Promise<void> => {
    const targetTenantId = defaultWriteTenantId.value
    if (!targetTenantId) throw new Error('无法确定导入目标租户，请刷新后重试')
    const resolveReferences = createIssuanceImportLookup(targetTenantId, 'tool')
    const resolvedRows = await resolveIssuanceImportRows(
      readIssuanceImportRows(rows),
      resolveReferences
    )
    for (const row of resolvedRows) {
      await saveToolIssuanceRecord({
        employeeId: row.employee.id,
        warehouseId: String(row.warehouse.id),
        issuerEmployeeId: row.issuer.id,
        issueDate: row.issueDate,
        remark: row.remark,
        items: [{ materialId: String(row.material.id), issueQuantity: row.issueQuantity }]
      })
    }
    await refreshData()
  }

  const downloadTemplate = async (): Promise<void> => {
    await exportExcel({
      filename: '工器具发放记录导入模板',
      sheetName: '发放记录',
      columns: excelColumns,
      data: [
        {
          employeeNo: '请填写员工花名册工号',
          warehouseCode: '请填写启用仓库编码',
          issuerEmployeeNo: '请填写发放人员工号',
          materialCode: '请填写工器具物料编码',
          issueQuantity: 1,
          issueDate: dayjs().format('YYYY-MM-DD'),
          remark: '可选'
        }
      ]
    })
  }

  const printRecord = (row: SmisToolIssuanceRecord): void => {
    printIssuanceRecord(
      row,
      '工器具',
      (value) => userStore.getDictLabelByValue('smisMaterialUnit', value) || value
    )
  }

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisToolIssuanceRecord:Add',
      type: 'add',
      label: '新增',
      onClick: () => openDialog('add')
    },
    {
      permission: 'SmisToolIssuanceRecord:Copy',
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedCount }) => selectedCount !== 1,
      onClick: ({ selectedRows }) => openDialog('copy', selectedRows[0] as SmisToolIssuanceRecord)
    },
    {
      permission: 'SmisToolIssuanceRecord:Edit',
      key: 'edit',
      label: '编辑',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) =>
        selectedRows.length !== 1 || (selectedRows[0] as SmisToolIssuanceRecord).status !== 'draft',
      onClick: ({ selectedRows }) => openDialog('edit', selectedRows[0] as SmisToolIssuanceRecord)
    },
    {
      permission: 'SmisToolIssuanceRecord:Delete',
      type: 'delete',
      disabled: ({ selectedRows }) =>
        selectedRows.some((row) => (row as SmisToolIssuanceRecord).status !== 'draft'),
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条草稿吗？删除后无法恢复。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteToolIssuanceRecords(selectedRows.map((row) => String(row.id)))
        await api.refreshRemove()
      }
    },
    {
      permission: 'SmisToolIssuanceRecord:Issue',
      key: 'issue',
      label: '发放',
      icon: 'ri:send-plane-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) =>
        selectedRows.length !== 1 || (selectedRows[0] as SmisToolIssuanceRecord).status !== 'draft',
      confirm: true,
      content: '确认仓库、发放人和数量无误后执行发放过账？',
      onClick: async ({ selectedRows, api }) => {
        await postToolIssuanceRecord(String(selectedRows[0].id))
        await api.refreshUpdate()
      }
    },
    {
      permission: 'SmisToolIssuanceRecord:Import',
      type: 'import',
      label: '导入',
      importColumns: excelColumns,
      importApi: importRows,
      onImportError: (error) => {
        notifyFriendlyError(error, '导入失败，请检查模板内容')
      }
    },
    {
      permission: 'SmisToolIssuanceRecord:DownloadTemplate',
      key: 'template',
      label: '下载导入模板',
      icon: 'ri:download-2-line',
      onClick: downloadTemplate
    },
    {
      permission: 'SmisToolIssuanceRecord:Export',
      type: 'export',
      label: '导出',
      exportFilename: '工器具发放记录',
      exportSheetName: '发放记录',
      exportColumns: [
        { key: 'issuanceNo', title: '单据编号' },
        { key: 'employeeNo', title: '领用人工号' },
        { key: 'employeeName', title: '领用人' },
        { key: 'organizationName', title: '所属组织' },
        { key: 'warehouseName', title: '发放仓库' },
        { key: 'issuerName', title: '发放人' },
        { key: 'issueDate', title: '发放日期' },
        { key: 'status', title: '状态' },
        { key: 'itemsText', title: '发放明细' },
        { key: 'remark', title: '备注' }
      ],
      exportApi: async ({ maxRows }) => ({
        data: (
          await fetchToolIssuanceRecordList({
            ...searchQuery,
            purpose: 'export',
            from: 0,
            to: maxRows - 1
          })
        ).data.map((row) => ({
          ...row,
          itemsText: row.items
            .map(
              (item) =>
                `${item.materialName} ${item.issueQuantity}${userStore.getDictLabelByValue('smisMaterialUnit', item.unit) || item.unit}`
            )
            .join('；')
        }))
      })
    },
    {
      permission: 'SmisToolIssuanceRecord:Statistics',
      key: 'statistics',
      label: '统计分析',
      icon: 'ri:bar-chart-box-line',
      onClick: () => statisticsDialogRef.value?.handleOpen()
    },
    {
      permission: 'SmisToolIssuanceRecord:Print',
      key: 'print',
      label: '打印工器具发放单',
      icon: 'ri:printer-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) => printRecord(selectedRows[0] as SmisToolIssuanceRecord)
    }
  ])

  const columnsFactory = (): ColumnOption<SmisToolIssuanceRecord>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'issuanceNo',
      label: '单据编号',
      width: 150,
      fixed: 'left',
      formatter: (row) => <strong class="document-no">{row.issuanceNo}</strong>
    },
    { prop: 'employeeName', label: '领用人', width: 120, showOverflowTooltip: true },
    { prop: 'employeeNo', label: '员工工号', width: 130, showOverflowTooltip: true },
    { prop: 'positionName', label: '领用人岗位', minWidth: 150, showOverflowTooltip: true },
    { prop: 'organizationName', label: '所属组织', minWidth: 180, showOverflowTooltip: true },
    { prop: 'warehouseName', label: '发放仓库', minWidth: 160, showOverflowTooltip: true },
    { prop: 'issuerName', label: '发放人', width: 120, showOverflowTooltip: true },
    { prop: 'issueDate', label: '发放日期', width: 116, align: 'center' },
    {
      prop: 'items',
      label: '发放明细',
      minWidth: 230,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.items
          .map(
            (item) =>
              `${item.materialName} × ${item.issueQuantity}${userStore.getDictLabelByValue('smisMaterialUnit', item.unit) || item.unit}`
          )
          .join('；')
    },
    {
      prop: 'status',
      label: '状态',
      width: 108,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonIssuancePostingStatus" value={row.status} display="tag" />
      )
    },
    { prop: 'remark', label: '备注', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 210,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            permission="SmisToolIssuanceRecord:Issue"
            type="sign"
            icon="ri:send-plane-line"
            label="发放过账"
            disabled={row.status !== 'draft'}
            onClick={async () => {
              await confirmAction('确认执行发放过账？', {
                title: '发放确认',
                confirmButtonText: '确认发放'
              })
              await postToolIssuanceRecord(row.id)
              await refreshData()
            }}
          />
          <ArtButtonTable
            permission="SmisToolIssuanceRecord:Edit"
            type="edit"
            disabled={row.status !== 'draft'}
            onClick={() => openDialog('edit', row)}
          />
          <ArtButtonMore
            list={[
              {
                key: 'copy',
                label: '复制并新增',
                icon: 'ri:file-copy-line',
                auth: 'SmisToolIssuanceRecord:Copy'
              },
              {
                key: 'print',
                label: '打印工器具发放单',
                icon: 'ri:printer-line',
                auth: 'SmisToolIssuanceRecord:Print'
              }
            ]}
            onClick={(item: ButtonMoreItem) => {
              if (item.key === 'copy') openDialog('copy', row)
              if (item.key === 'print') printRecord(row)
            }}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const reference = deleteReference.value
    if (reference.active) {
      const isCurrentReference = () =>
        !options?.signal?.aborted &&
        deleteReference.value.recordId === reference.recordId &&
        deleteReference.value.recordNo === reference.recordNo
      try {
        const result = await fetchIssuanceReference(
          fetchToolIssuanceRecordList,
          reference,
          '工器具发放记录',
          createTenantScopeReadGuard()
        )
        if (isCurrentReference()) {
          Object.assign(overview, result.overview)
          referenceError.value = ''
        }
        return { records: [result.record], total: 1 }
      } catch (error) {
        if (isCurrentReference()) {
          referenceError.value = '关联工器具发放记录定位失败，请返回存放位置重新检查引用。'
        }
        throw error
      }
    }
    referenceError.value = ''
    const result = await fetchToolIssuanceRecordList(withSupabaseTableRange(params))
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }

  onMounted(async () => {
    const [organizations] = await Promise.all([
      fetchToolScopeOptions('organization'),
      userStore.ensureDictLoaded('smisMaterialUnit'),
      userStore.ensureDictLoaded('commonIssuancePostingStatus')
    ])
    organizationOptions.value = organizations.data
  })
</script>

<style scoped lang="scss">
  .tool-issuance-page {
    min-width: 0;

    :deep(.document-no) {
      font-variant-numeric: tabular-nums;
      color: var(--theme-color);
    }
  }
</style>
