<template>
  <ArtPermissionGuard permission="SmisTrainingStatisticsReport:View">
    <div class="training-report-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="TRAINING INSIGHTS"
        title="培训统计报表"
        description="以培训计划、实施记录和签到事实为统一口径，分析计划兑现、参训覆盖与签到质量。"
        icon="ri:bar-chart-grouped-line"
        :tags="[
          { label: '计划与记录同源', type: 'primary', effect: 'plain' },
          { label: '参训人次口径', type: 'success', effect: 'light' },
          { label: '组织穿透统计', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions>
          <ArtExcelExport
            v-auth="'SmisTrainingStatisticsReport:Export'"
            :data="exportRows"
            :disabled="!state.ready"
            :columns="exportColumns"
            filename="安全培训统计报表"
            sheet-name="组织培训统计"
            button-text="导出报表"
            type="primary"
            plain
            auto-index
            ><ArtSvgIcon icon="ri:file-excel-2-line" /> 导出报表</ArtExcelExport
          >
        </template>
      </BusinessWorkspaceHeader>

      <ElScrollbar class="training-report-page__scroll">
        <div class="training-report-page__body">
          <ArtSearchBar
            v-model="query"
            :items="searchItems"
            :span="8"
            label-position="top"
            :show-expand="false"
            :disabled-search="state.loading"
            @search="loadData"
            @reset="resetQuery"
          />

          <div class="training-report-page__charts">
            <ArtSectionCard
              class="training-report-page__trend"
              title="培训执行趋势"
              subtitle="按月对比计划、正式记录和实际签到人次"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.monthlyTrend.length"
              empty-title="当前范围暂无培训趋势"
              empty-description="调整统计日期或组织范围后重新查询。"
              :min-height="360"
              @retry="loadData"
            >
              <template #actions
                ><ElTag type="primary" effect="plain"
                  >{{ state.data.overview.trainingHours }} 学时</ElTag
                ></template
              >
              <ArtLineChart
                height="305px"
                :x-axis-data="trendLabels"
                :data="trendSeries"
                show-legend
                legend-position="bottom"
                symbol="circle"
                :symbol-size="6"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="签到状态构成"
              subtitle="汇总已归档培训记录中的逐人签到状态"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.attendanceStats.length"
              empty-title="暂无签到数据"
              empty-description="培训记录提交后会自动形成签到构成。"
              :min-height="360"
              @retry="loadData"
            >
              <ArtRingChart
                height="305px"
                :data="attendanceChartData"
                :center-text="`${state.data.overview.actualPersonTimes} 人次`"
                show-legend
                legend-position="right"
              />
            </ArtSectionCard>
          </div>

          <div class="training-report-page__details">
            <ArtSectionCard
              title="培训维度分布"
              subtitle="切换培训类别、类型和形式，识别培训资源投入结构"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !dimensionStats.length"
              empty-title="暂无培训维度数据"
              empty-description="培训计划维护分类信息后会自动汇总。"
              :min-height="350"
              @retry="loadData"
            >
              <template #actions
                ><ElSegmented v-model="activeDimension" :options="dimensionOptions"
              /></template>
              <ArtBarChart
                height="295px"
                :x-axis-data="dimensionLabels"
                :data="dimensionValues"
                :bar-width="28"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="待兑现培训计划"
              subtitle="已发布但尚未提交正式培训记录的计划"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.outstandingPlans.length"
              empty-title="暂无待兑现计划"
              empty-description="当前范围内培训计划均已形成正式记录。"
              :min-height="350"
              @retry="loadData"
            >
              <ArtTable
                :data="state.data.outstandingPlans"
                :columns="outstandingColumns"
                :pagination="false"
                table-layout="fixed"
                max-height="295"
                empty-text="暂无待兑现计划"
              />
            </ArtSectionCard>
          </div>

          <ArtSectionCard
            title="组织培训执行报表"
            subtitle="按培训组织汇总计划、记录、计划人次、签到人次、学时与完成率"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.loading && !state.error && !state.data.organizationStats.length"
            empty-title="暂无组织培训统计"
            empty-description="当前筛选范围尚无可汇总的培训计划或记录。"
            :min-height="300"
            @retry="loadData"
          >
            <ArtTable
              :data="state.data.organizationStats"
              :columns="organizationColumns"
              :pagination="false"
              table-layout="fixed"
              empty-text="暂无组织培训统计"
            />
          </ArtSectionCard>
        </div>
      </ElScrollbar>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import dayjs from 'dayjs'
  import { useAsyncState } from '@vueuse/core'
  import type { BarDataItem, LineDataItem, PieDataItem } from '@/types/component/chart'
  import type { ColumnOption } from '@/types'
  import ArtSearchBar, {
    type SearchFormItem
  } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtLineChart from '@/components/core/charts/art-line-chart/index.vue'
  import ArtRingChart from '@/components/core/charts/art-ring-chart/index.vue'
  import ArtBarChart from '@/components/core/charts/art-bar-chart/index.vue'
  import ArtExcelExport from '@/components/core/forms/art-excel-export/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchSafetyTrainingReport,
    type SmisSafetyTrainingOrganizationStat,
    type SmisSafetyTrainingOutstandingPlan,
    type SmisSafetyTrainingReportResult
  } from '@smis/api'

  const formatTableDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisTrainingStatisticsReport' })
  type Dimension = 'trainingCategory' | 'trainingType' | 'trainingForm'
  interface ReportQuery extends Record<string, unknown> {
    dateRange?: [string, string]
    organizationId?: string
  }

  const userStore = useUserStore()
  const initialQuery = (): ReportQuery => ({
    dateRange: [
      dayjs().startOf('year').format('YYYY-MM-DD'),
      dayjs().endOf('year').format('YYYY-MM-DD')
    ],
    organizationId: undefined
  })
  const emptyData = (): SmisSafetyTrainingReportResult => ({
    overview: {
      planCount: 0,
      completedPlanCount: 0,
      recordCount: 0,
      plannedPersonTimes: 0,
      actualPersonTimes: 0,
      trainingHours: 0,
      outstandingCount: 0,
      completionRate: 0,
      attendanceRate: 0
    },
    organizationStats: [],
    monthlyTrend: [],
    categoryStats: [],
    attendanceStats: [],
    outstandingPlans: [],
    organizationOptions: []
  })
  const query = ref<ReportQuery>(initialQuery())
  const request = useAsyncState(
    async (params: Parameters<typeof fetchSafetyTrainingReport>[0]) => {
      const result = await fetchSafetyTrainingReport(params, { showErrorMessage: false })
      if (result.error) {
        throw new Error('培训统计报表加载失败，请重试。', { cause: result.error })
      }
      return result
    },
    emptyData(),
    {
      immediate: false,
      resetOnExecute: false,
      // The report cards own recoverable errors; preserve the diagnostic cause without a toast.
      onError: () => undefined
    }
  )
  const state = reactive({
    loading: request.isLoading,
    ready: request.isReady,
    error: computed(() => (request.error.value ? '培训统计报表加载失败，请重试。' : null)),
    data: request.state
  })
  const activeDimension = ref<Dimension>('trainingCategory')
  const dimensionOptions = [
    { label: '培训类别', value: 'trainingCategory' },
    { label: '培训类型', value: 'trainingType' },
    { label: '培训形式', value: 'trainingForm' }
  ]
  const dimensionDict: Record<Dimension, string> = {
    trainingCategory: 'smisSafetyTrainingCategory',
    trainingType: 'smisSafetyTrainingType',
    trainingForm: 'smisSafetyTrainingForm'
  }

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '计划兑现率',
      value: `${state.data.overview.completionRate}%`,
      description: `${state.data.overview.completedPlanCount}/${state.data.overview.planCount} 项完成`,
      icon: 'ri:progress-4-line',
      tone: state.data.overview.completionRate >= 90 ? 'success' : 'warning'
    },
    {
      label: '签到率',
      value: `${state.data.overview.attendanceRate}%`,
      description: `${state.data.overview.actualPersonTimes}/${state.data.overview.plannedPersonTimes} 人次`,
      icon: 'ri:user-follow-line',
      tone: state.data.overview.attendanceRate >= 90 ? 'success' : 'warning'
    },
    {
      label: '正式记录',
      value: state.data.overview.recordCount,
      description: '已归档培训记录',
      icon: 'ri:file-shield-2-line',
      tone: 'primary'
    },
    {
      label: '培训学时',
      value: state.data.overview.trainingHours,
      description: '正式记录累计学时',
      icon: 'ri:time-line'
    },
    {
      label: '待兑现',
      value: state.data.overview.outstandingCount,
      description: '已发布未归档计划',
      icon: 'ri:alarm-warning-line',
      tone: state.data.overview.outstandingCount ? 'danger' : 'success'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '统计日期',
      key: 'dateRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        clearable: true
      }
    },
    {
      label: '培训组织',
      key: 'organizationId',
      type: 'treeSelect',
      props: {
        data: state.data.organizationOptions,
        props: { label: 'organizationName', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        filterable: true,
        clearable: true,
        defaultExpandAll: true,
        placeholder: '全部组织（含下级）'
      }
    }
  ])
  const trendLabels = computed(() => state.data.monthlyTrend.map((item) => item.month))
  const trendSeries = computed<LineDataItem[]>(() => [
    { name: '培训计划', data: state.data.monthlyTrend.map((item) => item.planCount) },
    { name: '正式记录', data: state.data.monthlyTrend.map((item) => item.recordCount) },
    { name: '签到人次', data: state.data.monthlyTrend.map((item) => item.attendanceCount) }
  ])
  const attendanceChartData = computed<PieDataItem[]>(() =>
    state.data.attendanceStats.map((item) => ({
      name:
        userStore.getDictLabelByValue('smisSafetyTrainingAttendanceStatus', item.value) ||
        item.value,
      value: item.count
    }))
  )
  const dimensionStats = computed(() =>
    state.data.categoryStats.filter((item) => item.dimension === activeDimension.value).slice(0, 10)
  )
  const dimensionLabels = computed(() =>
    dimensionStats.value.map(
      (item) =>
        userStore.getDictLabelByValue(dimensionDict[activeDimension.value], item.value) ||
        item.value
    )
  )
  const dimensionValues = computed<BarDataItem[]>(() => [
    { name: '计划数', data: dimensionStats.value.map((item) => item.planCount) }
  ])
  const organizationColumns: ColumnOption<SmisSafetyTrainingOrganizationStat>[] = [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'organizationName',
      label: '培训组织',
      minWidth: 190,
      fixed: 'left',
      showOverflowTooltip: true
    },
    { prop: 'planCount', label: '计划数', width: 92, align: 'right' },
    { prop: 'recordCount', label: '记录数', width: 92, align: 'right' },
    { prop: 'plannedPersonTimes', label: '计划人次', width: 105, align: 'right' },
    { prop: 'actualPersonTimes', label: '签到人次', width: 105, align: 'right' },
    { prop: 'trainingHours', label: '培训学时', width: 105, align: 'right' },
    {
      prop: 'completionRate',
      label: '兑现率',
      width: 112,
      align: 'right',
      formatter: (row) => `${row.completionRate}%`
    },
    {
      prop: 'attendanceRate',
      label: '签到率',
      width: 112,
      align: 'right',
      formatter: (row) => `${row.attendanceRate}%`
    }
  ]
  const outstandingColumns: ColumnOption<SmisSafetyTrainingOutstandingPlan>[] = [
    { prop: 'subject', label: '培训计划', minWidth: 190, showOverflowTooltip: true },
    { prop: 'organizationName', label: '组织', minWidth: 130, showOverflowTooltip: true },
    { prop: 'participantCount', label: '人数', width: 72, align: 'right' },
    {
      prop: 'plannedEndAt',
      label: '计划结束',
      width: 112,
      formatter: (row) => formatTableDate(row.plannedEndAt)
    },
    {
      prop: 'warningStatus',
      label: '状态',
      width: 92,
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonWarningStatus" value={row.warningStatus} display="tag" />
      )
    }
  ]
  const exportRows = computed(() =>
    state.data.organizationStats.map((row) => ({
      organizationName: row.organizationName,
      planCount: row.planCount,
      recordCount: row.recordCount,
      plannedPersonTimes: row.plannedPersonTimes,
      actualPersonTimes: row.actualPersonTimes,
      trainingHours: row.trainingHours,
      completionRate: `${row.completionRate}%`,
      attendanceRate: `${row.attendanceRate}%`
    }))
  )
  const exportColumns = {
    organizationName: { title: '培训组织', width: 24 },
    planCount: { title: '计划数' },
    recordCount: { title: '记录数' },
    plannedPersonTimes: { title: '计划人次' },
    actualPersonTimes: { title: '签到人次' },
    trainingHours: { title: '培训学时' },
    completionRate: { title: '计划兑现率' },
    attendanceRate: { title: '签到率' }
  }
  const loadData = async (): Promise<void> => {
    await request.executeImmediate({
      startDate: query.value.dateRange?.[0],
      endDate: query.value.dateRange?.[1],
      organizationId: query.value.organizationId
    })
  }
  const resetQuery = (): void => {
    Object.assign(query.value, initialQuery())
    void loadData()
  }
  onMounted(async () => {
    await Promise.all(
      [
        'smisSafetyTrainingCategory',
        'smisSafetyTrainingType',
        'smisSafetyTrainingForm',
        'smisSafetyTrainingAttendanceStatus',
        'commonWarningStatus'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
    await loadData()
  })
</script>

<style scoped lang="scss">
  .training-report-page {
    min-width: 0;
    min-height: 0;

    &__scroll {
      flex: 1;
      min-height: 0;
    }

    &__body {
      display: grid;
      gap: 14px;
      min-width: 0;
      padding-bottom: 2px;
    }

    &__charts,
    &__details {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(340px, 0.8fr);
      gap: 14px;
      min-width: 0;
    }

    &__details {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (width <= 1100px) {
      &__charts,
      &__details {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
