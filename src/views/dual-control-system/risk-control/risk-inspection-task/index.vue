<template>
  <ArtPermissionGuard
    permission="SmisDualControlRiskInspectionTask:View"
    resource-name="风险巡查任务"
  >
    <div class="risk-task-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="RISK INSPECTION OPERATIONS"
        title="风险巡查任务"
        description="任务按分级管控频率自动生成，编号采用月度重置四位流水码；支持转交、执行、取消与全过程留痕。"
        icon="ri:task-line"
        density="compact"
        :tags="[
          { label: '自动生成', type: 'primary', effect: 'plain' },
          { label: '月度流水', type: 'warning', effect: 'light' },
          { label: '执行留痕', type: 'success', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtStatusSegmented
        :model-value="searchQuery.status || ''"
        :options="statusTabs"
        aria-label="任务状态快捷筛选"
        @update:model-value="handleStatusSegmentChange"
      />

      <ArtTableQuery
        ref="tableQueryRef"
        class="risk-task-page__table"
        v-model="searchQuery"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 88, showExpand: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无风险巡查任务',
          emptyDescription: '完成风险管控设置后，系统会按频率自动生成当前周期任务。'
        }"
        focusable
      />

      <TaskDetailDrawer ref="detailDrawerRef" />
      <TaskExecutionDialog ref="executionDialogRef" @success="refreshTask" />
      <TaskActionDialog ref="actionDialogRef" @success="refreshTask" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import dayjs from 'dayjs'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import { fetchEmployeeSelectorList } from '@/api/integration/employees'
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
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchRiskInspectionTaskList,
    type SmisRiskInspectionTask,
    type SmisRiskInspectionTaskOverview,
    type SmisRiskInspectionTaskSearchParams,
    type SmisRiskInspectionTaskStatus
  } from '@smis/api'
  import TaskActionDialog, { type TaskActionDialogOpenData } from './modules/task-action-dialog.vue'
  import TaskDetailDrawer, { type TaskDetailDrawerOpenData } from './modules/task-detail-drawer.vue'
  import TaskExecutionDialog, {
    type TaskExecutionDialogOpenData
  } from './modules/task-execution-dialog.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisDualControlRiskInspectionTask' })
  interface TaskQuery extends SmisRiskInspectionTaskSearchParams {
    plannedRange?: [string, string]
  }
  type TableParams = TaskQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface ActionDialogExpose {
    handleOpen: (data: TaskActionDialogOpenData) => Promise<void>
  }
  interface DetailDrawerExpose {
    handleOpen: (data: TaskDetailDrawerOpenData) => Promise<void>
  }
  interface ExecutionDialogExpose {
    handleOpen: (data: TaskExecutionDialogOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const actionDialogRef = ref<ActionDialogExpose>()
  const detailDrawerRef = ref<DetailDrawerExpose>()
  const executionDialogRef = ref<ExecutionDialogExpose>()
  const searchQuery = ref<TaskQuery>({})
  const employees = shallowRef<EmployeeIntegrationItem[]>([])
  const overview = reactive<SmisRiskInspectionTaskOverview>({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    overdue: 0,
    completed: 0
  })
  const riskTypeOptions = computed(() =>
    (getDictMap.value.smisRiskPointType ?? []).map(toDictionaryOption)
  )
  const taskStatusOptions = computed(() =>
    (getDictMap.value.smisRiskInspectionTaskStatus ?? []).map((item) => ({
      label: item.label || item.name,
      value: item.value as SmisRiskInspectionTaskStatus
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
      label: '进行中',
      value: 'in_progress' as const,
      count: overview.inProgress,
      icon: 'ri:loader-4-line'
    },
    {
      label: '已过期',
      value: 'overdue' as const,
      count: overview.overdue,
      icon: 'ri:alarm-warning-line'
    },
    {
      label: '已完成',
      value: 'completed' as const,
      count: overview.completed,
      icon: 'ri:checkbox-circle-line'
    }
  ])
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    { label: '任务总数', value: overview.total, description: '当前查询口径', icon: 'ri:task-line' },
    {
      label: '待执行',
      value: overview.notStarted,
      description: '尚未开始巡查',
      icon: 'ri:timer-line',
      tone: 'warning'
    },
    {
      label: '进行中',
      value: overview.inProgress,
      description: '已保存执行进度',
      icon: 'ri:loader-4-line',
      tone: 'primary'
    },
    {
      label: '已过期',
      value: overview.overdue,
      description: '超过计划完成时间',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const employeeOptions = computed(() =>
    employees.value.map((item) => ({
      label: `${item.employeeName} · ${item.employeeNo}`,
      value: item.id
    }))
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '任务/风险点',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '任务编号或风险点编号' }
    },
    {
      label: '风险名称',
      key: 'riskName',
      type: 'input',
      props: { clearable: true, placeholder: '风险点名称' }
    },
    {
      label: '风险点类型',
      key: 'riskType',
      type: 'select',
      props: { options: riskTypeOptions.value, clearable: true, placeholder: '全部类型' }
    },
    {
      label: '计划开始',
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
      label: '管控责任人',
      key: 'responsibleEmployeeId',
      type: 'select',
      props: {
        options: employeeOptions.value,
        clearable: true,
        filterable: true,
        placeholder: '全部责任人'
      }
    },
    {
      label: '任务状态',
      key: 'status',
      type: 'select',
      props: { options: taskStatusOptions.value, clearable: true, placeholder: '全部状态' }
    },
    {
      label: '实际执行人',
      key: 'executorKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名或工号' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'taskNo', title: '任务编号' },
    { key: 'riskPointName', title: '风险点名称' },
    { key: 'riskPointNo', title: '风险点编号' },
    { key: 'riskPointType', title: '风险点类型' },
    { key: 'riskLevelName', title: '风险等级' },
    { key: 'controlLevel', title: '管控层级' },
    { key: 'responsibleEmployeeName', title: '管控责任人' },
    { key: 'assigneeEmployeeName', title: '当前接收人' },
    { key: 'plannedStartAt', title: '计划开始时间' },
    { key: 'plannedEndAt', title: '计划完成时间' },
    { key: 'actualExecutorEmployeeName', title: '实际执行人' },
    { key: 'status', title: '任务状态' },
    { key: 'progress', title: '巡查进度' },
    { key: 'abnormalCount', title: '异常项数' }
  ]
  const isActionable = (row: SmisRiskInspectionTask): boolean =>
    ['not_started', 'in_progress', 'overdue'].includes(row.status)
  const openDetail = (row: SmisRiskInspectionTask): void => {
    void detailDrawerRef.value?.handleOpen({ row })
  }
  const openExecute = (row: SmisRiskInspectionTask): void => {
    void executionDialogRef.value?.handleOpen({ row })
  }
  const openAction = (row: SmisRiskInspectionTask, mode: 'cancel' | 'transfer'): void => {
    void actionDialogRef.value?.handleOpen({ row, mode })
  }
  const setStatus = async (status: '' | SmisRiskInspectionTaskStatus): Promise<void> => {
    searchQuery.value = { ...searchQuery.value, status: status || undefined }
    await nextTick()
    await tableQueryRef.value?.getData()
  }
  const handleStatusSegmentChange = (value: string | number | boolean): void => {
    if (statusTabs.value.some((item) => item.value === value)) {
      void setStatus(value as '' | SmisRiskInspectionTaskStatus)
    }
  }
  const columnsFactory = (): ColumnOption<SmisRiskInspectionTask>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'taskNo',
      label: '任务编号',
      width: 178,
      fixed: 'left',
      formatter: (row) => (
        <button class="risk-task-page__task-link" type="button" onClick={() => openDetail(row)}>
          {row.taskNo}
        </button>
      )
    },
    {
      prop: 'riskPointName',
      label: '风险点名称',
      minWidth: 220,
      fixed: 'left',
      formatter: (row) => (
        <div class="risk-task-page__identity">
          <span>
            <ArtSvgIcon icon="ri:map-pin-range-line" />
          </span>
          <div>
            <strong>{row.riskPointName}</strong>
            <small>{row.riskPointNo}</small>
          </div>
        </div>
      )
    },
    {
      prop: 'riskPointType',
      label: '风险点类型',
      width: 116,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisRiskPointType" value={row.riskPointType} display="tag" />
      )
    },
    {
      prop: 'riskLevelName',
      label: '风险等级',
      width: 110,
      align: 'center',
      formatter: (row) => (
        <span class="risk-task-page__level" style={{ '--risk-color': row.riskLevelColor }}>
          {row.riskLevelName}
        </span>
      )
    },
    {
      prop: 'controlLevel',
      label: '管控层级',
      width: 130,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisRiskControlLevel" value={row.controlLevel} display="tag" />
      )
    },
    {
      prop: 'responsibleEmployeeName',
      label: '责任人 / 接收人',
      minWidth: 180,
      formatter: (row) => (
        <div class="risk-task-page__stack">
          <strong>{row.responsibleEmployeeName}</strong>
          <small>
            {row.assigneeEmployeeName === row.responsibleEmployeeName
              ? '本人执行'
              : `已转交：${row.assigneeEmployeeName}`}
          </small>
        </div>
      )
    },
    {
      prop: 'plannedStartAt',
      label: '计划时间',
      minWidth: 190,
      formatter: (row) => (
        <div class="risk-task-page__stack">
          <strong>{formatTableDateTime(row.plannedStartAt)}</strong>
          <small>至 {formatTableDateTime(row.plannedEndAt)}</small>
        </div>
      )
    },
    {
      prop: 'actualExecutorEmployeeName',
      label: '实际执行人',
      width: 130,
      formatter: (row) =>
        row.actualExecutorEmployeeName || <span class="risk-task-page__muted">尚未执行</span>
    },
    {
      prop: 'progress',
      label: '巡查进度',
      width: 124,
      formatter: (row) => (
        <div class="risk-task-page__progress">
          <strong>
            {row.completedItemCount}/{row.itemCount}
          </strong>
          {row.abnormalCount ? <small>{row.abnormalCount} 项异常</small> : <small>暂无异常</small>}
        </div>
      )
    },
    {
      prop: 'status',
      label: '任务状态',
      width: 104,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisRiskInspectionTaskStatus" value={row.status} display="tag" />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 210,
      fixed: 'right',
      formatter: (row) => (
        <div class="risk-task-page__actions">
          <ArtButtonTable type="view" label="详情" onClick={() => openDetail(row)} />
          {isActionable(row) ? (
            <>
              <ArtButtonTable
                type="edit"
                permission="SmisDualControlRiskInspectionTask:Execute"
                label="执行"
                onClick={() => openExecute(row)}
              />
              <ArtButtonTable
                type="edit"
                icon="ri:user-shared-line"
                permission="SmisDualControlRiskInspectionTask:Transfer"
                label="转交"
                onClick={() => openAction(row, 'transfer')}
              />
              <ArtButtonTable
                type="delete"
                permission="SmisDualControlRiskInspectionTask:Cancel"
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
    const response = await fetchRiskInspectionTaskList(
      {
        ...params,
        plannedFrom: params.plannedRange?.[0],
        plannedTo: params.plannedRange?.[1] ? `${params.plannedRange[1]}T23:59:59` : undefined,
        from,
        to
      },
      { showErrorMessage: false }
    )
    if (options?.signal?.aborted) return response
    if (response.error)
      throw new Error('风险巡查任务加载失败，请重新加载', { cause: response.error })
    Object.assign(overview, response.overview)
    return response
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlRiskInspectionTask:Export',
      type: 'export',
      exportFilename: '风险巡查任务',
      exportSheetName: '巡查任务',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: (
          await loadAllDocumentPages<SmisRiskInspectionTask, SmisRiskInspectionTaskSearchParams>(
            fetchRiskInspectionTaskList,
            {
              ...searchQuery.value,
              plannedFrom: searchQuery.value.plannedRange?.[0],
              plannedTo: searchQuery.value.plannedRange?.[1]
                ? `${searchQuery.value.plannedRange[1]}T23:59:59`
                : undefined
            }
          )
        ).map((row) => ({
          ...row,
          riskPointType:
            userStore.getDictItemByValue('smisRiskPointType', row.riskPointType)?.label ||
            row.riskPointType,
          controlLevel:
            userStore.getDictItemByValue('smisRiskControlLevel', row.controlLevel)?.label ||
            row.controlLevel,
          plannedStartAt: dayjs(row.plannedStartAt).format('YYYY-MM-DD HH:mm'),
          plannedEndAt: dayjs(row.plannedEndAt).format('YYYY-MM-DD HH:mm'),
          status:
            userStore.getDictItemByValue('smisRiskInspectionTaskStatus', row.status)?.label ||
            row.status,
          progress: `${row.completedItemCount}/${row.itemCount}`
        }))
      })
    }
  ])
  const refreshTask = (): void => {
    void tableQueryRef.value?.refreshUpdate()
  }
  onMounted(async () => {
    const [, , , employeeResult] = await Promise.all([
      userStore.ensureDictLoaded('smisRiskPointType'),
      userStore.ensureDictLoaded('smisRiskControlLevel'),
      userStore.ensureDictLoaded('smisRiskInspectionTaskStatus'),
      fetchEmployeeSelectorList({ from: 0, to: 999 })
    ])
    employees.value = employeeResult.data
  })
</script>

<style scoped lang="scss">
  .risk-task-page {
    min-width: 0;

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.risk-task-page__task-link) {
      padding: 0;
      color: var(--theme-color);
      cursor: pointer;
      background: transparent;
      border: 0;
    }

    :deep(.risk-task-page__task-link:hover) {
      text-decoration: underline;
    }

    :deep(.risk-task-page__identity) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
    }

    :deep(.risk-task-page__identity > span) {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    :deep(.risk-task-page__identity strong),
    :deep(.risk-task-page__identity small),
    :deep(.risk-task-page__stack strong),
    :deep(.risk-task-page__stack small) {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.risk-task-page__identity small),
    :deep(.risk-task-page__stack small),
    :deep(.risk-task-page__progress small) {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.risk-task-page__level) {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-weight: 600;
    }

    :deep(.risk-task-page__level::before) {
      width: 8px;
      height: 8px;
      content: '';
      background: var(--risk-color);
      border-radius: 50%;
    }

    :deep(.risk-task-page__progress) {
      display: grid;
      text-align: center;
    }

    :deep(.risk-task-page__progress strong) {
      color: var(--theme-color);
    }

    :deep(.risk-task-page__muted) {
      color: var(--el-text-color-placeholder);
    }
  }
</style>
