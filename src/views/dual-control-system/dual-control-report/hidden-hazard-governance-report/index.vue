<template>
  <ArtPermissionGuard permission="SmisDualControlHiddenHazardGovernanceReport:View">
    <div class="hazard-report-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="HAZARD GOVERNANCE INSIGHTS"
        title="隐患治理报表"
        description="统一汇总隐患发现、整改与验收闭环，按组织、类型、来源和流转时长识别治理薄弱环节。"
        icon="ri:shield-check-line"
        density="compact"
        :tags="[
          { label: '治理闭环', type: 'success', effect: 'light' },
          { label: '重大隐患聚焦', type: 'danger', effect: 'plain' },
          { label: '组织穿透统计', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions>
          <ArtExcelExport
            v-auth="'SmisDualControlHiddenHazardGovernanceReport:Export'"
            :data="exportRows"
            :columns="exportColumns"
            filename="隐患治理报表"
            sheet-name="隐患治理明细"
            button-text="导出报表"
            type="primary"
            plain
            auto-index
          >
            <ArtSvgIcon icon="ri:file-excel-2-line" /> 导出报表
          </ArtExcelExport>
        </template>
      </BusinessWorkspaceHeader>

      <ElScrollbar class="hazard-report-page__scroll">
        <div class="hazard-report-page__body">
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

          <ArtSectionCard
            title="组织治理成效"
            subtitle="按隐患所属组织汇总发现量、闭环量、未闭环、逾期与重大隐患"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.loading && !state.error && !state.data.organizationStats.length"
            empty-title="当前范围暂无治理数据"
            empty-description="调整上报时间或组织范围后重新查询。"
            :min-height="290"
            @retry="loadData"
          >
            <ArtTable
              :data="state.data.organizationStats"
              :columns="organizationColumns"
              :pagination="false"
              table-layout="fixed"
              max-height="330"
              empty-text="暂无组织治理统计"
            />
          </ArtSectionCard>

          <div class="hazard-report-page__charts">
            <ArtSectionCard
              title="隐患类型分布"
              subtitle="按排查类型归集隐患，登记类隐患单独统计"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.categoryStats.length"
              empty-title="暂无隐患类型数据"
              empty-description="隐患登记或排查异常归集后会自动形成分布。"
              :min-height="350"
              @retry="loadData"
            >
              <ArtHBarChart
                height="295px"
                :x-axis-data="categoryLabels"
                :data="categoryValues"
                :bar-width="18"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="隐患来源构成"
              subtitle="对比随手拍、公众举报、隐患排查与风险巡查来源"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.sourceStats.length"
              empty-title="暂无隐患来源数据"
              empty-description="各业务入口上报后会自动形成来源构成。"
              :min-height="350"
              @retry="loadData"
            >
              <ArtRingChart
                height="295px"
                :data="sourceChartData"
                :center-text="`${state.data.overview.total} 项`"
                show-legend
                legend-position="right"
              />
            </ArtSectionCard>
          </div>

          <ArtSectionCard
            title="治理流转周期"
            subtitle="从隐患上报到当前节点或闭环时间，按自然日分段统计"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.loading && !state.error && state.data.overview.total === 0"
            empty-title="暂无流转周期数据"
            empty-description="隐患进入治理流程后会自动计算流转时长。"
            @retry="loadData"
          >
            <div class="hazard-report-page__cycle" aria-label="治理流转周期分布">
              <article v-for="item in cycleItems" :key="item.label">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <small>{{ item.description }}</small>
              </article>
            </div>
          </ArtSectionCard>

          <ArtSectionCard
            title="隐患治理明细"
            subtitle="从全量明细切换查看重大隐患与本年未闭环事项"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.loading && !state.error && !activeDetails.length"
            :empty-title="activeDetailEmptyTitle"
            empty-description="当前筛选范围没有符合条件的隐患记录。"
            :min-height="360"
            @retry="loadData"
          >
            <template #actions>
              <ElSegmented v-model="activeDetail" :options="detailOptions" />
            </template>
            <ArtTable
              :data="activeDetails"
              :columns="detailColumns"
              :pagination="false"
              table-layout="fixed"
              max-height="390"
              empty-text="暂无隐患明细"
            />
          </ArtSectionCard>
        </div>
      </ElScrollbar>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { emptyHazardGovernanceReport } from '@smis/domain/report-defaults'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import dayjs from 'dayjs'
  import { ElProgress } from 'element-plus'
  import type { PieDataItem } from '@/types/component/chart'
  import type { ColumnOption } from '@/types'
  import ArtSearchBar, {
    type SearchFormItem
  } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtExcelExport from '@/components/core/forms/art-excel-export/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtHBarChart from '@/components/core/charts/art-h-bar-chart/index.vue'
  import ArtRingChart from '@/components/core/charts/art-ring-chart/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchHazardGovernanceReport,
    type SmisHazardGovernanceOrganizationStat,
    type SmisHazardGovernanceReportDetail,
    type SmisHazardGovernanceReportResult
  } from '@smis/api'
  import { toDualControlOrganizationTree } from '../../shared/organization-tree'

  defineOptions({ name: 'SmisDualControlHiddenHazardGovernanceReport' })

  type DetailView = 'all' | 'major' | 'yearOutstanding'
  interface ReportQuery extends Record<string, unknown> {
    reportedRange?: [string, string]
    organizationId?: string
  }
  interface ReportState {
    loading: boolean
    error: string | null
    data: SmisHazardGovernanceReportResult
  }

  const userStore = useUserStore()
  const initialQuery = (): ReportQuery => ({
    reportedRange: [
      dayjs().startOf('year').format('YYYY-MM-DD'),
      dayjs().endOf('year').format('YYYY-MM-DD')
    ],
    organizationId: undefined
  })

  const query = ref<ReportQuery>(initialQuery())
  const state = reactive<ReportState>({
    loading: false,
    error: null,
    data: emptyHazardGovernanceReport()
  })
  const activeDetail = ref<DetailView>('all')
  const detailOptions = [
    { label: '全部明细', value: 'all' },
    { label: '重大隐患', value: 'major' },
    { label: '本年未闭环', value: 'yearOutstanding' }
  ]

  const formatDateTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })
  const organizationOptions = computed(() =>
    toDualControlOrganizationTree(state.data.organizationOptions)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '上报时间',
      key: 'reportedRange',
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
      label: '隐患所属组织',
      key: 'organizationId',
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
    }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '隐患总数',
      value: state.data.overview.total,
      description: '当前统计范围',
      icon: 'ri:alert-line'
    },
    {
      label: '闭环率',
      value: `${state.data.overview.closureRate}%`,
      description: `${state.data.overview.closed}/${state.data.overview.total} 项闭环`,
      icon: 'ri:progress-4-line',
      tone: state.data.overview.closureRate >= 90 ? 'success' : 'warning'
    },
    {
      label: '未闭环',
      value: state.data.overview.open,
      description: '仍在治理流程',
      icon: 'ri:time-line',
      tone: state.data.overview.open ? 'warning' : 'success'
    },
    {
      label: '逾期隐患',
      value: state.data.overview.overdue,
      description: '已超过整改时限',
      icon: 'ri:alarm-warning-line',
      tone: state.data.overview.overdue ? 'danger' : 'success'
    },
    {
      label: '重大隐患',
      value: state.data.overview.major,
      description: '需重点跟踪',
      icon: 'ri:error-warning-line',
      tone: state.data.overview.major ? 'danger' : 'info'
    }
  ])
  const categoryStats = computed(() => state.data.categoryStats.slice(0, 10).reverse())
  const categoryLabels = computed(() => categoryStats.value.map((item) => item.name || '未分类'))
  const categoryValues = computed(() => categoryStats.value.map((item) => item.count))
  const sourceChartData = computed<PieDataItem[]>(() =>
    state.data.sourceStats.map((item) => ({
      name:
        userStore.getDictLabelByValue('smisHiddenHazardSourceType', item.value) ||
        item.value ||
        '—',
      value: item.count
    }))
  )
  const cycleItems = computed(() => [
    { label: '1天内', value: state.data.cycleStats.withinDay, description: '快速闭环或当前流转' },
    {
      label: '1—3天',
      value: state.data.cycleStats.withinThreeDays,
      description: '短周期治理'
    },
    { label: '3天—1周', value: state.data.cycleStats.withinWeek, description: '常规治理周期' },
    { label: '1周—1月', value: state.data.cycleStats.withinMonth, description: '较长治理周期' },
    { label: '超过1月', value: state.data.cycleStats.overMonth, description: '重点关注长周期' }
  ])
  const activeDetails = computed(() => {
    if (activeDetail.value === 'major') return state.data.majorHazards
    if (activeDetail.value === 'yearOutstanding') return state.data.yearOutstanding
    return state.data.hazardDetails
  })
  const activeDetailEmptyTitle = computed(() => {
    if (activeDetail.value === 'major') return '当前范围暂无重大隐患'
    if (activeDetail.value === 'yearOutstanding') return '本年隐患均已闭环'
    return '当前范围暂无隐患明细'
  })

  const organizationColumns: ColumnOption<SmisHazardGovernanceOrganizationStat>[] = [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'organizationName',
      label: '所属组织',
      minWidth: 190,
      fixed: 'left',
      showOverflowTooltip: true
    },
    { prop: 'hazardCount', label: '隐患数', width: 96, align: 'right' },
    { prop: 'closedCount', label: '已闭环', width: 96, align: 'right' },
    { prop: 'openCount', label: '未闭环', width: 96, align: 'right' },
    { prop: 'overdueCount', label: '逾期', width: 88, align: 'right' },
    { prop: 'majorCount', label: '重大隐患', width: 108, align: 'right' },
    {
      prop: 'closureRate',
      label: '闭环率',
      width: 160,
      formatter: (row) => (
        <div class="hazard-report-page__rate-cell">
          <ElProgress
            percentage={row.closureRate}
            strokeWidth={7}
            color={row.closureRate >= 90 ? 'var(--el-color-success)' : 'var(--theme-color)'}
          />
        </div>
      )
    }
  ]
  const detailColumns: ColumnOption<SmisHazardGovernanceReportDetail>[] = [
    { type: 'globalIndex', label: '序号', width: 68 },
    { prop: 'hazardNo', label: '隐患编号', width: 150, fixed: 'left' },
    { prop: 'organizationName', label: '所属组织', minWidth: 150, showOverflowTooltip: true },
    { prop: 'description', label: '隐患描述', minWidth: 230, showOverflowTooltip: true },
    { prop: 'location', label: '隐患位置', minWidth: 160, showOverflowTooltip: true },
    {
      prop: 'hazardLevel',
      label: '隐患级别',
      width: 112,
      formatter: (row) =>
        row.hazardLevel ? (
          <ArtDictDisplay dictCode="smisHazardLevel" value={row.hazardLevel} display="tag" />
        ) : (
          '—'
        )
    },
    {
      prop: 'status',
      label: '状态',
      width: 112,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisHiddenHazardGovernanceStatus"
          value={row.status}
          display="tag"
        />
      )
    },
    { prop: 'reporterName', label: '上报人', width: 112 },
    {
      prop: 'reportedAt',
      label: '上报时间',
      width: 164,
      formatter: (row) => formatDateTime(row.reportedAt)
    },
    {
      prop: 'rectificationDeadline',
      label: '整改时限',
      width: 164,
      formatter: (row) => formatDateTime(row.rectificationDeadline)
    },
    { prop: 'rectifierName', label: '整改责任人', width: 120 },
    {
      prop: 'rectificationCompletedAt',
      label: '整改完成时间',
      width: 164,
      formatter: (row) => formatDateTime(row.rectificationCompletedAt)
    }
  ]
  const exportRows = computed(() =>
    state.data.hazardDetails.map((row) => ({
      ...row,
      hazardLevel:
        userStore.getDictLabelByValue('smisHazardLevel', row.hazardLevel) || row.hazardLevel || '—',
      status:
        userStore.getDictLabelByValue('smisHiddenHazardGovernanceStatus', row.status) ||
        row.status ||
        '—',
      sourceType:
        userStore.getDictLabelByValue('smisHiddenHazardSourceType', row.sourceType) ||
        row.sourceType ||
        '—',
      reportedAt: formatDateTime(row.reportedAt),
      rectificationDeadline: formatDateTime(row.rectificationDeadline),
      rectificationCompletedAt: formatDateTime(row.rectificationCompletedAt),
      acceptedAt: formatDateTime(row.acceptedAt)
    }))
  )
  const exportColumns = {
    hazardNo: { title: '隐患编号', width: 20 },
    organizationName: { title: '所属组织', width: 22 },
    description: { title: '隐患描述', width: 36 },
    location: { title: '隐患位置', width: 24 },
    hazardLevel: { title: '隐患级别' },
    status: { title: '治理状态' },
    sourceType: { title: '隐患来源' },
    reporterName: { title: '上报人' },
    reportedAt: { title: '上报时间', width: 20 },
    rectificationDeadline: { title: '整改时限', width: 20 },
    rectificationMeasures: { title: '整改措施', width: 32 },
    rectifierName: { title: '整改责任人' },
    rectificationCompletedAt: { title: '整改完成时间', width: 20 },
    acceptorName: { title: '验收人' },
    acceptedAt: { title: '验收时间', width: 20 }
  }

  const loadData = async (): Promise<void> => {
    state.loading = true
    state.error = null
    try {
      const result = await fetchHazardGovernanceReport({
        reportedFrom: query.value.reportedRange?.[0],
        reportedTo: query.value.reportedRange?.[1]
          ? `${query.value.reportedRange[1]}T23:59:59`
          : undefined,
        organizationId: query.value.organizationId
      })
      const organizations = result.organizationOptions.length
        ? result.organizationOptions
        : state.data.organizationOptions
      state.data = { ...result, organizationOptions: organizations }
      if (result.error) state.error = '隐患治理报表加载失败，请重试。'
    } catch {
      state.error = '隐患治理报表加载失败，请重试。'
    } finally {
      state.loading = false
    }
  }
  const resetQuery = (): void => {
    Object.assign(query.value, initialQuery())
    void loadData()
  }

  onMounted(async () => {
    await Promise.all(
      ['smisHiddenHazardGovernanceStatus', 'smisHiddenHazardSourceType', 'smisHazardLevel'].map(
        (code) => userStore.ensureDictLoaded(code)
      )
    )
    await loadData()
  })
</script>

<style scoped lang="scss">
  .hazard-report-page {
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

    &__charts {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.8fr);
      gap: 14px;
      min-width: 0;
    }

    &__cycle {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;

      article {
        display: grid;
        gap: 3px;
        min-width: 0;
        padding: 14px 16px;
        background: var(--art-gray-100);
        border-radius: var(--el-border-radius-base);
      }

      span,
      small {
        color: var(--el-text-color-secondary);
      }

      strong {
        font-size: 24px;
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-primary);
      }

      small {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        white-space: nowrap;
      }
    }

    &__rate-cell {
      width: 136px;
      margin-inline: auto;
    }

    @media (width <= 1100px) {
      &__charts {
        grid-template-columns: 1fr;
      }

      &__cycle {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (width <= 720px) {
      &__cycle {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  }
</style>
