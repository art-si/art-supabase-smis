<template>
  <ArtPermissionGuard permission="SmisSafetyAccidentStatistics:View">
    <div class="accident-statistics-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="ACCIDENT INSIGHTS"
        title="安全事故统计"
        description="按时间、事故级别、事故类别和发生组织汇总事故快报，识别重点风险与变化趋势。"
        icon="ri:bar-chart-box-line"
        :tags="[
          { label: '事故快报统一口径', type: 'primary', effect: 'plain' },
          { label: '多维趋势分析', type: 'success', effect: 'light' },
          { label: '租户数据隔离', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      />

      <ElScrollbar class="accident-statistics-page__scroll">
        <div class="accident-statistics-page__body">
          <ArtSearchBar
            :model-value="query"
            @update:model-value="replaceReactiveModel(query, $event)"
            :items="searchItems"
            :span="8"
            label-position="top"
            :show-expand="false"
            :disabled-search="state.loading"
            @search="loadData"
            @reset="resetQuery"
          />

          <div class="accident-statistics-page__charts">
            <ArtSectionCard
              class="accident-statistics-page__trend"
              title="事故发生趋势"
              subtitle="按月汇总筛选范围内事故快报数量"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.trend.length"
              empty-title="当前范围暂无事故趋势"
              empty-description="调整日期或组织范围后重新查询。"
              :min-height="350"
              @retry="loadData"
            >
              <template #actions>
                <ElTag type="primary" effect="plain">{{ trendTotal }} 起事故</ElTag>
              </template>
              <ArtLineChart
                height="300px"
                :x-axis-data="trendLabels"
                :data="trendValues"
                show-area-color
                symbol="circle"
                :symbol-size="7"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="事故级别构成"
              subtitle="对比各事故级别在筛选范围内的占比"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.levels.length"
              empty-title="暂无事故级别数据"
              empty-description="事故快报建立后会自动形成级别构成。"
              :min-height="350"
              @retry="loadData"
            >
              <ArtRingChart
                height="300px"
                :data="levelChartData"
                :center-text="`${state.data.overview.total} 起`"
                show-legend
                legend-position="right"
              />
            </ArtSectionCard>
          </div>

          <div class="accident-statistics-page__details">
            <ArtSectionCard
              title="事故类别分布"
              subtitle="优先展示事故数量较高的类别，快速定位主要风险类型"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.categories.length"
              empty-title="暂无事故类别数据"
              empty-description="事故快报维护类别后会自动汇总。"
              :min-height="340"
              @retry="loadData"
            >
              <ArtBarChart
                height="290px"
                :x-axis-data="categoryLabels"
                :data="categoryValues"
                :bar-width="28"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="事故发生组织"
              subtitle="按事故发生作业区汇总数量及较大以上事故"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.organizations.length"
              empty-title="暂无组织维度数据"
              empty-description="在事故快报中选择发生作业区后即可形成组织统计。"
              :min-height="340"
              @retry="loadData"
            >
              <ArtTable
                :data="state.data.organizations"
                :columns="organizationColumns"
                :pagination="false"
                table-layout="fixed"
                empty-text="暂无组织事故数据"
              />
            </ArtSectionCard>
          </div>
        </div>
      </ElScrollbar>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import dayjs from 'dayjs'
  import type { PieDataItem } from '@/types/component/chart'
  import type { ColumnOption } from '@/types'
  import ArtSearchBar, {
    type SearchFormItem
  } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtLineChart from '@/components/core/charts/art-line-chart/index.vue'
  import ArtRingChart from '@/components/core/charts/art-ring-chart/index.vue'
  import ArtBarChart from '@/components/core/charts/art-bar-chart/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    createEmptySafetyAccidentStatistics,
    fetchSafetyAccidentStatistics,
    type SmisSafetyAccidentOrganizationStat,
    type SmisSafetyAccidentStatisticsSearchParams,
    type SmisSafetyAccidentStatisticsResult
  } from '@smis/api'

  defineOptions({ name: 'SmisSafetyAccidentStatistics' })
  interface StatisticsQuery extends Record<string, unknown> {
    dateRange?: [string, string]
    organizationId?: string
  }

  const userStore = useUserStore()
  const initialQuery = (): StatisticsQuery => ({
    dateRange: [
      dayjs().startOf('year').format('YYYY-MM-DD'),
      dayjs().endOf('year').format('YYYY-MM-DD')
    ],
    organizationId: undefined
  })
  const query = reactive<StatisticsQuery>(initialQuery())
  const request = useAsyncState(
    async (
      params: SmisSafetyAccidentStatisticsSearchParams
    ): Promise<SmisSafetyAccidentStatisticsResult> => {
      const result = await fetchSafetyAccidentStatistics(params)
      return {
        ...result,
        organizationOptions: result.organizationOptions.length
          ? result.organizationOptions
          : request.state.value.organizationOptions
      }
    },
    createEmptySafetyAccidentStatistics(),
    { immediate: false, resetOnExecute: false, onError: () => undefined }
  )
  const state = reactive({
    loading: request.isLoading,
    error: computed(() => (request.error.value ? '事故统计加载失败，请重试。' : null)),
    data: request.state
  })

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '事故总数',
      value: state.data.overview.total,
      description: '当前筛选范围',
      icon: 'ri:file-warning-line'
    },
    {
      label: '本年事故',
      value: state.data.overview.currentYear,
      description: '按事故时间统计',
      icon: 'ri:calendar-event-line',
      tone: 'primary'
    },
    {
      label: '较大及以上',
      value: state.data.overview.highSeverity,
      description: '重点风险事故',
      icon: 'ri:alarm-warning-line',
      tone: state.data.overview.highSeverity ? 'danger' : undefined
    },
    {
      label: '涉及人员',
      value: state.data.overview.affectedPeople,
      description: '事故人员快照数量',
      icon: 'ri:team-line',
      tone: 'warning'
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
      label: '事故发生组织',
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
  const trendLabels = computed(() => state.data.trend.map((item) => item.label))
  const trendValues = computed(() => state.data.trend.map((item) => item.count))
  const trendTotal = computed(() => trendValues.value.reduce((total, count) => total + count, 0))
  const levelChartData = computed<PieDataItem[]>(() =>
    state.data.levels.map((item) => ({
      name: userStore.getDictLabelByValue('smisAccidentLevel', item.value) || item.value,
      value: item.count
    }))
  )
  const visibleCategories = computed(() => state.data.categories.slice(0, 10))
  const categoryLabels = computed(() =>
    visibleCategories.value.map(
      (item) => userStore.getDictLabelByValue('smisAccidentCategory', item.value) || item.value
    )
  )
  const categoryValues = computed(() => visibleCategories.value.map((item) => item.count))
  const organizationColumns: ColumnOption<SmisSafetyAccidentOrganizationStat>[] = [
    { type: 'globalIndex', label: '序号', width: 72 },
    {
      prop: 'organizationName',
      label: '事故发生组织',
      minWidth: 190,
      showOverflowTooltip: true
    },
    { prop: 'count', label: '事故数', width: 100, align: 'right' },
    { prop: 'highSeverity', label: '较大及以上', width: 120, align: 'right' }
  ]

  const loadData = async (): Promise<void> => {
    await request.execute(0, {
      startDate: query.dateRange?.[0],
      endDate: query.dateRange?.[1],
      organizationId: query.organizationId
    })
  }
  const resetQuery = (): void => {
    Object.assign(query, initialQuery())
    void loadData()
  }

  onMounted(async () => {
    await Promise.all(
      ['smisAccidentCategory', 'smisAccidentLevel'].map((code) => userStore.ensureDictLoaded(code))
    )
    await loadData()
  })
</script>

<style scoped lang="scss">
  .accident-statistics-page {
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
