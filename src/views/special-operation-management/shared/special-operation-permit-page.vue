<template>
  <ArtPermissionGuard :permission="permissions.view" :resource-name="title">
    <div
      class="special-operation-permit-page business-workspace-page art-full-height min-w-0 gap-[12px] overflow-hidden"
    >
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="SPECIAL OPERATION WORK PERMIT"
        :title="title"
        :description="description"
        :icon="pageIcon"
        :tags="[
          { label: '租户级台账', type: 'primary', effect: 'plain' },
          { label: '流程全程留痕', type: 'warning', effect: 'light' },
          { label: '支持打印归档', type: 'success', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div
        class="special-operation-permit-page__workspace flex min-h-0 min-w-0 w-full flex-1 flex-col gap-[12px]"
      >
        <section
          class="special-operation-permit-page__status art-card-xs"
          aria-label="单据状态筛选"
        >
          <div class="special-operation-permit-page__status-label">
            <span aria-hidden="true"><ArtSvgIcon icon="ri:filter-3-line" /></span>
            <div><strong>单据状态</strong><small>快速切换作业票处理阶段</small></div>
          </div>
          <ElScrollbar class="special-operation-permit-page__status-scroll">
            <ElSegmented
              :model-value="activeStatus || 'all'"
              :options="statusSegments"
              aria-label="选择单据状态"
              @change="switchStatus"
            >
              <template #default="{ item }">
                <span class="special-operation-permit-page__status-option">
                  <span>{{ item.label }}</span>
                  <small>{{ item.count }}</small>
                </span>
              </template>
            </ElSegmented>
          </ElScrollbar>
        </section>

        <ArtTableQuery
          ref="tableQueryRef"
          v-model="searchQuery"
          class="special-operation-permit-page__table"
          :api-fn="fetchTableData"
          :search-items="searchItems"
          :columns-factory="columnsFactory"
          :header-actions="headerActions"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 4, labelWidth: 78, showExpand: false }"
          :table-header-props="{ layout: 'refresh,size,fullscreen,columns,settings' }"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            emptyText: `暂无${title}记录`,
            emptyDescription: activeStatus
              ? '当前状态下暂无作业票，可切换到“全部”查看。'
              : '可点击“新增作业票”发起第一张特殊作业票。'
          }"
          focusable
          focus-scope-selector=".special-operation-permit-page__workspace"
        />
      </div>

      <SpecialOperationPermitDialog ref="permitDialogRef" @success="handleSaveSuccess" />
      <SpecialOperationWorkflowDialog ref="workflowDialogRef" @success="handleWorkflowSuccess" />
      <SpecialOperationPermitDetailDialog
        ref="detailDialogRef"
        :operation-types="operationTypes"
        :print-permission="permissions.print"
      />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { mapWithConcurrency } from '@/utils/async'

  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteSpecialOperationPermits,
    fetchSpecialOperationPermitList,
    fetchSpecialOperationTypeList,
    transitionSpecialOperationPermit,
    type SmisSpecialOperationPermit,
    type SmisSpecialOperationPermitOverview,
    type SmisSpecialOperationPermitSearchParams,
    type SmisSpecialOperationPermitStatus,
    type SmisSpecialOperationTransitionAction,
    type SmisSpecialOperationType
  } from '@smis/api'
  import SpecialOperationPermitDialog, {
    type SpecialOperationPermitDialogOpenData
  } from './special-operation-permit-dialog.vue'
  import SpecialOperationWorkflowDialog from './special-operation-workflow-dialog.vue'
  import SpecialOperationPermitDetailDialog from './special-operation-permit-detail-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_special_operation_permit',
    '作业票'
  )

  export interface SpecialOperationPagePermissions {
    view: string
    add: string
    copy: string
    edit: string
    delete: string
    export: string
    void: string
    start: string
    requestAcceptance: string
    accept: string
    print: string
    aiPrecheck: string
  }

  const props = defineProps<{
    title: string
    description: string
    pageIcon: string
    permissions: SpecialOperationPagePermissions
    operationTypeCode?: string | null
  }>()
  type TableParams = SmisSpecialOperationPermitSearchParams & { workRange?: string[] } & Partial<
      Pick<Api.Common.PaginationParams, 'current' | 'size'>
    >
  interface DialogExpose {
    handleOpen: (data: SpecialOperationPermitDialogOpenData) => Promise<void>
  }
  interface WorkflowExpose {
    handleOpen: (data: {
      row: Pick<SmisSpecialOperationPermit, 'id' | 'tenantId' | 'permitNo'>
      action: SmisSpecialOperationTransitionAction
    }) => Promise<void>
  }
  interface DetailExpose {
    handleOpen: (data: {
      row: Pick<SmisSpecialOperationPermit, 'id' | 'tenantId' | 'permitNo'>
      mode?: 'detail' | 'print'
    }) => Promise<void>
  }
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId, revision, scopeLabel, isPlatformScope } = storeToRefs(tenantScopeStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const permitDialogRef = ref<DialogExpose>()
  const workflowDialogRef = ref<WorkflowExpose>()
  const detailDialogRef = ref<DetailExpose>()
  const operationTypes = ref<SmisSpecialOperationType[]>([])
  const activeStatus = ref<SmisSpecialOperationPermitStatus | undefined>()
  const searchQuery = ref<TableParams>({})
  const overview = reactive<SmisSpecialOperationPermitOverview>({
    total: 0,
    draft: 0,
    pendingApproval: 0,
    rejected: 0,
    inProgress: 0,
    pendingAcceptance: 0,
    completed: 0,
    voided: 0
  })
  const operationTypeOptions = computed(() =>
    operationTypes.value
      .filter((item) => item.status !== 'voided')
      .map((item) => ({ label: item.typeName, value: item.id }))
  )
  const statusTabs = computed(() => [
    { label: '全部', value: undefined, count: overview.total },
    { label: '草稿', value: 'draft' as const, count: overview.draft },
    { label: '待审批', value: 'pending_approval' as const, count: overview.pendingApproval },
    { label: '已拒绝', value: 'rejected' as const, count: overview.rejected },
    { label: '作业中', value: 'in_progress' as const, count: overview.inProgress },
    { label: '待验收', value: 'pending_acceptance' as const, count: overview.pendingAcceptance },
    { label: '已完成', value: 'completed' as const, count: overview.completed },
    { label: '已作废', value: 'voided' as const, count: overview.voided }
  ])
  const statusSegments = computed(() =>
    statusTabs.value.map((item) => ({ ...item, value: item.value || 'all' }))
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '作业票总数',
      value: overview.total,
      description: isPlatformScope.value ? `${scopeLabel.value}台账` : '当前租户台账',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '待审批',
      value: overview.pendingApproval,
      description: '等待审批决定',
      icon: 'ri:time-line',
      tone: 'warning'
    },
    {
      label: '作业中',
      value: overview.inProgress,
      description: '现场正在执行',
      icon: 'ri:tools-line',
      tone: 'success'
    },
    {
      label: '待验收',
      value: overview.pendingAcceptance,
      description: '等待现场闭环',
      icon: 'ri:checkbox-circle-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '作业编号',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '输入作业证编号或内容' }
    },
    ...(props.operationTypeCode
      ? []
      : [
          {
            label: '作业类型',
            key: 'operationTypeId',
            type: 'select' as const,
            props: {
              options: operationTypeOptions.value,
              clearable: true,
              filterable: true,
              placeholder: '全部类型'
            }
          }
        ]),
    {
      label: '作业时间',
      key: 'workRange',
      type: 'daterange',
      span: 8,
      props: {
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        clearable: true
      }
    },
    {
      label: '申请人',
      key: 'applicantKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '输入申请人姓名' }
    }
  ])
  const exportColumns: ArtTableQueryExcelColumn[] = [
    { key: 'permitNo', title: '作业编号', required: true },
    { key: 'operationTypeName', title: '作业类型', required: true },
    { key: 'workStartTime', title: '作业开始时间' },
    { key: 'workEndTime', title: '作业结束时间' },
    { key: 'relatedOperationNames', title: '涉及其他作业' },
    { key: 'workLocation', title: '作业地点' },
    { key: 'applicantName', title: '申请人' },
    { key: 'applicationTime', title: '申请时间' },
    { key: 'currentNode', title: '当前节点' },
    { key: 'statusLabel', title: '状态' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: props.permissions.add,
      type: 'add',
      label: '新增作业票',
      onClick: () => openPermit()
    },
    {
      permission: props.permissions.export,
      type: 'export',
      exportFilename: props.title,
      exportSheetName: '特殊作业台账',
      exportColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const params = searchParams as TableParams
        const query: SmisSpecialOperationPermitSearchParams = {
          ...params,
          status: activeStatus.value,
          operationTypeCode: props.operationTypeCode,
          tenantId: effectiveTenantId.value,
          workStart: params.workRange?.[0],
          workEnd: params.workRange?.[1] ? `${params.workRange[1]}T23:59:59+08:00` : null
        }
        const selected = new Set(selectedIds.map(String))
        const rows = await loadAllDocumentPages(fetchSpecialOperationPermitList, query)
        return {
          data: rows
            .filter((row) => !selected.size || selected.has(row.id))
            .map((row) => ({
              ...row,
              relatedOperationNames: row.relatedPermits
                .map((item) => item.operationTypeName)
                .join('、'),
              statusLabel: statusTabs.value.find((item) => item.value === row.status)?.label,
              workStartTime: formatDate(row.workStartTime),
              workEndTime: formatDate(row.workEndTime),
              applicationTime: formatDate(row.applicationTime)
            }))
        }
      }
    },
    {
      permission: props.permissions.void,
      key: 'void',
      label: '批量作废',
      icon: 'ri:forbid-line',
      selectionRequired: true,
      confirm: true,
      confirmTitle: '批量作废确认',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定作废选中的 ${selectedCount} 张作业票吗？作废后不可恢复。`,
      disabled: ({ selectedRows }) =>
        selectedRows.some((item) =>
          ['completed', 'voided'].includes((item as SmisSpecialOperationPermit).status)
        ),
      onClick: async ({ selectedRows, api }) => {
        try {
          await mapWithConcurrency(selectedRows as SmisSpecialOperationPermit[], 3, (row) =>
            transitionSpecialOperationPermit(row.id, 'void', {
              description: '批量作废',
              tenantId: row.tenantId
            })
          )
        } finally {
          await api.refreshUpdate()
        }
      }
    },
    {
      permission: props.permissions.delete,
      type: 'delete',
      confirm: false,
      disabled: ({ selectedRows }) =>
        selectedRows.some(
          (item) => !['draft', 'rejected'].includes((item as SmisSpecialOperationPermit).status)
        ),
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 张草稿或已拒绝作业票吗？删除后无法恢复。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.permitNo ?? '作业票')
          })),
          permission: props.permissions.delete,
          remove: async () => {
            for (const [tenantId, rows] of groupByTenant(
              selectedRows as SmisSpecialOperationPermit[]
            ))
              await deleteSpecialOperationPermits(
                rows.map((row) => row.id),
                tenantId
              )
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const groupByTenant = (rows: SmisSpecialOperationPermit[]) => {
    const result = new Map<string, SmisSpecialOperationPermit[]>()
    rows.forEach((row) => result.set(row.tenantId, [...(result.get(row.tenantId) || []), row]))
    return result
  }
  const openPermit = (
    row?: SmisSpecialOperationPermit,
    mode: 'add' | 'edit' | 'copy' = row ? 'edit' : 'add'
  ) => {
    void permitDialogRef.value?.handleOpen({
      row,
      mode,
      operationTypes: operationTypes.value,
      forcedOperationTypeCode: props.operationTypeCode,
      aiPrecheckPermission: props.permissions.aiPrecheck,
      tenantId: row?.tenantId || effectiveTenantId.value
    })
  }
  const openDetail = (row: SmisSpecialOperationPermit, mode: 'detail' | 'print' = 'detail') =>
    void detailDialogRef.value?.handleOpen({ row, mode })
  const openWorkflow = (
    row: SmisSpecialOperationPermit,
    action: SmisSpecialOperationTransitionAction
  ) => void workflowDialogRef.value?.handleOpen({ row, action })
  const removeRow = async (row: SmisSpecialOperationPermit) => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.permitNo ?? '作业票')
        }
      ],
      permission: props.permissions.delete,
      confirmMessage: `确定删除作业票“${row.permitNo}”吗？删除后无法恢复。`,
      remove: async () => {
        await deleteSpecialOperationPermits([row.id ?? ''], row.tenantId)
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }
  const moreActions = (row: SmisSpecialOperationPermit): ButtonMoreItem[] => [
    {
      auth: props.permissions.copy,
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-2-line'
    },
    {
      auth: props.permissions.start,
      key: 'start',
      label: '审批 / 开始作业',
      icon: 'ri:play-circle-line',
      disabled: row.status !== 'pending_approval'
    },
    {
      auth: props.permissions.requestAcceptance,
      key: 'request_acceptance',
      label: '申请验收',
      icon: 'ri:send-plane-line',
      disabled: row.status !== 'in_progress'
    },
    {
      auth: props.permissions.accept,
      key: 'accept',
      label: '作业验收',
      icon: 'ri:checkbox-circle-line',
      disabled: row.status !== 'pending_acceptance'
    },
    {
      auth: props.permissions.print,
      key: 'print',
      label: '打印预览',
      icon: 'ri:printer-line'
    },
    {
      auth: props.permissions.void,
      key: 'void',
      label: '作废',
      icon: 'ri:forbid-line',
      color: 'var(--el-color-warning)',
      disabled: ['completed', 'voided'].includes(row.status)
    },
    {
      auth: props.permissions.delete,
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)',
      disabled: !['draft', 'rejected'].includes(row.status)
    }
  ]
  const handleMore = async (item: ButtonMoreItem, row: SmisSpecialOperationPermit) => {
    if (item.key === 'copy') openPermit(row, 'copy')
    else if (item.key === 'print') openDetail(row, 'print')
    else if (item.key === 'delete') await removeRow(row)
    else openWorkflow(row, item.key as SmisSpecialOperationTransitionAction)
  }
  const columnsFactory = (): ColumnOption<SmisSpecialOperationPermit>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'permitNo',
      label: '作业编号',
      minWidth: 176,
      fixed: 'left',
      formatter: (row) => (
        <button
          type="button"
          class="special-operation-permit-page__permit-link"
          onClick={() => openDetail(row)}
        >
          <ArtSvgIcon icon="ri:file-shield-2-line" />
          <span>
            <strong>{row.permitNo}</strong>
            <small>{row.workContent || '未填写作业内容'}</small>
          </span>
        </button>
      )
    },
    {
      prop: 'operationTypeName',
      label: '作业类型',
      width: 128,
      formatter: (row) => (
        <span class="special-operation-permit-page__type">
          <ArtSvgIcon icon="ri:tools-line" />
          {row.operationTypeName}
        </span>
      )
    },
    {
      prop: 'workStartTime',
      label: '作业开始时间',
      width: 154,
      formatter: (row) => formatDate(row.workStartTime)
    },
    {
      prop: 'workEndTime',
      label: '作业结束时间',
      width: 154,
      formatter: (row) => formatDate(row.workEndTime)
    },
    {
      prop: 'relatedPermits',
      label: '涉及其他作业',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.relatedPermits.map((item) => item.operationTypeName).join('、') || '—'
    },
    { prop: 'workLocation', label: '作业地点', minWidth: 150, showOverflowTooltip: true },
    { prop: 'workUnit', label: '作业单位', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'applicantName',
      label: '申请人',
      width: 110,
      formatter: (row) => row.applicantName || '—'
    },
    {
      prop: 'applicationTime',
      label: '申请时间',
      width: 154,
      formatter: (row) => formatDate(row.applicationTime)
    },
    { prop: 'currentNode', label: '当前节点', width: 112 },
    {
      prop: 'status',
      label: '状态',
      width: 104,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisSpecialOperationPermitStatus"
          value={row.status}
          display="tag"
        />
      )
    },
    ...(isPlatformScope.value
      ? [{ prop: 'tenantName', label: '所属租户', minWidth: 170, showOverflowTooltip: true }]
      : []),
    {
      prop: 'operation',
      label: '操作',
      width: 160,
      fixed: 'right',
      formatter: (row) => (
        <div class="special-operation-permit-page__actions">
          <ArtButtonTable
            type="view"
            permission={props.permissions.view}
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            type="edit"
            permission={props.permissions.edit}
            disabled={!['draft', 'rejected'].includes(row.status)}
            onClick={() => openPermit(row, 'edit')}
          />
          <ArtButtonMore list={moreActions(row)} onClick={(item) => void handleMore(item, row)} />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const response = await fetchSpecialOperationPermitList({
      keyword: params.keyword,
      operationTypeId: params.operationTypeId,
      operationTypeCode: props.operationTypeCode,
      workStart: params.workRange?.[0],
      workEnd: params.workRange?.[1] ? `${params.workRange[1]}T23:59:59+08:00` : null,
      applicantKeyword: params.applicantKeyword,
      status: activeStatus.value,
      tenantId: effectiveTenantId.value,
      ...buildSupabasePageRange({ current: params.current ?? 1, size: params.size ?? 20 })
    })
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    return response
  }
  const switchStatus = (status: string | number | boolean) => {
    activeStatus.value =
      status === 'all' ? undefined : (String(status) as SmisSpecialOperationPermitStatus)
    tableQueryRef.value?.clearSelection()
    void tableQueryRef.value?.getData()
  }
  const loadOperationTypes = async () => {
    const result = await fetchSpecialOperationTypeList({
      tenantId: effectiveTenantId.value,
      from: 0,
      to: 9999
    })
    operationTypes.value = result.data
  }
  const handleSaveSuccess = () => void tableQueryRef.value?.refreshCreate()
  const handleWorkflowSuccess = () => void tableQueryRef.value?.refreshUpdate()
  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('smisSpecialOperationPermitStatus'),
      userStore.ensureDictLoaded('smisHotWorkLevel'),
      userStore.ensureDictLoaded('smisHotWorkMethod'),
      userStore.ensureDictLoaded('smisSpecialOperationRecordType'),
      tenantScopeStore.loadTenantOptions(),
      loadOperationTypes()
    ])
  })
  watch(revision, async () => {
    activeStatus.value = undefined
    await loadOperationTypes()
    void tableQueryRef.value?.refreshContext()
  })
</script>

<style scoped lang="scss">
  .special-operation-permit-page__status {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 16px;
    align-items: center;
    min-width: 0;
    padding: 10px 12px;
    overflow: hidden;
  }

  .special-operation-permit-page__status-label {
    display: inline-flex;
    gap: 10px;
    align-items: center;
    min-width: 156px;
    padding-right: 16px;
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .special-operation-permit-page__status-label > span {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 10%, transparent);
    border-radius: var(--art-control-radius);
  }

  .special-operation-permit-page__status-label > span svg {
    width: 18px;
    height: 18px;
  }

  .special-operation-permit-page__status-label div,
  .special-operation-permit-page__status-label strong,
  .special-operation-permit-page__status-label small {
    display: block;
    min-width: 0;
  }

  .special-operation-permit-page__status-label strong {
    font-size: 13px;
    color: var(--el-text-color-primary);
  }

  .special-operation-permit-page__status-label small {
    margin-top: 2px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .special-operation-permit-page__status-scroll {
    width: 100%;
    min-width: 0;
  }

  .special-operation-permit-page__status-scroll :deep(.el-scrollbar__wrap) {
    overflow-y: hidden;
  }

  .special-operation-permit-page__status :deep(.el-segmented) {
    min-width: max-content;

    --el-segmented-bg-color: var(--art-gray-100);
    --el-segmented-item-selected-color: var(--theme-color);
    --el-segmented-item-selected-bg-color: var(--default-box-color);
  }

  .special-operation-permit-page__status :deep(.el-segmented__item) {
    min-height: 36px;
  }

  .special-operation-permit-page__status-option {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    min-width: 0;
  }

  .special-operation-permit-page__status-option small {
    min-width: 20px;
    padding: 1px 6px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    line-height: 18px;
    color: var(--el-text-color-secondary);
    text-align: center;
    background: color-mix(in srgb, var(--el-text-color-secondary) 10%, transparent);
    border-radius: 999px;
  }

  .special-operation-permit-page__status
    :deep(.el-segmented__item.is-selected .special-operation-permit-page__status-option small) {
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 12%, transparent);
  }

  .special-operation-permit-page__table {
    flex: 1;
    width: 100%;
    min-width: 0;
    min-height: 0;
  }

  :deep(.special-operation-permit-page__permit-link) {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 9px;
    align-items: center;
    width: 100%;
    padding: 0;
    color: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
  }

  :deep(.special-operation-permit-page__permit-link > svg) {
    width: 32px;
    height: 32px;
    padding: 7px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 10%, transparent);
    border-radius: var(--el-border-radius-base);
  }

  :deep(.special-operation-permit-page__permit-link span),
  :deep(.special-operation-permit-page__permit-link strong),
  :deep(.special-operation-permit-page__permit-link small) {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.special-operation-permit-page__permit-link strong) {
    color: var(--theme-color);
  }

  :deep(.special-operation-permit-page__permit-link small) {
    margin-top: 2px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  :deep(.special-operation-permit-page__type) {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  :deep(.special-operation-permit-page__type svg) {
    color: var(--theme-color);
  }

  @media (width <= 900px) {
    .special-operation-permit-page__status {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }

    .special-operation-permit-page__status-label {
      min-width: 0;
      padding-right: 0;
      border-right: 0;
    }
  }
</style>
