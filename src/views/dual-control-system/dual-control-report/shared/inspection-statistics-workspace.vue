<template>
  <ArtPermissionGuard :permission="pagePermission">
    <div class="inspection-statistics-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        :eyebrow="content.eyebrow"
        :title="content.title"
        :description="content.description"
        :icon="content.icon"
        density="compact"
        :tags="content.tags"
        :metrics="metrics"
      >
        <template #actions>
          <ArtExcelExport
            v-auth="exportPermission"
            :data="exportRows"
            :columns="exportColumns"
            :filename="content.title"
            sheet-name="组织统计"
            button-text="导出统计"
            type="primary"
            plain
            auto-index
          >
            <ArtSvgIcon icon="ri:file-excel-2-line" /> 导出统计
          </ArtExcelExport>
        </template>
      </BusinessWorkspaceHeader>

      <ElScrollbar class="inspection-statistics-page__scroll">
        <div class="inspection-statistics-page__body">
          <ArtSearchBar
            v-model="query"
            :items="searchItems"
            :span="7"
            label-position="top"
            :is-expand="true"
            :show-expand="false"
            :disabled-search="state.loading"
            @search="loadData"
            @reset="resetQuery"
          />

          <ReportDefinitionStrip :description="content.definition" />

          <div class="inspection-statistics-page__workspace">
            <ArtSectionCard
              class="inspection-statistics-page__table-card"
              :title="content.tableTitle"
              :subtitle="content.tableSubtitle"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.organizationStats.length"
              :empty-title="content.emptyTitle"
              empty-description="调整计划日期、组织或风险级别后重新查询。"
              :min-height="430"
              @retry="loadData"
            >
              <ArtTable
                :data="state.data.organizationStats"
                :columns="organizationColumns"
                :pagination="false"
                table-layout="fixed"
                max-height="440"
                :empty-text="content.emptyTitle"
              />
            </ArtSectionCard>

            <ArtSectionCard
              :title="content.chartTitle"
              :subtitle="content.chartSubtitle"
              :loading="state.loading"
              :error="state.error"
              :empty="
                !state.loading &&
                !state.error &&
                (!state.data.organizationStats.length || !hasChartValues)
              "
              :empty-title="
                state.data.organizationStats.length
                  ? `当前组织${content.rateLabel}均为 0%`
                  : content.emptyTitle
              "
              :empty-description="
                state.data.organizationStats.length
                  ? content.zeroChartDescription
                  : '形成风险巡查任务后会自动生成组织对比。'
              "
              :min-height="430"
              @retry="loadData"
            >
              <ArtBarChart
                height="365px"
                :x-axis-data="chartLabels"
                :data="chartValues"
                :bar-width="30"
                :y-axis-min="0"
                :y-axis-max="100"
                value-suffix="%"
              />
            </ArtSectionCard>
          </div>
        </div>
      </ElScrollbar>

      <InspectionStatisticsDetailDialog ref="detailRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { emptyInspectionStatistics } from '@smis/domain/report-defaults'
  import { formatPercentValue } from '@/utils/ui/format'
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
  import ArtBarChart from '@/components/core/charts/art-bar-chart/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchRiskInspectionStatistics,
    type SmisInspectionOrganizationStat,
    type SmisInspectionStatisticsReportType,
    type SmisInspectionStatisticsResult
  } from '@smis/api'
  import { toDualControlOrganizationTree } from '../../shared/organization-tree'
  import InspectionStatisticsDetailDialog, {
    type InspectionStatisticsDetailOpenData
  } from './inspection-statistics-detail-dialog.vue'
  import ReportDefinitionStrip from './report-definition-strip.vue'

  const props = defineProps<{
    reportType: SmisInspectionStatisticsReportType
    pagePermission: string
    detailPermission: string
    exportPermission: string
  }>()

  interface StatisticsQuery extends Record<string, unknown> {
    plannedRange?: [string, string]
    organizationId?: string
    riskLevel?: string
  }
  interface StatisticsState {
    loading: boolean
    error: string | null
    data: SmisInspectionStatisticsResult
  }
  interface ReportContent {
    eyebrow: string
    title: string
    description: string
    icon: string
    tags: BusinessWorkspaceTag[]
    definition: string
    tableTitle: string
    tableSubtitle: string
    chartTitle: string
    chartSubtitle: string
    emptyTitle: string
    rateLabel: string
    zeroChartDescription: string
  }
  interface DetailExpose {
    handleOpen: (data: InspectionStatisticsDetailOpenData) => Promise<void>
  }

  const detailRef = ref<DetailExpose>()
  const contentMap: Record<SmisInspectionStatisticsReportType, ReportContent> = {
    inspection_rate: {
      eyebrow: 'INSPECTION COVERAGE INSIGHTS',
      title: '排查率统计',
      description: '按执行人所属组织对比风险巡查任务生成、完成与待排查数量，定位覆盖薄弱组织。',
      icon: 'ri:bar-chart-2-line',
      tags: [
        { label: '已生成任务为分母', type: 'primary', effect: 'plain' },
        { label: '组织穿透筛选', type: 'success', effect: 'light' },
        { label: '明细可追溯', type: 'info', effect: 'plain' }
      ],
      definition:
        '排查率 = 已完成风险巡查任务数 ÷ 已生成且未取消的任务数。组织按实际执行人优先、计划执行人兜底归属。',
      tableTitle: '组织排查率',
      tableSubtitle: '对比已生成、已完成、待排查任务与排查率，可进入明细核对任务和人员问题',
      chartTitle: '排查率对比',
      chartSubtitle: '以百分比对比各组织风险巡查覆盖情况',
      emptyTitle: '当前范围暂无风险巡查任务',
      rateLabel: '排查率',
      zeroChartDescription: '任务已经生成，当前尚无已完成的排查任务。'
    },
    missed_rate: {
      eyebrow: 'MISSED INSPECTION INSIGHTS',
      title: '漏查率统计',
      description: '识别超过计划结束时间仍未完成的风险巡查任务，聚焦重复漏查风险点与责任人员。',
      icon: 'ri:alarm-warning-line',
      tags: [
        { label: '逾期自动识别', type: 'danger', effect: 'plain' },
        { label: '重复漏查聚焦', type: 'warning', effect: 'light' },
        { label: '人员问题钻取', type: 'info', effect: 'plain' }
      ],
      definition:
        '漏查率 = 超过计划结束时间且未完成的任务数 ÷ 已生成且未取消的任务数；同一风险点在筛选期内再次漏查计为重复漏查。',
      tableTitle: '组织漏查率',
      tableSubtitle: '对比生成任务、漏查任务、漏查风险点、涉及人员与重复漏查情况',
      chartTitle: '漏查率对比',
      chartSubtitle: '数值越高代表计划时限内未完成的任务占比越高',
      emptyTitle: '当前范围暂无可统计任务',
      rateLabel: '漏查率',
      zeroChartDescription: '当前没有超过计划结束时间仍未完成的任务。'
    }
  }
  const content = computed(() => contentMap[props.reportType])
  const { pagePermission, detailPermission, exportPermission } = toRefs(props)
  const initialQuery = (): StatisticsQuery => ({
    plannedRange: [
      dayjs().startOf('month').format('YYYY-MM-DD'),
      dayjs().endOf('month').format('YYYY-MM-DD')
    ],
    organizationId: undefined,
    riskLevel: undefined
  })

  const query = ref<StatisticsQuery>(initialQuery())
  const state = reactive<StatisticsState>({
    loading: false,
    error: null,
    data: emptyInspectionStatistics()
  })
  const organizationOptions = computed(() =>
    toDualControlOrganizationTree(state.data.organizationOptions)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '执行组织',
      key: 'organizationId',
      span: 6,
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
      label: '计划排查时间',
      key: 'plannedRange',
      span: 8,
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
      label: '风险级别',
      key: 'riskLevel',
      span: 6,
      type: 'select',
      props: {
        options: state.data.riskLevelOptions,
        clearable: true,
        placeholder: '全部风险级别'
      }
    }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => {
    const overview = state.data.overview
    if (props.reportType === 'missed_rate') {
      return [
        {
          label: '漏查率',
          value: `${overview.missedRate}%`,
          description: `${overview.missedCount}/${overview.generatedCount} 项漏查`,
          icon: 'ri:percent-line',
          tone: overview.missedRate ? 'danger' : 'success'
        },
        {
          label: '漏查任务',
          value: overview.missedCount,
          description: '超过计划结束时间',
          icon: 'ri:alarm-warning-line',
          tone: overview.missedCount ? 'danger' : 'success'
        },
        {
          label: '重复漏查',
          value: overview.repeatedMissedCount,
          description: '同一风险点再次漏查',
          icon: 'ri:loop-left-line',
          tone: overview.repeatedMissedCount ? 'warning' : 'info'
        },
        {
          label: '覆盖组织',
          value: overview.organizationCount,
          description: '当前统计范围',
          icon: 'ri:organization-chart'
        }
      ]
    }
    return [
      {
        label: '排查率',
        value: `${overview.inspectionRate}%`,
        description: `${overview.completedCount}/${overview.generatedCount} 项完成`,
        icon: 'ri:percent-line',
        tone: overview.inspectionRate >= 90 ? 'success' : 'warning'
      },
      {
        label: '已生成任务',
        value: overview.generatedCount,
        description: '已排除取消任务',
        icon: 'ri:file-list-3-line'
      },
      {
        label: '已完成任务',
        value: overview.completedCount,
        description: '已提交排查结果',
        icon: 'ri:checkbox-circle-line',
        tone: 'success'
      },
      {
        label: '待排查任务',
        value: overview.pendingCount,
        description: '未开始、进行中或逾期',
        icon: 'ri:time-line',
        tone: overview.pendingCount ? 'warning' : 'success'
      }
    ]
  })
  const chartLabels = computed(() =>
    state.data.organizationStats.map((item) => item.organizationName)
  )
  const chartValues = computed(() =>
    state.data.organizationStats.map((item) =>
      props.reportType === 'inspection_rate' ? item.inspectionRate : item.missedRate
    )
  )
  const hasChartValues = computed(() => chartValues.value.some((value) => value > 0))
  const openDetail = (row: SmisInspectionOrganizationStat): void => {
    if (!row.organizationId) return
    void detailRef.value?.handleOpen({
      reportType: props.reportType,
      row,
      plannedFrom: query.value.plannedRange?.[0],
      plannedTo: query.value.plannedRange?.[1]
        ? `${query.value.plannedRange[1]}T23:59:59`
        : undefined,
      riskLevel: query.value.riskLevel
    })
  }
  const commonColumns: ColumnOption<SmisInspectionOrganizationStat>[] = [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'organizationName',
      label: '组织名称',
      minWidth: 170,
      fixed: 'left',
      showOverflowTooltip: true,
      link: {
        permission: detailPermission.value,
        disabled: (row) => !row.organizationId,
        onClick: openDetail
      }
    },
    { prop: 'generatedCount', label: '已生成任务', width: 112, align: 'right' }
  ]
  const organizationColumns = computed<ColumnOption<SmisInspectionOrganizationStat>[]>(() => {
    const rateColumns: ColumnOption<SmisInspectionOrganizationStat>[] =
      props.reportType === 'inspection_rate'
        ? [
            { prop: 'completedCount', label: '已排查任务', width: 112, align: 'right' },
            { prop: 'pendingCount', label: '未排查任务', width: 112, align: 'right' },
            {
              prop: 'inspectionRate',
              label: '排查率',
              width: 166,
              formatter: (row) => (
                <div class="inspection-statistics-page__rate-cell">
                  <ElProgress
                    percentage={row.inspectionRate}
                    format={(value) => formatPercentValue(value, { fractionDigits: 2 })}
                    strokeWidth={7}
                    color={
                      row.inspectionRate >= 90 ? 'var(--el-color-success)' : 'var(--theme-color)'
                    }
                  />
                </div>
              )
            }
          ]
        : [
            { prop: 'missedCount', label: '漏查任务', width: 104, align: 'right' },
            { prop: 'missedPointCount', label: '漏查风险点', width: 112, align: 'right' },
            { prop: 'missedExecutorCount', label: '涉及人员', width: 96, align: 'right' },
            {
              prop: 'missedRate',
              label: '漏查率',
              width: 96,
              align: 'right',
              formatter: (row) => formatPercentValue(row.missedRate, { fractionDigits: 2 })
            },
            { prop: 'repeatedMissedCount', label: '重复漏查', width: 104, align: 'right' },
            {
              prop: 'repeatRate',
              label: '重复漏查率',
              width: 120,
              align: 'right',
              formatter: (row) => formatPercentValue(row.repeatRate, { fractionDigits: 2 })
            }
          ]
    return [
      ...commonColumns,
      ...rateColumns,
      {
        prop: 'operation',
        label: '操作',
        width: 76,
        fixed: 'right',
        formatter: (row) =>
          row.organizationId ? (
            <ArtButtonTable
              type="view"
              label="详情"
              permission={detailPermission.value}
              onClick={() => openDetail(row)}
            />
          ) : (
            '—'
          )
      }
    ]
  })
  const exportRows = computed(() =>
    state.data.organizationStats.map((row) => ({
      ...row,
      inspectionRate: formatPercentValue(row.inspectionRate, { fractionDigits: 2 }),
      missedRate: formatPercentValue(row.missedRate, { fractionDigits: 2 }),
      repeatRate: formatPercentValue(row.repeatRate, { fractionDigits: 2 })
    }))
  )
  const exportColumns = computed<Record<string, { title: string; width?: number }>>(() => {
    const columns: Record<string, { title: string; width?: number }> = {
      organizationName: { title: '组织名称', width: 24 },
      generatedCount: { title: '已生成任务' }
    }

    if (props.reportType === 'inspection_rate') {
      columns.completedCount = { title: '已排查任务' }
      columns.pendingCount = { title: '未排查任务' }
      columns.inspectionRate = { title: '排查率' }
      return columns
    }

    columns.missedCount = { title: '漏查任务' }
    columns.missedPointCount = { title: '漏查风险点' }
    columns.missedExecutorCount = { title: '涉及人员' }
    columns.missedRate = { title: '漏查率' }
    columns.repeatedMissedCount = { title: '重复漏查' }
    columns.repeatRate = { title: '重复漏查率' }
    return columns
  })

  const loadData = async (): Promise<void> => {
    state.loading = true
    state.error = null
    try {
      const result = await fetchRiskInspectionStatistics({
        reportType: props.reportType,
        plannedFrom: query.value.plannedRange?.[0],
        plannedTo: query.value.plannedRange?.[1]
          ? `${query.value.plannedRange[1]}T23:59:59`
          : undefined,
        organizationId: query.value.organizationId,
        riskLevel: query.value.riskLevel
      })
      const organizations = result.organizationOptions.length
        ? result.organizationOptions
        : state.data.organizationOptions
      const riskLevels = result.riskLevelOptions.length
        ? result.riskLevelOptions
        : state.data.riskLevelOptions
      state.data = {
        ...result,
        organizationOptions: organizations,
        riskLevelOptions: riskLevels
      }
      if (result.error) state.error = `${content.value.title}加载失败，请重试。`
    } catch {
      state.error = `${content.value.title}加载失败，请重试。`
    } finally {
      state.loading = false
    }
  }
  const resetQuery = (): void => {
    Object.assign(query.value, initialQuery())
    void loadData()
  }

  onMounted(() => void loadData())
</script>

<style scoped lang="scss">
  .inspection-statistics-page {
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

    &__workspace {
      display: grid;
      grid-template-columns: minmax(560px, 1.35fr) minmax(360px, 0.85fr);
      gap: var(--art-space-4);
      min-width: 0;
    }

    &__table-card {
      min-width: 0;
    }

    &__rate-cell {
      width: 140px;
      margin-inline: auto;
    }

    @media (width <= 1180px) {
      &__workspace {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
