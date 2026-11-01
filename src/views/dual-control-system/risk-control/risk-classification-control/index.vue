<template>
  <ArtPermissionGuard
    permission="SmisDualControlRiskClassificationControl:View"
    resource-name="风险分级管控"
  >
    <div class="risk-control-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="HIERARCHICAL RISK CONTROL"
        title="风险分级管控"
        description="将已维护危险源的风险点落实到公司、车间、班组与岗位，绑定责任人和巡查频率，驱动后续任务自动生成。"
        icon="ri:git-merge-line"
        density="compact"
        :tags="[
          { label: '分级负责', type: 'primary', effect: 'plain' },
          { label: '频率驱动', type: 'warning', effect: 'light' },
          { label: '任务自动生成', type: 'success', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtStatusSegmented
        :model-value="searchQuery.controlStatus || ''"
        :options="statusSegments"
        aria-label="管控状态快捷筛选"
        @update:model-value="handleStatusSegmentChange"
      />

      <ArtTableQuery
        ref="tableQueryRef"
        class="risk-control-page__table"
        v-model="searchQuery"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 84 }"
        :table-props="{
          rowKey: 'riskPointId',
          tableLayout: 'fixed',
          emptyText: '暂无可管控风险点',
          emptyDescription: '请先在安全风险清单中维护有效危险源。'
        }"
        focusable
      />

      <RiskControlPlanDialog ref="dialogRef" @success="handleSaveSuccess" />
    </div>
    <MasterDataDeleteGuard ref="deletePlanGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { ElMessage, ElTag } from 'element-plus'
  import { fetchEmployeeSelectorList } from '@/api/integration/employees'
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
  import { useUserStore } from '@/store/modules/user'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtStatusSegmented from '@/components/core/forms/art-status-segmented/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteRiskControlPlans,
    fetchRiskControlOptions,
    fetchRiskControlPointList,
    saveRiskControlPlan,
    type SmisRiskControlAssignment,
    type SmisRiskControlLevel,
    type SmisRiskControlOptions,
    type SmisRiskControlOverview,
    type SmisRiskControlPoint,
    type SmisRiskControlSearchParams
  } from '@smis/api'
  import RiskControlPlanDialog, {
    type RiskControlPlanDialogOpenData
  } from './modules/risk-control-plan-dialog.vue'
  const { deleteGuardRef: deletePlanGuardRef, deleteRecords: deletePlanRecords } =
    useRecordDeleteGuard('smis_risk_control_plan', '风险管控配置')

  defineOptions({ name: 'SmisDualControlRiskClassificationControl' })
  type TableParams = SmisRiskControlSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: RiskControlPlanDialogOpenData) => Promise<void>
  }
  interface ControlImportRow {
    riskPointNo?: string
    status?: string
    controlStartAt?: string
    controlDescription?: string
    controlLevels?: string
    responsibleEmployees?: string
    frequencies?: string
    levelRequirements?: string
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<SmisRiskControlSearchParams>({})
  const options = shallowRef<SmisRiskControlOptions>({
    riskPoints: [],
    duplicateConfigurations: []
  })
  const optionsLoading = ref(false)
  const overview = reactive<SmisRiskControlOverview>({
    total: 0,
    uncontrolled: 0,
    active: 0,
    major: 0
  })
  const controlLevelOptions: Array<{ label: string; value: SmisRiskControlLevel }> = [
    { label: '公司级（厂级）', value: 'company' },
    { label: '车间（部门级）', value: 'department' },
    { label: '班组级', value: 'team' },
    { label: '岗位级', value: 'position' }
  ]
  const controlLevelLabel = new Map(controlLevelOptions.map((item) => [item.value, item.label]))
  const riskTypeOptions = computed(() =>
    (getDictMap.value.smisRiskPointType ?? []).map(toDictionaryOption)
  )
  const statusOptions = useDictionaryOptions('smisRiskControlStatus')
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '有效风险点',
      value: overview.total,
      description: '已维护有效危险源',
      icon: 'ri:radar-line'
    },
    {
      label: '待管控',
      value: overview.uncontrolled,
      description: '尚未落实责任层级',
      icon: 'ri:timer-line',
      tone: 'warning'
    },
    {
      label: '管控中',
      value: overview.active,
      description: '自动生成巡查任务',
      icon: 'ri:shield-check-line',
      tone: 'success'
    },
    {
      label: '重大风险',
      value: overview.major,
      description: '优先关注与复核',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const statusSegments = computed(() => [
    {
      label: '全部风险点',
      value: '' as const,
      count: overview.total,
      icon: 'ri:apps-2-line'
    },
    {
      label: '待管控',
      value: 'uncontrolled' as const,
      count: overview.uncontrolled,
      icon: 'ri:timer-line'
    },
    {
      label: '管控中',
      value: 'active' as const,
      count: overview.active,
      icon: 'ri:shield-check-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '风险点',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '风险点编号或名称' }
    },
    {
      label: '风险类型',
      key: 'riskType',
      type: 'select',
      props: { options: riskTypeOptions.value, clearable: true, placeholder: '全部类型' }
    },
    {
      label: '管控层级',
      key: 'controlLevel',
      type: 'select',
      props: { options: controlLevelOptions, clearable: true, placeholder: '全部层级' }
    },
    {
      label: '管控状态',
      key: 'controlStatus',
      type: 'select',
      props: { options: statusOptions, clearable: true, placeholder: '全部状态' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'riskPointNo', title: '风险点编号', required: true },
    { key: 'riskPointName', title: '风险点名称' },
    { key: 'riskPointType', title: '风险点类型' },
    { key: 'riskLevelName', title: '风险等级' },
    { key: 'accidentTypes', title: '事故类型' },
    { key: 'controlLevels', title: '管控层级', required: true },
    { key: 'responsibleEmployees', title: '管控责任人（与层级顺序一致）', required: true },
    { key: 'frequencies', title: '管控频率（与层级顺序一致）', required: true },
    { key: 'levelRequirements', title: '层级管控要求（与层级顺序一致）' },
    { key: 'controlStartAt', title: '管控开始时间' },
    { key: 'controlDescription', title: '总体管控说明' },
    { key: 'status', title: '管控状态' }
  ]
  const loadOptions = async (): Promise<void> => {
    optionsLoading.value = true
    try {
      options.value = await fetchRiskControlOptions()
    } finally {
      optionsLoading.value = false
    }
  }
  const openDialog = async (row?: SmisRiskControlPoint): Promise<void> => {
    await dialogRef.value?.handleOpen({
      row,
      options: options.value,
      loadOptions: async () => {
        await loadOptions()
        return options.value
      }
    })
  }
  const setStatus = async (
    status?: SmisRiskControlSearchParams['controlStatus']
  ): Promise<void> => {
    searchQuery.value = { ...searchQuery.value, controlStatus: status }
    await nextTick()
    await tableQueryRef.value?.getData()
  }
  const handleStatusSegmentChange = (value: string | number | boolean): void => {
    if (statusSegments.value.some((item) => item.value === value)) {
      void setStatus(value ? (value as SmisRiskControlSearchParams['controlStatus']) : undefined)
    }
  }
  const columnsFactory = (): ColumnOption<SmisRiskControlPoint>[] => [
    { type: 'selection', width: 48, fixed: 'left', reserveSelection: true },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'riskPointNo',
      label: '风险点编号',
      width: 142,
      fixed: 'left',
      formatter: (row) => <span class="risk-control-page__code">{row.riskPointNo}</span>
    },
    {
      prop: 'riskPointName',
      label: '风险点名称',
      minWidth: 230,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.riskPointName}
          secondary={row.siteName}
          icon="ri:radar-line"
        />
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
      width: 118,
      align: 'center',
      formatter: (row) => (
        <span class="risk-control-page__level" style={{ '--risk-color': row.riskLevelColor }}>
          {row.riskLevelName}
        </span>
      )
    },
    {
      prop: 'accidentTypes',
      label: '事故类型',
      minWidth: 180,
      formatter: (row) => (
        <div class="risk-control-page__tags">
          {row.accidentTypes.map((item) => (
            <ArtDictDisplay dictCode="smisAccidentCategory" value={item} display="tag" />
          ))}
        </div>
      )
    },
    {
      prop: 'controlLevels',
      label: '管控层级',
      minWidth: 220,
      formatter: (row) =>
        row.controlLevels.length ? (
          <div class="risk-control-page__tags">
            {row.controlLevels.map((item) => (
              <ElTag effect="plain">{controlLevelLabel.get(item)}</ElTag>
            ))}
          </div>
        ) : (
          <span class="risk-control-page__muted">尚未设置</span>
        )
    },
    {
      prop: 'responsibleNames',
      label: '管控责任人',
      minWidth: 160,
      formatter: (row) =>
        row.responsibleNames || <span class="risk-control-page__muted">待落实</span>
    },
    {
      prop: 'assignments',
      label: '管控频率',
      minWidth: 240,
      formatter: (row) => (
        <div class="risk-control-page__stack">
          {row.assignments.length ? (
            row.assignments.map((item) => (
              <span>
                <b>{controlLevelLabel.get(item.controlLevel)}</b>
                <small>{item.frequencyLabel}</small>
              </span>
            ))
          ) : (
            <span class="risk-control-page__muted">待配置</span>
          )}
        </div>
      )
    },
    {
      prop: 'controlStatus',
      label: '管控状态',
      width: 108,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisRiskControlStatus" value={row.controlStatus} display="tag" />
      )
    },
    {
      prop: 'taskCount',
      label: '已生成任务',
      width: 104,
      align: 'center',
      formatter: (row) => <strong class="risk-control-page__count">{row.taskCount}</strong>
    },
    {
      prop: 'operation',
      label: '操作',
      width: 150,
      fixed: 'right',
      formatter: (row) => (
        <div class="risk-control-page__actions">
          <ArtButtonTable
            type="edit"
            permission={
              row.planId
                ? 'SmisDualControlRiskClassificationControl:Edit'
                : 'SmisDualControlRiskClassificationControl:Configure'
            }
            label="管控设置"
            onClick={() => void openDialog(row)}
          />
          {row.planId ? (
            <ArtButtonTable
              type="delete"
              permission="SmisDualControlRiskClassificationControl:Delete"
              onClick={() => void handleDelete(row)}
            />
          ) : null}
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchRiskControlPointList(
      { ...params, from, to },
      { showErrorMessage: false }
    )
    if (options?.signal?.aborted) return response
    if (response.error)
      throw new Error('风险分级管控加载失败，请重新加载', { cause: response.error })
    Object.assign(overview, response.overview)
    return response
  }
  const split = (value?: string): string[] =>
    String(value || '')
      .split(/[|｜;；]/)
      .map((item) => item.trim())
      .filter(Boolean)
  const resolveLevel = (value: string): SmisRiskControlLevel | undefined =>
    controlLevelOptions.find((item) => item.value === value || item.label === value)?.value
  const importRows = async (rows: unknown[]): Promise<void> => {
    if (!options.value.riskPoints.length) await loadOptions()
    for (const raw of rows as ControlImportRow[]) {
      const point = options.value.riskPoints.find(
        (item) => item.pointNo === String(raw.riskPointNo || '').trim()
      )
      if (!point) throw new Error(`未找到风险点：${raw.riskPointNo}`)
      const levels = split(raw.controlLevels).map(resolveLevel)
      if (levels.some((item) => !item)) throw new Error(`管控层级无法识别：${raw.controlLevels}`)
      const employees = split(raw.responsibleEmployees)
      const frequencies = split(raw.frequencies)
      const requirements = split(raw.levelRequirements)
      if (levels.length !== employees.length || levels.length !== frequencies.length)
        throw new Error(`风险点 ${point.pointNo} 的层级、责任人和频率数量不一致`)
      const assignments: SmisRiskControlAssignment[] = []
      for (let index = 0; index < levels.length; index += 1) {
        const employeeResult = await fetchEmployeeSelectorList({
          keyword: employees[index],
          from: 0,
          to: 20
        })
        const employee = employeeResult.data.find(
          (item) => item.employeeNo === employees[index] || item.employeeName === employees[index]
        )
        const frequency = options.value.duplicateConfigurations.find(
          (item) =>
            item.id === frequencies[index] ||
            item.contentItem === frequencies[index] ||
            item.displayLabel === frequencies[index]
        )
        if (!employee) throw new Error(`未找到在职员工：${employees[index]}`)
        if (!frequency) throw new Error(`未找到重复配置：${frequencies[index]}`)
        assignments.push({
          controlLevel: levels[index]!,
          responsibleEmployeeId: employee.id,
          duplicateConfigurationId: frequency.id,
          controlMeasure: requirements[index] || null,
          sort: index + 1
        })
      }
      await saveRiskControlPlan({
        riskPointId: point.id,
        controlStartAt: raw.controlStartAt
          ? dayjs(raw.controlStartAt).toISOString()
          : dayjs().toISOString(),
        status: raw.status === '已停用' || raw.status === 'suspended' ? 'suspended' : 'active',
        controlDescription: raw.controlDescription || null,
        assignments
      })
    }
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlRiskClassificationControl:Add',
      type: 'add',
      label: '新增管控设置',
      onClick: () => void openDialog()
    },
    {
      permission: 'SmisDualControlRiskClassificationControl:Import',
      type: 'import',
      importColumns: excelColumns,
      importApi: importRows,
      onImportError: () => void ElMessage.error('导入失败，请检查风险点编号、员工、层级与重复配置')
    },
    {
      permission: 'SmisDualControlRiskClassificationControl:Export',
      type: 'export',
      exportFilename: '风险分级管控',
      exportSheetName: '分级管控',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: (await loadAllDocumentPages(fetchRiskControlPointList, { ...searchQuery.value })).map(
          (row) => ({
            ...row,
            accidentTypes: row.accidentTypes.join('、'),
            controlLevels: row.assignments
              .map((item) => controlLevelLabel.get(item.controlLevel))
              .join('|'),
            responsibleEmployees: row.assignments
              .map((item) => item.responsibleEmployeeNo || item.responsibleEmployeeName)
              .join('|'),
            frequencies: row.assignments.map((item) => item.frequencyLabel).join('|'),
            levelRequirements: row.assignments.map((item) => item.controlMeasure || '').join('|'),
            controlStartAt: row.controlStartAt
              ? dayjs(row.controlStartAt).format('YYYY-MM-DD HH:mm')
              : '',
            status:
              statusOptions.find((item) => item.value === row.controlStatus)?.label ||
              row.controlStatus
          })
        )
      })
    },
    {
      permission: 'SmisDualControlRiskClassificationControl:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除或停用选中的 ${selectedCount} 项管控配置吗？已有任务的配置将停用并保留审计。`,
      disabled: ({ selectedRows }: ArtTableQueryHeaderActionContext) =>
        !(selectedRows as SmisRiskControlPoint[]).some((row) => row.planId),
      onClick: async ({ selectedRows, api }) => {
        await deletePlanRecords({
          resources: (selectedRows as SmisRiskControlPoint[])
            .filter((row) => Boolean(row.planId))
            .map((row) => ({
              id: String(row.planId ?? ''),
              label: String(row.riskPointName ?? '业务记录')
            })),
          permission: 'SmisDualControlRiskClassificationControl:Delete',
          remove: async () => {
            await deleteRiskControlPlans(
              (selectedRows as SmisRiskControlPoint[]).flatMap((row) =>
                row.planId ? [row.planId] : []
              )
            )
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }
  const handleDelete = async (row: SmisRiskControlPoint): Promise<void> => {
    const planId = row.planId
    if (!planId) return
    await deletePlanRecords({
      resources: [{ id: planId, label: row.riskPointName }],
      permission: 'SmisDualControlRiskClassificationControl:Delete',
      remove: () => deleteRiskControlPlans([planId]),
      onDeleted: () => tableQueryRef.value?.refreshRemove() ?? Promise.resolve()
    })
  }
  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('smisRiskPointType'),
      userStore.ensureDictLoaded('smisAccidentCategory'),
      userStore.ensureDictLoaded('smisRiskControlStatus'),
      loadOptions()
    ])
  })
</script>

<style scoped lang="scss">
  .risk-control-page {
    gap: 12px;
    min-width: 0;

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.risk-control-page__code) {
      font-size: 12px;
      color: var(--theme-color);
    }

    :deep(.risk-control-page__tags) {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    :deep(.risk-control-page__stack) {
      display: grid;
      gap: 4px;
    }

    :deep(.risk-control-page__stack > span) {
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }

    :deep(.risk-control-page__stack b) {
      font-weight: 500;
    }

    :deep(.risk-control-page__stack small) {
      color: var(--el-text-color-secondary);
    }

    :deep(.risk-control-page__level) {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-weight: 600;
    }

    :deep(.risk-control-page__level::before) {
      width: 8px;
      height: 8px;
      content: '';
      background: var(--risk-color);
      border-radius: 50%;
    }

    :deep(.risk-control-page__count) {
      color: var(--theme-color);
    }

    :deep(.risk-control-page__muted) {
      color: var(--el-text-color-placeholder);
    }
  }
</style>
