<template>
  <div class="special-analysis business-workspace-page">
    <BusinessWorkspaceHeader
      eyebrow="SPECIAL EQUIPMENT ANALYTICS"
      title="特种设备统计分析"
      description="按使用部门聚合锅炉、特种设备与重大危险源，形成设备分类数量图表和部门分类报表。"
      icon="ri:bar-chart-grouped-line"
      :tags="[
        { label: '部门穿透查询', type: 'primary', effect: 'plain' },
        { label: '设备分类统计', type: 'success', effect: 'light' },
        { label: '租户数据隔离', type: 'info', effect: 'plain' }
      ]"
      :metrics="workspaceMetrics"
    />

    <ArtSectionCard
      title="统计范围"
      subtitle="选择部门时包含其下级部门；不选择则统计当前租户全部部门。"
      preserve-content-structure
    >
      <div class="special-analysis__filters">
        <ElTreeSelect
          v-model="filter.organizationId"
          :data="state.data.organizations"
          node-key="id"
          :props="{ label: 'organizationName', children: 'children' }"
          check-strictly
          clearable
          filterable
          placeholder="全部部门"
          aria-label="统计部门"
        />
        <ElButton type="primary" :loading="state.loading" @click="loadData">
          <ArtSvgIcon icon="ri:search-line" />生成统计报表
        </ElButton>
        <ElButton :disabled="!filter.organizationId" @click="resetFilter">
          <ArtSvgIcon icon="ri:refresh-line" />重置
        </ElButton>
      </div>
    </ArtSectionCard>

    <div class="special-analysis__charts">
      <ArtSectionCard
        title="部门 × 设备分类"
        subtitle="对比各部门持有的特种设备分类数量。"
        :loading="state.loading"
        :error="state.error"
        :empty="!state.data.rows.length"
        empty-title="暂无特种设备统计数据"
        empty-description="当前范围内尚未标记特种设备、锅炉或重大危险源。"
        :min-height="360"
        @retry="loadData"
      >
        <ArtBarChart
          height="310px"
          :x-axis-data="chartOrganizations"
          :data="barSeries"
          show-legend
          legend-position="bottom"
          stack
        />
      </ArtSectionCard>

      <ArtSectionCard
        title="设备分类构成"
        subtitle="查看当前统计范围内各设备分类占比。"
        :loading="state.loading"
        :error="state.error"
        :empty="!state.data.categories.length"
        empty-title="暂无分类构成"
        empty-description="维护设备分类并标记特种设备后即可生成。"
        :min-height="360"
        @retry="loadData"
      >
        <ArtRingChart
          height="310px"
          :data="ringData"
          :center-text="`${state.data.overview.total} 台`"
          show-legend
          legend-position="right"
        />
      </ArtSectionCard>
    </div>

    <ArtSectionCard
      title="特种设备部门分类报表"
      subtitle="行按部门、列按设备分类汇总，合计与图表使用同一统计口径。"
      :loading="state.loading"
      :error="state.error"
      :empty="!reportRows.length"
      empty-title="暂无可生成的部门报表"
      empty-description="调整部门范围或先完善特种设备台账。"
      :min-height="260"
      @retry="loadData"
    >
      <ArtTable
        :data="reportRows"
        :columns="reportColumns"
        :pagination="false"
        table-layout="fixed"
        empty-text="暂无部门统计数据"
      />
    </ArtSectionCard>
  </div>
</template>

<script setup lang="ts">
  import { groupBy, mapValues, sumBy } from 'lodash-es'
  import type { BarDataItem, PieDataItem } from '@/types/component/chart'
  import type { ColumnOption } from '@/types'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtBarChart from '@/components/core/charts/art-bar-chart/index.vue'
  import ArtRingChart from '@/components/core/charts/art-ring-chart/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchSpecialEquipmentAnalysis,
    type SmisSpecialEquipmentAnalysis,
    type SmisSpecialEquipmentAnalysisOverview
  } from '@smis/api'

  defineOptions({ name: 'SmisSpecialEquipmentAnalysis' })
  type ReportRow = Record<string, string | number>

  const emptyOverview = (): SmisSpecialEquipmentAnalysisOverview => ({
    total: 0,
    organizationCount: 0,
    categoryCount: 0,
    boilerCount: 0,
    majorHazardCount: 0
  })
  const emptyData = (): SmisSpecialEquipmentAnalysis => ({
    rows: [],
    categories: [],
    organizations: [],
    overview: emptyOverview()
  })
  const filter = reactive<{ organizationId?: string }>({})
  const request = useAsyncState(
    async (organizationId?: string): Promise<SmisSpecialEquipmentAnalysis> => {
      const result = await fetchSpecialEquipmentAnalysis(organizationId)
      return {
        ...result.data,
        organizations: result.data.organizations.length
          ? result.data.organizations
          : request.state.value.organizations
      }
    },
    emptyData(),
    { immediate: false, resetOnExecute: false, onError: () => undefined }
  )
  const state = reactive({
    loading: request.isLoading,
    error: computed(() => (request.error.value ? '统计报表加载失败，请重试。' : null)),
    data: request.state
  })

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '重点设备',
      value: state.data.overview.total,
      description: '特种设备 / 锅炉 / 重大危险源',
      icon: 'ri:shield-star-line'
    },
    {
      label: '覆盖部门',
      value: state.data.overview.organizationCount,
      description: '当前统计范围',
      icon: 'ri:organization-chart',
      tone: 'primary'
    },
    {
      label: '设备分类',
      value: state.data.overview.categoryCount,
      description: '已有设备的分类数',
      icon: 'ri:node-tree',
      tone: 'success'
    },
    {
      label: '锅炉 / 重大危险源',
      value: `${state.data.overview.boilerCount} / ${state.data.overview.majorHazardCount}`,
      description: '重点风险构成',
      icon: 'ri:alarm-warning-line',
      tone: state.data.overview.majorHazardCount ? 'warning' : undefined
    }
  ])
  const organizationStats = computed(() =>
    Object.entries(groupBy(state.data.rows, 'organizationId')).map(([id, rows]) => ({
      id,
      name: rows[0].organizationName,
      categoryCounts: mapValues(groupBy(rows, 'categoryId'), (items) => sumBy(items, 'count'))
    }))
  )
  const chartOrganizations = computed(() => organizationStats.value.map((item) => item.name))
  const barSeries = computed<BarDataItem[]>(() =>
    state.data.categories.map((category) => ({
      name: category.categoryName,
      stack: 'total',
      data: organizationStats.value.map((item) => item.categoryCounts[category.categoryId] ?? 0)
    }))
  )
  const ringData = computed<PieDataItem[]>(() =>
    state.data.categories.map((item) => ({ name: item.categoryName, value: item.count }))
  )
  const reportRows = computed<ReportRow[]>(() =>
    organizationStats.value.map((organization, index) => {
      const row: ReportRow = { index: index + 1, organizationName: organization.name, total: 0 }
      state.data.categories.forEach((category) => {
        const count = organization.categoryCounts[category.categoryId] ?? 0
        row[`category_${category.categoryId}`] = count
        row.total = Number(row.total) + count
      })
      return row
    })
  )
  const reportColumns = computed<ColumnOption<ReportRow>[]>(() => [
    { prop: 'index', label: '序号', width: 70, fixed: 'left' },
    { prop: 'organizationName', label: '部门', minWidth: 180, fixed: 'left' },
    ...state.data.categories.map((category): ColumnOption<ReportRow> => ({
      prop: `category_${category.categoryId}`,
      label: category.categoryName,
      minWidth: 120,
      align: 'right'
    })),
    { prop: 'total', label: '合计', width: 100, align: 'right', fixed: 'right' }
  ])

  const loadData = async (): Promise<void> => {
    await request.execute(0, filter.organizationId)
  }
  const resetFilter = (): void => {
    filter.organizationId = undefined
    void loadData()
  }

  onMounted(() => void loadData())
</script>

<style scoped lang="scss">
  .special-analysis {
    display: grid;
    min-width: 0;

    &__filters {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;

      :deep(.el-select) {
        width: min(360px, 100%);
      }
    }

    &__charts {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(340px, 0.8fr);
      gap: 14px;
      min-width: 0;
    }

    @media (width <= 1080px) {
      &__charts {
        grid-template-columns: 1fr;
      }
    }

    @media (width <= 640px) {
      &__filters {
        align-items: stretch;

        :deep(.el-select),
        :deep(.el-button) {
          width: 100%;
          margin-left: 0;
        }
      }
    }
  }
</style>
