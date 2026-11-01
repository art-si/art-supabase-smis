<template>
  <ArtPermissionGuard permission="SmisDualControlNoHiddenHazardPersonnelStatistics:View">
    <div class="no-hazard-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="REPORTING PARTICIPATION"
        title="未提隐患人员统计"
        description="从在职员工范围识别低频或未上报隐患人员，并同步标记统计期间的有效请假状态。"
        icon="ri:user-unfollow-line"
        density="compact"
        :tags="[
          { label: '在职人员口径', type: 'primary', effect: 'plain' },
          { label: '请假联动', type: 'success', effect: 'light' },
          { label: '低频关注', type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions>
          <ArtExcelExport
            v-auth="'SmisDualControlNoHiddenHazardPersonnelStatistics:Export'"
            :data="exportRows"
            :columns="exportColumns"
            filename="未提隐患人员统计"
            sheet-name="人员统计"
            button-text="导出统计"
            type="primary"
            plain
            auto-index
          >
            <ArtSvgIcon icon="ri:file-excel-2-line" /> 导出统计
          </ArtExcelExport>
        </template>
      </BusinessWorkspaceHeader>

      <ElScrollbar class="no-hazard-page__scroll">
        <div class="no-hazard-page__body">
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
            description="展示隐患上报数小于等于设定上限的在职及试用员工；请假仅认已批准且与查询区间重叠的记录。"
          />

          <div class="no-hazard-page__insights">
            <ArtSectionCard
              title="组织低频人员分布"
              subtitle="按当前结果集汇总，帮助识别参与度薄弱组织"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !organizationStats.length"
              empty-title="暂无组织分布"
              empty-description="调整隐患数量上限或统计时间后重试。"
              :min-height="320"
              @retry="loadData"
            >
              <ArtHBarChart
                height="270px"
                :x-axis-data="chartLabels"
                :data="chartValues"
                :bar-width="18"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="阅读提示"
              subtitle="对结果作出业务判断前请结合人员状态"
              :min-height="320"
            >
              <div class="no-hazard-page__notes">
                <article
                  ><span><ArtSvgIcon icon="ri:user-search-line" /></span
                  ><div
                    ><strong>未上报不等于未发现</strong
                    ><p>建议结合岗位风险暴露和排查任务共同分析。</p></div
                  ></article
                >
                <article
                  ><span><ArtSvgIcon icon="ri:calendar-check-line" /></span
                  ><div
                    ><strong>请假人员单独标记</strong
                    ><p>避免将统计期间正常缺勤直接视为参与不足。</p></div
                  ></article
                >
                <article
                  ><span><ArtSvgIcon icon="ri:shield-check-line" /></span
                  ><div
                    ><strong>只展示业务安全字段</strong
                    ><p>身份证、电话等敏感信息不进入报表或导出。</p></div
                  ></article
                >
              </div>
            </ArtSectionCard>
          </div>

          <ArtSectionCard
            title="人员明细"
            :subtitle="`隐患上报数 ≤ ${query.maxHazardCount ?? 0}`"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.loading && !state.error && !state.data.records.length"
            empty-title="当前范围没有符合条件的人员"
            empty-description="提高隐患数量上限或扩大组织、时间范围后重新查询。"
            :min-height="390"
            @retry="loadData"
          >
            <ArtTable
              :data="state.data.records"
              :columns="columns"
              :pagination="false"
              table-layout="fixed"
              max-height="430"
              empty-text="暂无人员统计"
            />
          </ArtSectionCard>
        </div>
      </ElScrollbar>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { emptyNoHazardPersonnelStatistics } from '@smis/domain/report-defaults'
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import dayjs from 'dayjs'
  import { ElTag } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import ArtSearchBar, {
    type SearchFormItem
  } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtExcelExport from '@/components/core/forms/art-excel-export/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtHBarChart from '@/components/core/charts/art-h-bar-chart/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchNoHiddenHazardPersonnelStatistics,
    type SmisNoHazardPersonnelRecord,
    type SmisNoHazardPersonnelStatisticsResult
  } from '@smis/api'
  import { toDualControlOrganizationTree } from '../../shared/organization-tree'
  import ReportDefinitionStrip from '../shared/report-definition-strip.vue'

  defineOptions({ name: 'SmisDualControlNoHiddenHazardPersonnelStatistics' })
  interface PersonnelQuery extends Record<string, unknown> {
    reportedRange?: [string, string]
    organizationId?: string
    maxHazardCount?: number
    employeeKeyword?: string
  }

  const initialQuery = (): PersonnelQuery => ({
    reportedRange: [
      dayjs().startOf('month').format('YYYY-MM-DD'),
      dayjs().endOf('month').format('YYYY-MM-DD')
    ],
    organizationId: undefined,
    maxHazardCount: 0,
    employeeKeyword: ''
  })
  const query = ref<PersonnelQuery>(initialQuery())
  const state = reactive<{
    loading: boolean
    error: string | null
    data: SmisNoHazardPersonnelStatisticsResult
  }>({ loading: false, error: null, data: emptyNoHazardPersonnelStatistics() })
  const organizationOptions = computed(() =>
    toDualControlOrganizationTree(state.data.organizationOptions)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '统计时间',
      key: 'reportedRange',
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
      label: '隐患数量上限',
      key: 'maxHazardCount',
      span: 4,
      type: 'inputNumber',
      props: { min: 0, max: 9999, controlsPosition: 'right', placeholder: '默认 0' }
    },
    {
      label: '员工',
      key: 'employeeKeyword',
      span: 5,
      type: 'input',
      props: { clearable: true, placeholder: '姓名 / 工号' }
    }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '在职人员',
      value: state.data.overview.personnelCount,
      description: '当前组织范围',
      icon: 'ri:group-line'
    },
    {
      label: '低频人员',
      value: state.data.overview.matchedCount,
      description: `上报数 ≤ ${query.value.maxHazardCount ?? 0}`,
      icon: 'ri:user-unfollow-line',
      tone: state.data.overview.matchedCount ? 'warning' : 'success'
    },
    {
      label: '零上报人员',
      value: state.data.overview.zeroReportCount,
      description: '统计期间无上报',
      icon: 'ri:chat-off-line',
      tone: state.data.overview.zeroReportCount ? 'danger' : 'success'
    },
    {
      label: '请假人员',
      value: state.data.overview.onLeaveCount,
      description: '有效请假区间重叠',
      icon: 'ri:calendar-event-line',
      tone: 'info'
    },
    {
      label: '人均上报',
      value: state.data.overview.averageHazardCount,
      description: '全部在职人员均值',
      icon: 'ri:bar-chart-grouped-line'
    }
  ])
  const organizationStats = computed(() => {
    const counts = new Map<string, number>()
    state.data.records.forEach((row) =>
      counts.set(row.organizationName, (counts.get(row.organizationName) ?? 0) + 1)
    )
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .reverse()
  })
  const chartLabels = computed(() => organizationStats.value.map((item) => item.name))
  const chartValues = computed(() => organizationStats.value.map((item) => item.count))
  const formatDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '从未上报',
    invalidText: '日期异常'
  })
  const columns: ColumnOption<SmisNoHazardPersonnelRecord>[] = [
    { type: 'globalIndex', label: '序号', width: 66 },
    { prop: 'employeeNo', label: '工号', width: 136, fixed: 'left' },
    { prop: 'employeeName', label: '姓名', width: 116, fixed: 'left' },
    { prop: 'organizationName', label: '所属组织', minWidth: 190, showOverflowTooltip: true },
    { prop: 'positionName', label: '岗位', minWidth: 160, showOverflowTooltip: true },
    {
      prop: 'onLeave',
      label: '是否请假',
      width: 104,
      formatter: (row) => (
        <ElTag type={row.onLeave ? 'warning' : 'success'} effect="light">
          {row.onLeave ? '请假' : '正常在岗'}
        </ElTag>
      )
    },
    { prop: 'hazardCount', label: '提报隐患数', width: 120, align: 'right' },
    {
      prop: 'lastReportedAt',
      label: '最近上报时间',
      width: 170,
      formatter: (row) => formatDateTime(row.lastReportedAt)
    }
  ]
  const exportRows = computed(() =>
    state.data.records.map((row) => ({
      ...row,
      onLeave: row.onLeave ? '是' : '否',
      lastReportedAt: formatDateTime(row.lastReportedAt)
    }))
  )
  const exportColumns = {
    employeeNo: { title: '工号' },
    employeeName: { title: '姓名' },
    organizationName: { title: '所属组织', width: 24 },
    positionName: { title: '岗位', width: 20 },
    onLeave: { title: '是否请假' },
    hazardCount: { title: '提报隐患数' },
    lastReportedAt: { title: '最近上报时间', width: 22 }
  }
  const loadData = async (): Promise<void> => {
    state.loading = true
    state.error = null
    try {
      const result = await fetchNoHiddenHazardPersonnelStatistics({
        reportedFrom: query.value.reportedRange?.[0],
        reportedTo: query.value.reportedRange?.[1]
          ? `${query.value.reportedRange[1]}T23:59:59`
          : undefined,
        organizationId: query.value.organizationId,
        maxHazardCount: query.value.maxHazardCount,
        employeeKeyword: query.value.employeeKeyword
      })
      const organizationOptions = result.organizationOptions.length
        ? result.organizationOptions
        : state.data.organizationOptions
      state.data = { ...result, organizationOptions }
      if (result.error) state.error = '未提隐患人员统计加载失败，请重试。'
    } catch {
      state.error = '未提隐患人员统计加载失败，请重试。'
    } finally {
      state.loading = false
    }
  }
  const resetQuery = (): void => {
    Object.assign(query.value, initialQuery())
    void loadData()
  }
  onMounted(loadData)
</script>

<style scoped lang="scss">
  .no-hazard-page {
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

    &__insights {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
      gap: var(--art-space-4);
      min-width: 0;
    }

    &__notes {
      display: grid;
      gap: 12px;

      article {
        display: flex;
        gap: 12px;
        padding: 13px;
        background: var(--art-gray-100);
        border-radius: var(--el-border-radius-base);

        span {
          display: grid;
          flex: none;
          place-items: center;
          width: 34px;
          height: 34px;
          color: var(--theme-color);
          background: var(--el-color-primary-light-9);
          border-radius: var(--el-border-radius-base);
        }

        strong {
          color: var(--el-text-color-primary);
        }

        p {
          margin: 4px 0 0;
          font-size: 12px;
          line-height: 1.55;
          color: var(--el-text-color-secondary);
        }
      }
    }

    @media (width <= 1050px) {
      &__insights {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
