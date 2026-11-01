<template>
  <ArtPermissionGuard permission="SmisToolRequisitionReturn:View">
    <div class="tool-return-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="TOOL RETURN"
        title="工器具领用归还"
        description="从已发放明细发起归还，保留源单据链路；草稿提交后进入审批，审批通过完成归还过账。"
        icon="ri:arrow-go-back-line"
        :tags="[
          { label: '4 位月度流水', type: 'primary', effect: 'plain' },
          { label: '同一领用人多选', type: 'success', effect: 'light' },
          { label: '审批流驱动过账', type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions>
          <BusinessTableWorkspaceActions :table="tableRef" />
        </template>
      </BusinessWorkspaceHeader>

      <div class="tool-return-page__notice" role="note">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:information-line" /></span>
        <p>
          <strong>归还规则</strong>
          每张归还单仅包含同一领用人的工器具；可跨源发放单选择，系统按明细锁定并校验剩余可归还数量。
        </p>
      </div>

      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="tool-return-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 76, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无工器具归还单',
          emptyDescription: '点击“归还”从已发放记录中选择同一领用人的工器具。'
        }"
        focusable
      />

      <ToolReturnDialog ref="dialogRef" @success="refreshData" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { withSupabaseTableRange } from '@/utils/supabase/pagination'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import type { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import type { ColumnOption } from '@/types'
  import {
    deleteToolReturns,
    fetchToolReturnList,
    submitToolReturn,
    type SmisToolReturn,
    type SmisToolReturnOverview,
    type SmisToolReturnSearchParams
  } from '@smis/api'
  import ToolReturnDialog, { type ToolReturnDialogOpenData } from './modules/tool-return-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('smis_tool_return', '工器具归还单')

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisToolRequisitionReturn' })

  type TableParams = SmisToolReturnSearchParams & {
    current?: number
    size?: number
    page?: number
    pageSize?: number
  }
  interface DialogExpose {
    handleOpen: (data: ToolReturnDialogOpenData) => Promise<void>
  }

  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<SmisToolReturnSearchParams>({})
  const { confirmAction } = useArtFeedback()
  const userStore = useUserStore()
  const overview = reactive<SmisToolReturnOverview>({
    total: 0,
    draft: 0,
    pendingApproval: 0,
    approved: 0,
    rejected: 0
  })

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '归还单据',
      value: overview.total,
      description: '当前查询范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '待提交',
      value: overview.draft,
      description: '草稿与退回单据',
      icon: 'ri:draft-line',
      tone: 'warning'
    },
    {
      label: '审批中',
      value: overview.pendingApproval,
      description: '等待审批处理',
      icon: 'ri:flow-chart',
      tone: 'primary'
    },
    {
      label: '已完成',
      value: overview.approved,
      description: '审批通过并过账',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const statusOptions = useDictionaryOptions('smisToolReturnStatus')
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '归还日期',
      key: 'dateRange',
      type: 'daterange',
      props: {
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        clearable: true
      }
    },
    {
      label: '归还信息',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '归还单号、源单号、领用人或工器具' }
    },
    {
      label: '归还状态',
      key: 'status',
      type: 'select',
      options: statusOptions,
      props: { clearable: true, placeholder: '全部状态' }
    }
  ])

  const refreshData = async (): Promise<void> => {
    await tableRef.value?.getData()
  }
  const openDialog = (mode: ToolReturnDialogOpenData['mode'], row?: SmisToolReturn): void => {
    void dialogRef.value?.handleOpen({ mode, row })
  }
  const editable = (row: SmisToolReturn): boolean =>
    row.status === 'draft' || row.status === 'rejected'
  const handleDelete = async (rows: SmisToolReturn[]): Promise<void> => {
    if (!rows.length) return
    if (rows.some((row) => !editable(row))) {
      ElMessage.warning('仅草稿或已退回的归还单可以删除')
      return
    }

    await deleteRecords({
      resources: rows.map((row) => ({
        id: String(row.id ?? ''),
        label: String(row.returnNo ?? '工器具归还单')
      })),
      permission: 'SmisToolRequisitionReturn:Delete',
      confirmMessage: `确定删除选中的 ${rows.length} 张归还单吗？删除后无法恢复。`,
      remove: async () => {
        await deleteToolReturns(rows.map((row) => row.id))
      },
      onDeleted: async () => {
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const handleSubmit = async (row: SmisToolReturn): Promise<void> => {
    if (!editable(row)) {
      ElMessage.warning('仅草稿或已退回的归还单可以提交审批')
      return
    }
    await confirmAction(`确认提交归还单 ${row.returnNo} 进入审批？`, {
      title: '提交归还审批',
      confirmButtonText: '确认提交'
    })
    await submitToolReturn(row.id)
    await refreshData()
  }
  const itemSummary = (row: SmisToolReturn): string =>
    row.items.map((item) => `${item.materialName} × ${item.returnQuantity}${item.unit}`).join('；')

  const columnsFactory = (): ColumnOption<SmisToolReturn>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'returnNo',
      label: '归还单号',
      width: 158,
      fixed: 'left',
      formatter: (row) => <strong class="document-no">{row.returnNo}</strong>
    },
    { prop: 'sourceDocumentNo', label: '源单据号', minWidth: 190, showOverflowTooltip: true },
    { prop: 'employeeName', label: '归还人', width: 116, showOverflowTooltip: true },
    { prop: 'employeeNo', label: '员工工号', width: 126, showOverflowTooltip: true },
    { prop: 'positionName', label: '岗位', minWidth: 140, showOverflowTooltip: true },
    { prop: 'organizationName', label: '所属部门', minWidth: 170, showOverflowTooltip: true },
    { prop: 'returnDate', label: '归还日期', width: 116, align: 'center' },
    {
      prop: 'items',
      label: '归还明细',
      minWidth: 240,
      showOverflowTooltip: true,
      formatter: itemSummary
    },
    {
      prop: 'status',
      label: '状态',
      width: 112,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisToolReturnStatus" value={row.status} display="tag" />
      )
    },
    {
      prop: 'submittedAt',
      label: '提交时间',
      width: 168,
      formatter: (row) => formatTableDateTime(row.submittedAt)
    },
    { prop: 'rejectionReason', label: '退回原因', minWidth: 170, showOverflowTooltip: true },
    { prop: 'remark', label: '备注', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 168,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="edit"
            permission="SmisToolRequisitionReturn:Edit"
            disabled={!editable(row)}
            onClick={() => openDialog('edit', row)}
          />
          <ArtButtonMore
            list={[
              {
                key: 'submit',
                label: '提交审批',
                icon: 'ri:send-plane-line',
                auth: 'SmisToolRequisitionReturn:Submit',
                disabled: !editable(row)
              },
              {
                key: 'copy',
                label: '复制并新增',
                icon: 'ri:file-copy-line',
                auth: 'SmisToolRequisitionReturn:Copy'
              },
              {
                key: 'delete',
                label: '删除',
                icon: 'ri:delete-bin-line',
                auth: 'SmisToolRequisitionReturn:Delete',
                disabled: !editable(row)
              }
            ]}
            onClick={(item: ButtonMoreItem) => {
              if (item.key === 'submit') void handleSubmit(row)
              if (item.key === 'copy') openDialog('copy', row)
              if (item.key === 'delete') void handleDelete([row])
            }}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisToolRequisitionReturn:Return',
      key: 'return',
      label: '归还',
      icon: 'ri:arrow-go-back-line',
      onClick: () => openDialog('return')
    },
    {
      permission: 'SmisToolRequisitionReturn:Add',
      type: 'add',
      label: '新增',
      onClick: () => openDialog('add')
    },
    {
      permission: 'SmisToolRequisitionReturn:Copy',
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedCount }) => selectedCount !== 1,
      onClick: ({ selectedRows }) => openDialog('copy', selectedRows[0] as SmisToolReturn)
    },
    {
      permission: 'SmisToolRequisitionReturn:Edit',
      key: 'edit',
      label: '编辑',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) =>
        selectedRows.length !== 1 || !editable(selectedRows[0] as SmisToolReturn),
      onClick: ({ selectedRows }) => openDialog('edit', selectedRows[0] as SmisToolReturn)
    },
    {
      permission: 'SmisToolRequisitionReturn:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 张归还单吗？删除后无法恢复。`,
      disabled: ({ selectedRows }) => selectedRows.some((row) => !editable(row as SmisToolReturn)),
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.returnNo ?? '工器具归还单')
          })),
          permission: 'SmisToolRequisitionReturn:Delete',
          remove: async () => {
            await deleteToolReturns(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    },
    {
      permission: 'SmisToolRequisitionReturn:Submit',
      key: 'submit',
      label: '提交审批',
      icon: 'ri:send-plane-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) =>
        selectedRows.length !== 1 || !editable(selectedRows[0] as SmisToolReturn),
      onClick: ({ selectedRows }) => handleSubmit(selectedRows[0] as SmisToolReturn)
    },
    {
      permission: 'SmisToolRequisitionReturn:Export',
      type: 'export',
      label: '导出',
      exportFilename: '工器具领用归还',
      exportSheetName: '领用归还',
      exportColumns: [
        { key: 'returnNo', title: '归还单号' },
        { key: 'sourceDocumentNo', title: '源单据号' },
        { key: 'employeeNo', title: '员工工号' },
        { key: 'employeeName', title: '归还人' },
        { key: 'positionName', title: '岗位' },
        { key: 'organizationName', title: '所属部门' },
        { key: 'returnDate', title: '归还日期' },
        { key: 'status', title: '状态' },
        { key: 'itemsText', title: '归还明细' },
        { key: 'rejectionReason', title: '退回原因' },
        { key: 'remark', title: '备注' }
      ],
      exportApi: async ({ maxRows }) => ({
        data: (
          await fetchToolReturnList({
            ...searchQuery.value,
            purpose: 'export',
            from: 0,
            to: maxRows - 1
          })
        ).data.map((row) => ({ ...row, itemsText: itemSummary(row) }))
      })
    }
  ])

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchToolReturnList(withSupabaseTableRange(params))
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }

  onMounted(() => userStore.ensureDictLoaded('smisToolReturnStatus'))
</script>

<style scoped lang="scss">
  .tool-return-page {
    gap: 12px;
    min-width: 0;

    &__notice {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 9px 14px;
      color: var(--el-text-color-regular);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--el-bg-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        flex: 0 0 30px;
        place-items: center;
        width: 30px;
        height: 30px;
        color: var(--theme-color);
        background: var(--el-bg-color);
        border-radius: 50%;
      }

      p {
        margin: 0;
        font-size: 12px;
      }

      strong {
        margin-right: 8px;
        color: var(--el-text-color-primary);
      }
    }

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.document-no) {
      font-variant-numeric: tabular-nums;
      color: var(--theme-color);
    }
  }

  @media (width <= 768px) {
    .tool-return-page__notice {
      align-items: flex-start;
    }
  }
</style>
