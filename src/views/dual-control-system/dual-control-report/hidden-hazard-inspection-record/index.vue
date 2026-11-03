<template>
  <ArtPermissionGuard permission="SmisDualControlHiddenHazardInspectionRecord:View">
    <div class="inspection-record-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="INSPECTION RECORDS"
        title="隐患排查记录"
        description="按执行人汇总风险巡查任务，并下钻核对排查周期、执行结果和异常明细。"
        icon="ri:file-search-line"
        density="compact"
        :tags="[
          { label: '人员穿透', type: 'primary', effect: 'plain' },
          { label: '周期归集', type: 'success', effect: 'light' },
          { label: '异常可追溯', type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions>
          <ArtExcelExport
            v-auth="'SmisDualControlHiddenHazardInspectionRecord:Export'"
            :data="exportRows"
            :columns="exportColumns"
            filename="隐患排查记录"
            sheet-name="排查任务明细"
            button-text="导出记录"
            type="primary"
            plain
            auto-index
          >
            <ArtSvgIcon icon="ri:file-excel-2-line" /> 导出记录
          </ArtExcelExport>
        </template>
      </BusinessWorkspaceHeader>

      <ElScrollbar class="inspection-record-page__scroll">
        <div class="inspection-record-page__body">
          <ArtSearchBar
            v-model="query"
            :items="searchItems"
            :span="5"
            label-position="top"
            :is-expand="true"
            :show-expand="false"
            :disabled-search="state.loading"
            @search="loadData"
            @reset="resetQuery"
          />

          <ReportDefinitionStrip
            description="排除已取消任务；执行人优先取实际执行人，其次取当前承接人。"
          />

          <ArtSectionCard
            title="执行人任务概览"
            subtitle="点击行尾查看按钮，在侧边抽屉核对任务级排查记录"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.loading && !state.error && !state.data.personnelStats.length"
            empty-title="当前范围暂无排查人员"
            empty-description="调整计划日期、组织或执行人条件后重新查询。"
            :min-height="300"
            @retry="loadData"
          >
            <ArtTable
              :data="state.data.personnelStats"
              :columns="personnelColumns"
              :pagination="false"
              table-layout="fixed"
              max-height="330"
              empty-text="暂无执行人统计"
            />
          </ArtSectionCard>
        </div>
      </ElScrollbar>

      <InspectionRecordDetailDrawer ref="detailDrawerRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { emptyHiddenHazardInspectionRecord } from '@smis/domain/report-defaults'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import dayjs from 'dayjs'
  import { ElProgress } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import ArtSearchBar, {
    type SearchFormItem
  } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtExcelExport from '@/components/core/forms/art-excel-export/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchHiddenHazardInspectionRecord,
    type SmisHiddenHazardInspectionPersonnelStat,
    type SmisHiddenHazardInspectionRecordResult
  } from '@smis/api'
  import { toDualControlOrganizationTree } from '../../shared/organization-tree'
  import ReportDefinitionStrip from '../shared/report-definition-strip.vue'
  import InspectionRecordDetailDrawer, {
    type InspectionRecordDetailDrawerExpose
  } from './modules/inspection-record-detail-drawer.vue'

  const smisSpecialEquipmentFilterOptions = useDictionaryOptions(
    'smisSpecialEquipmentFilter',
    (value) => value === 'true'
  )

  defineOptions({ name: 'SmisDualControlHiddenHazardInspectionRecord' })

  interface RecordQuery extends Record<string, unknown> {
    plannedRange?: [string, string]
    organizationId?: string
    executorKeyword?: string
    isSpecialEquipment?: boolean | ''
  }

  const initialQuery = (): RecordQuery => ({
    plannedRange: [
      dayjs().startOf('month').format('YYYY-MM-DD'),
      dayjs().endOf('month').format('YYYY-MM-DD')
    ],
    organizationId: undefined,
    executorKeyword: '',
    isSpecialEquipment: ''
  })
  const query = ref<RecordQuery>(initialQuery())
  const userStore = useUserStore()
  const state = reactive<{
    loading: boolean
    error: string | null
    data: SmisHiddenHazardInspectionRecordResult
  }>({ loading: false, error: null, data: emptyHiddenHazardInspectionRecord() })
  const detailDrawerRef = ref<InspectionRecordDetailDrawerExpose>()
  const employeeKey = (employeeId?: string | null, employeeNo?: string): string =>
    employeeId || employeeNo || '__unassigned__'
  const organizationOptions = computed(() =>
    toDualControlOrganizationTree(state.data.organizationOptions)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '执行人',
      key: 'executorKeyword',
      span: 5,
      type: 'input',
      props: { clearable: true, placeholder: '姓名 / 工号' }
    },
    {
      label: '计划排查时间',
      key: 'plannedRange',
      span: 7,
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        clearable: true
      }
    },
    {
      label: '所属组织',
      key: 'organizationId',
      span: 5,
      type: 'treeSelect',
      props: {
        data: organizationOptions.value,
        props: { label: 'organizationName', value: 'id', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        filterable: true,
        clearable: true,
        defaultExpandAll: true,
        placeholder: '全部组织（含下级）'
      }
    },
    {
      label: '设备范围',
      key: 'isSpecialEquipment',
      span: 4,
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部设备',
        options: smisSpecialEquipmentFilterOptions
      }
    }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '执行人数',
      value: state.data.overview.inspectorCount,
      description: '当前统计范围',
      icon: 'ri:team-line'
    },
    {
      label: '排查任务',
      value: state.data.overview.taskCount,
      description: '已排除取消任务',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '完成率',
      value: `${state.data.overview.completionRate}%`,
      description: `${state.data.overview.completedCount} 项已完成`,
      icon: 'ri:progress-4-line',
      tone: state.data.overview.completionRate >= 90 ? 'success' : 'warning'
    },
    {
      label: '逾期任务',
      value: state.data.overview.overdueCount,
      description: '已超过计划结束时间',
      icon: 'ri:alarm-warning-line',
      tone: state.data.overview.overdueCount ? 'danger' : 'success'
    },
    {
      label: '异常任务',
      value: state.data.overview.abnormalTaskCount,
      description: '包含异常排查项',
      icon: 'ri:error-warning-line',
      tone: state.data.overview.abnormalTaskCount ? 'warning' : 'success'
    }
  ])
  const selectInspector = (row: SmisHiddenHazardInspectionPersonnelStat): void => {
    const key = employeeKey(row.employeeId, row.employeeNo)
    void detailDrawerRef.value?.handleOpen({
      inspector: row,
      details: state.data.details.filter(
        (item) => employeeKey(item.employeeId, item.employeeNo) === key
      )
    })
  }
  const formatDateTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })

  const frequencyLabel = (unit: string, count: number): string =>
    `${count || 1}${({ shift: '班', day: '日', week: '周', ten_day: '旬', month: '月', quarter: '季', year: '年' } as Record<string, string>)[unit] || unit}`
  const personnelColumns: ColumnOption<SmisHiddenHazardInspectionPersonnelStat>[] = [
    { type: 'globalIndex', label: '序号', width: 66 },
    {
      prop: 'employeeName',
      label: '排查人',
      width: 116,
      fixed: 'left',
      link: {
        permission: 'SmisDualControlHiddenHazardInspectionRecord:ViewDetail',
        onClick: selectInspector
      }
    },
    { prop: 'employeeNo', label: '工号', width: 126 },
    { prop: 'organizationName', label: '所属组织', minWidth: 170, showOverflowTooltip: true },
    { prop: 'positionName', label: '岗位', minWidth: 140, showOverflowTooltip: true },
    { prop: 'taskCount', label: '任务总数', width: 96, align: 'right' },
    { prop: 'completedCount', label: '已完成', width: 88, align: 'right' },
    { prop: 'abnormalTaskCount', label: '异常', width: 78, align: 'right' },
    { prop: 'cycleCounts.shift', label: '班', width: 66, align: 'right' },
    { prop: 'cycleCounts.day', label: '日', width: 66, align: 'right' },
    { prop: 'cycleCounts.week', label: '周', width: 66, align: 'right' },
    { prop: 'cycleCounts.month', label: '月', width: 66, align: 'right' },
    { prop: 'cycleCounts.quarter', label: '季', width: 66, align: 'right' },
    { prop: 'cycleCounts.year', label: '年', width: 66, align: 'right' },
    {
      prop: 'completionRate',
      label: '完成率',
      width: 150,
      formatter: (row) => (
        <div class="mx-auto w-[126px]">
          <ElProgress percentage={row.completionRate} strokeWidth={7} />
        </div>
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 76,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonTable
          type="view"
          label="明细"
          permission="SmisDualControlHiddenHazardInspectionRecord:ViewDetail"
          onClick={() => selectInspector(row)}
        />
      )
    }
  ]
  const exportRows = computed(() =>
    state.data.details.map((row) => ({
      ...row,
      status:
        userStore.getDictLabelByValue('smisRiskInspectionTaskStatus', row.status) || '未识别状态',
      frequency: frequencyLabel(row.frequencyUnit, row.repeatFrequency),
      plannedStartAt: formatDateTime(row.plannedStartAt),
      plannedEndAt: formatDateTime(row.plannedEndAt),
      completedAt: formatDateTime(row.completedAt),
      specialEquipment: row.specialEquipment ? '是' : '否'
    }))
  )
  const exportColumns = {
    taskNo: { title: '任务编号', width: 22 },
    employeeName: { title: '排查人' },
    employeeNo: { title: '工号' },
    organizationName: { title: '所属组织', width: 22 },
    positionName: { title: '岗位' },
    riskPointName: { title: '排查对象', width: 22 },
    equipmentName: { title: '设备/设施', width: 24 },
    specialEquipment: { title: '特种设备' },
    plannedStartAt: { title: '计划开始', width: 20 },
    plannedEndAt: { title: '计划结束', width: 20 },
    completedAt: { title: '实际完成', width: 20 },
    status: { title: '状态' },
    frequency: { title: '周期' },
    riskLevelNames: { title: '风险级别' },
    inspectionContent: { title: '排查项目', width: 38 },
    controlMeasures: { title: '排查标准', width: 38 },
    itemCount: { title: '排查项' },
    normalCount: { title: '正常' },
    abnormalCount: { title: '异常' }
  }
  const loadData = async (): Promise<void> => {
    state.loading = true
    state.error = null
    try {
      const result = await fetchHiddenHazardInspectionRecord({
        plannedFrom: query.value.plannedRange?.[0],
        plannedTo: query.value.plannedRange?.[1]
          ? `${query.value.plannedRange[1]}T23:59:59`
          : undefined,
        organizationId: query.value.organizationId,
        executorKeyword: query.value.executorKeyword,
        isSpecialEquipment: query.value.isSpecialEquipment
      })
      const organizationOptions = result.organizationOptions.length
        ? result.organizationOptions
        : state.data.organizationOptions
      state.data = { ...result, organizationOptions }
      if (result.error) state.error = '隐患排查记录加载失败，请重试。'
    } catch {
      state.error = '隐患排查记录加载失败，请重试。'
    } finally {
      state.loading = false
    }
  }
  const resetQuery = (): void => {
    Object.assign(query.value, initialQuery())
    void loadData()
  }
  onMounted(async () => {
    await userStore.ensureDictLoaded('smisRiskInspectionTaskStatus')
    await loadData()
  })
</script>

<style scoped lang="scss">
  .inspection-record-page {
    min-width: 0;
    min-height: 0;

    &__scroll {
      flex: 1;
      min-height: 0;
    }

    &__body {
      display: grid;
      gap: var(--art-space-4);
      min-width: 0;
      padding-bottom: var(--art-space-1);
    }
  }
</style>
