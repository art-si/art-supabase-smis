<template>
  <ArtPermissionGuard
    permission="SmisDualControlHiddenHazardInspectionTask:View"
    resource-name="隐患排查任务"
  >
    <div class="hidden-hazard-task-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="HAZARD INSPECTION OPERATIONS"
        title="隐患排查任务"
        description="集中查看计划派发任务、正常与异常累计，支持现场执行、任务转交、取消和全过程审计。"
        icon="ri:task-line"
        density="compact"
        :tags="[
          { label: '月度四位流水', type: 'primary', effect: 'plain' },
          { label: '异常自动编号', type: 'danger', effect: 'light' },
          { label: '执行留痕', type: 'success', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtStatusSegmented
        :model-value="searchQuery.status || ''"
        :options="statusTabs"
        aria-label="任务状态快捷筛选"
        @update:model-value="handleStatusChange"
      />

      <ArtTableQuery
        ref="tableQueryRef"
        class="hidden-hazard-task-page__table"
        v-model="searchQuery"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 84, showExpand: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无隐患排查任务',
          emptyDescription: '启用排查计划后，系统会在计划开始时间前自动生成任务。'
        }"
        focusable
      />

      <TaskDetailDrawer ref="detailRef" />
      <TaskExecutionDialog ref="executionRef" @success="refreshTask" />
      <TaskActionDialog ref="actionRef" @success="refreshTask" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import dayjs from 'dayjs'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useUserStore } from '@/store/modules/user'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtStatusSegmented from '@/components/core/forms/art-status-segmented/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchHiddenHazardInspectionTaskList,
    type SmisHiddenHazardInspectionTask,
    type SmisHiddenHazardTaskOverview,
    type SmisHiddenHazardTaskSearchParams,
    type SmisHiddenHazardTaskStatus
  } from '@smis/api'
  import TaskActionDialog, {
    type HiddenHazardTaskActionOpenData
  } from './modules/task-action-dialog.vue'
  import TaskDetailDrawer, {
    type HiddenHazardTaskDetailOpenData
  } from './modules/task-detail-drawer.vue'
  import TaskExecutionDialog, {
    type HiddenHazardTaskExecutionOpenData
  } from './modules/task-execution-dialog.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisDualControlHiddenHazardInspectionTask' })
  interface TaskQuery extends SmisHiddenHazardTaskSearchParams {
    plannedRange?: [string, string]
  }
  type TableParams = TaskQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface ActionExpose {
    handleOpen: (data: HiddenHazardTaskActionOpenData) => Promise<void>
  }
  interface DetailExpose {
    handleOpen: (data: HiddenHazardTaskDetailOpenData) => Promise<void>
  }
  interface ExecutionExpose {
    handleOpen: (data: HiddenHazardTaskExecutionOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const actionRef = ref<ActionExpose>()
  const detailRef = ref<DetailExpose>()
  const executionRef = ref<ExecutionExpose>()
  const searchQuery = ref<TaskQuery>({})
  const overview = reactive<SmisHiddenHazardTaskOverview>({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    overdue: 0,
    completed: 0,
    cancelled: 0
  })
  const statusOptions = computed(() =>
    (getDictMap.value.smisHiddenHazardTaskStatus ?? []).map((item) => ({
      label: item.label || item.name,
      value: item.value as SmisHiddenHazardTaskStatus
    }))
  )
  const statusTabs = computed(() => [
    { label: '全部任务', value: '' as const, count: overview.total, icon: 'ri:apps-2-line' },
    {
      label: '未开始',
      value: 'not_started' as const,
      count: overview.notStarted,
      icon: 'ri:timer-line'
    },
    {
      label: '执行中',
      value: 'in_progress' as const,
      count: overview.inProgress,
      icon: 'ri:loader-4-line'
    },
    {
      label: '已逾期',
      value: 'overdue' as const,
      count: overview.overdue,
      icon: 'ri:alarm-warning-line'
    },
    {
      label: '已完成',
      value: 'completed' as const,
      count: overview.completed,
      icon: 'ri:checkbox-circle-line'
    },
    {
      label: '已取消',
      value: 'cancelled' as const,
      count: overview.cancelled,
      icon: 'ri:close-circle-line'
    }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    { label: '任务总数', value: overview.total, description: '当前查询口径', icon: 'ri:task-line' },
    {
      label: '待执行',
      value: overview.notStarted,
      description: '尚未开始排查',
      icon: 'ri:timer-line',
      tone: 'warning'
    },
    {
      label: '执行中',
      value: overview.inProgress,
      description: '已保存现场进度',
      icon: 'ri:loader-4-line',
      tone: 'primary'
    },
    {
      label: '已逾期',
      value: overview.overdue,
      description: '超过计划结束时间',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '任务编号',
      key: 'taskNo',
      type: 'input',
      props: { clearable: true, placeholder: '输入任务编号' }
    },
    {
      label: '排查对象',
      key: 'inspectionObject',
      type: 'input',
      props: { clearable: true, placeholder: '输入排查对象' }
    },
    {
      label: '计划时间',
      key: 'plannedRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期'
      }
    },
    {
      label: '任务状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
    },
    {
      label: '执行人',
      key: 'executorKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名或工号' }
    },
    {
      label: '源计划编号',
      key: 'sourcePlanNo',
      type: 'input',
      props: { clearable: true, placeholder: '输入源计划编号' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'sourcePlanName', title: '所属排查计划' },
    { key: 'taskNo', title: '任务编号' },
    { key: 'inspectionObject', title: '排查对象' },
    { key: 'inspectionTypeName', title: '排查类型' },
    { key: 'status', title: '任务状态' },
    { key: 'executorEmployeeName', title: '执行人' },
    { key: 'plannedStartAt', title: '计划开始时间' },
    { key: 'plannedEndAt', title: '计划结束时间' },
    { key: 'inspectionDescription', title: '检查说明' },
    { key: 'itemCount', title: '排查内容' },
    { key: 'normalCount', title: '正常' },
    { key: 'abnormalCount', title: '异常' },
    { key: 'sourcePlanNo', title: '源排查计划编号' }
  ]
  const actionable = (row: SmisHiddenHazardInspectionTask): boolean =>
    ['not_started', 'in_progress', 'overdue'].includes(row.status)
  const openDetail = (row: SmisHiddenHazardInspectionTask): void => {
    void detailRef.value?.handleOpen({ row })
  }
  const openExecute = (row: SmisHiddenHazardInspectionTask): void => {
    void executionRef.value?.handleOpen({ row })
  }
  const openAction = (row: SmisHiddenHazardInspectionTask, mode: 'cancel' | 'transfer'): void => {
    void actionRef.value?.handleOpen({ row, mode })
  }
  const columnsFactory = (): ColumnOption<SmisHiddenHazardInspectionTask>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'sourcePlanName',
      label: '所属排查计划',
      minWidth: 210,
      fixed: 'left',
      showOverflowTooltip: true
    },
    {
      prop: 'taskNo',
      label: '任务编号',
      width: 150,
      fixed: 'left',
      formatter: (row) => (
        <button type="button" class="hidden-hazard-task-page__link" onClick={() => openDetail(row)}>
          {row.taskNo}
        </button>
      )
    },
    { prop: 'inspectionObject', label: '排查对象', minWidth: 170, showOverflowTooltip: true },
    { prop: 'inspectionTypeName', label: '排查类型', width: 120, showOverflowTooltip: true },
    {
      prop: 'status',
      label: '任务状态',
      width: 100,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisHiddenHazardTaskStatus" value={row.status} display="tag" />
      )
    },
    {
      prop: 'executorEmployeeName',
      label: '执行人',
      minWidth: 140,
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.executorEmployeeName}
          secondary={row.executorEmployeeNo}
        />
      )
    },
    {
      prop: 'plannedStartAt',
      label: '计划开始时间',
      width: 164,
      formatter: (row) => formatTableDateTime(row.plannedStartAt)
    },
    {
      prop: 'plannedEndAt',
      label: '计划结束时间',
      width: 164,
      formatter: (row) => formatTableDateTime(row.plannedEndAt)
    },
    { prop: 'inspectionDescription', label: '检查说明', minWidth: 200, showOverflowTooltip: true },
    { prop: 'itemCount', label: '排查内容', width: 86, align: 'right' },
    {
      prop: 'normalCount',
      label: '正常',
      width: 76,
      align: 'right',
      formatter: (row) => (
        <span class="hidden-hazard-task-page__count is-normal">{row.normalCount}</span>
      )
    },
    {
      prop: 'abnormalCount',
      label: '异常',
      width: 76,
      align: 'right',
      formatter: (row) => (
        <span class={['hidden-hazard-task-page__count', row.abnormalCount ? 'is-abnormal' : '']}>
          {row.abnormalCount}
        </span>
      )
    },
    { prop: 'sourcePlanNo', label: '源排查计划编号', width: 154 },
    {
      prop: 'operation',
      label: '操作',
      width: 240,
      fixed: 'right',
      formatter: (row) => (
        <div class="hidden-hazard-task-page__actions">
          <ArtButtonTable type="view" label="查看" onClick={() => openDetail(row)} />
          {actionable(row) ? (
            <>
              <ArtButtonTable
                type="edit"
                permission="SmisDualControlHiddenHazardInspectionTask:Execute"
                label="执行"
                onClick={() => openExecute(row)}
              />
              <ArtButtonTable
                type="edit"
                icon="ri:user-shared-line"
                permission="SmisDualControlHiddenHazardInspectionTask:Transfer"
                label="转交"
                onClick={() => openAction(row, 'transfer')}
              />
              <ArtButtonTable
                type="delete"
                permission="SmisDualControlHiddenHazardInspectionTask:Cancel"
                label="取消"
                onClick={() => openAction(row, 'cancel')}
              />
            </>
          ) : null}
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchHiddenHazardInspectionTaskList({
      ...params,
      plannedFrom: params.plannedRange?.[0],
      plannedTo: params.plannedRange?.[1] ? `${params.plannedRange[1]}T23:59:59` : undefined,
      from,
      to
    })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return result
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlHiddenHazardInspectionTask:Export',
      type: 'export',
      exportFilename: '隐患排查任务',
      exportSheetName: '排查任务',
      exportColumns: excelColumns,
      exportApi: async () => {
        const rows = await loadAllDocumentPages<
          SmisHiddenHazardInspectionTask,
          SmisHiddenHazardTaskSearchParams
        >(fetchHiddenHazardInspectionTaskList, {
          ...searchQuery.value,
          plannedFrom: searchQuery.value.plannedRange?.[0],
          plannedTo: searchQuery.value.plannedRange?.[1]
            ? `${searchQuery.value.plannedRange[1]}T23:59:59`
            : undefined
        })
        return {
          data: rows.map((row) => ({
            ...row,
            status:
              statusOptions.value.find((item) => item.value === row.status)?.label || '未识别状态',
            plannedStartAt: dayjs(row.plannedStartAt).format('YYYY-MM-DD HH:mm'),
            plannedEndAt: dayjs(row.plannedEndAt).format('YYYY-MM-DD HH:mm')
          }))
        }
      }
    }
  ])
  const setStatus = async (status: '' | SmisHiddenHazardTaskStatus): Promise<void> => {
    searchQuery.value = { ...searchQuery.value, status: status || undefined }
    await nextTick()
    await tableQueryRef.value?.getData()
  }
  const handleStatusChange = (value: string | number | boolean): void => {
    if (statusTabs.value.some((item) => item.value === value))
      void setStatus(value as '' | SmisHiddenHazardTaskStatus)
  }
  const refreshTask = (): void => {
    void tableQueryRef.value?.refreshUpdate()
  }
  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('smisHiddenHazardTaskStatus'),
      userStore.ensureDictLoaded('smisHiddenHazardInspectionResult')
    ])
  })
</script>

<style scoped lang="scss">
  .hidden-hazard-task-page {
    min-width: 0;

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.hidden-hazard-task-page__link) {
      padding: 0;
      color: var(--theme-color);
      cursor: pointer;
      background: transparent;
      border: 0;
    }

    :deep(.hidden-hazard-task-page__link:focus-visible) {
      outline: 2px solid color-mix(in srgb, var(--theme-color) 60%, transparent);
      outline-offset: 3px;
    }

    :deep(.hidden-hazard-task-page__actions) {
      display: flex;
      align-items: center;
    }

    :deep(.hidden-hazard-task-page__count) {
      font-weight: 700;
    }

    :deep(.hidden-hazard-task-page__count.is-normal) {
      color: var(--el-color-success);
    }

    :deep(.hidden-hazard-task-page__count.is-abnormal) {
      color: var(--el-color-danger);
    }
  }
</style>
