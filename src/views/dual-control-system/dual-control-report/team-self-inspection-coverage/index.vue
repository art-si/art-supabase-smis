<template>
  <ArtPermissionGuard permission="SmisDualControlTeamSelfInspectionCoverage:View">
    <div class="team-coverage-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="TEAM SELF-INSPECTION"
        title="班组自查涵盖率"
        description="衡量班组级风险巡查任务覆盖到的在职人员比例，并同步观察任务完成质量。"
        icon="ri:team-line"
        density="compact"
        :tags="[
          { label: '班组级任务', type: 'primary', effect: 'plain' },
          { label: '人员覆盖', type: 'success', effect: 'light' },
          { label: '组织对比', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions>
          <ArtExcelExport
            v-auth="'SmisDualControlTeamSelfInspectionCoverage:Export'"
            :data="exportRows"
            :columns="exportColumns"
            filename="班组自查涵盖率"
            sheet-name="组织涵盖率"
            button-text="导出统计"
            type="primary"
            plain
            auto-index
          >
            <ArtSvgIcon icon="ri:file-excel-2-line" /> 导出统计
          </ArtExcelExport>
        </template>
      </BusinessWorkspaceHeader>

      <ElScrollbar class="team-coverage-page__scroll">
        <div class="team-coverage-page__body">
          <ArtSearchBar
            v-model="query"
            :items="searchItems"
            :span="8"
            label-position="top"
            :is-expand="true"
            :show-expand="false"
            :disabled-search="state.loading"
            @search="loadData"
            @reset="resetQuery"
          />

          <ReportDefinitionStrip
            description="分母为组织内在职及试用员工；分子为查询期内承接过“班组级”巡查任务的去重人员。"
          />

          <div class="team-coverage-page__workspace">
            <ArtSectionCard
              title="组织涵盖率"
              subtitle="同一员工在统计周期内仅计一次"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.records.length"
              empty-title="暂无可统计组织"
              empty-description="组织建立在职员工后会自动纳入统计。"
              :min-height="410"
              @retry="loadData"
            >
              <ArtTable
                :data="state.data.records"
                :columns="columns"
                :pagination="false"
                table-layout="fixed"
                max-height="450"
                empty-text="暂无组织涵盖率"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="涵盖率对比"
              subtitle="单位：%"
              :loading="state.loading"
              :error="state.error"
              :empty="
                !state.loading && !state.error && (!state.data.records.length || !hasChartValues)
              "
              :empty-title="state.data.records.length ? '当前组织涵盖率均为 0%' : '暂无图表数据'"
              :empty-description="
                state.data.records.length
                  ? '已纳入统计的组织在当前周期内尚未形成班组级人员覆盖。'
                  : '生成班组级巡查任务后会形成涵盖率。'
              "
              :min-height="410"
              @retry="loadData"
            >
              <ArtBarChart
                height="355px"
                :x-axis-data="chartLabels"
                :data="chartValues"
                :bar-width="34"
                :y-axis-min="0"
                :y-axis-max="100"
                value-suffix="%"
              />
            </ArtSectionCard>
          </div>
        </div>
      </ElScrollbar>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { emptyTeamSelfInspectionCoverage } from '@smis/domain/report-defaults'
  import { formatPercentValue } from '@/utils/ui/format'
  import dayjs from 'dayjs'
  import { ElProgress } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import ArtSearchBar, {
    type SearchFormItem
  } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtExcelExport from '@/components/core/forms/art-excel-export/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtBarChart from '@/components/core/charts/art-bar-chart/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchTeamSelfInspectionCoverage,
    type SmisTeamSelfInspectionCoverageRecord,
    type SmisTeamSelfInspectionCoverageResult
  } from '@smis/api'
  import { toDualControlOrganizationTree } from '../../shared/organization-tree'
  import ReportDefinitionStrip from '../shared/report-definition-strip.vue'

  defineOptions({ name: 'SmisDualControlTeamSelfInspectionCoverage' })
  interface CoverageQuery extends Record<string, unknown> {
    plannedRange?: [string, string]
    organizationId?: string
  }

  const initialQuery = (): CoverageQuery => ({
    plannedRange: [
      dayjs().startOf('month').format('YYYY-MM-DD'),
      dayjs().endOf('month').format('YYYY-MM-DD')
    ],
    organizationId: undefined
  })
  const query = ref<CoverageQuery>(initialQuery())
  const state = reactive<{
    loading: boolean
    error: string | null
    data: SmisTeamSelfInspectionCoverageResult
  }>({ loading: false, error: null, data: emptyTeamSelfInspectionCoverage() })
  const organizationOptions = computed(() =>
    toDualControlOrganizationTree(state.data.organizationOptions)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '所属组织',
      key: 'organizationId',
      span: 7,
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
    }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '班组涵盖率',
      value: `${state.data.overview.coverageRate}%`,
      description: `${state.data.overview.coveredMemberCount}/${state.data.overview.memberCount} 人覆盖`,
      icon: 'ri:percent-line',
      tone: state.data.overview.coverageRate >= 90 ? 'success' : 'warning'
    },
    {
      label: '统计组织',
      value: state.data.overview.organizationCount,
      description: '含在职员工组织',
      icon: 'ri:organization-chart'
    },
    {
      label: '班组单元',
      value: state.data.overview.teamCount,
      description: '按人员所属组织归集',
      icon: 'ri:team-line'
    },
    {
      label: '在职成员',
      value: state.data.overview.memberCount,
      description: '在职与试用员工',
      icon: 'ri:user-3-line'
    },
    {
      label: '完成任务',
      value: state.data.overview.completedTaskCount,
      description: '班组级已完成任务',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const chartRecords = computed(() => state.data.records.slice(0, 12))
  const chartLabels = computed(() => chartRecords.value.map((row) => row.organizationName))
  const chartValues = computed(() => chartRecords.value.map((row) => row.coverageRate))
  const hasChartValues = computed(() => chartValues.value.some((value) => value > 0))
  const columns: ColumnOption<SmisTeamSelfInspectionCoverageRecord>[] = [
    { type: 'globalIndex', label: '序号', width: 66 },
    {
      prop: 'organizationName',
      label: '组织名称',
      minWidth: 190,
      fixed: 'left',
      showOverflowTooltip: true
    },
    { prop: 'teamCount', label: '班组数', width: 88, align: 'right' },
    { prop: 'memberCount', label: '班组总人数', width: 116, align: 'right' },
    { prop: 'coveredMemberCount', label: '自查覆盖人数', width: 128, align: 'right' },
    {
      prop: 'coverageRate',
      label: '班组自查涵盖率',
      width: 190,
      formatter: (row) => (
        <div class="mx-auto w-[158px]">
          <ElProgress
            percentage={row.coverageRate}
            format={(value) => formatPercentValue(value, { fractionDigits: 2 })}
            strokeWidth={7}
            color={row.coverageRate >= 90 ? 'var(--el-color-success)' : 'var(--theme-color)'}
          />
        </div>
      )
    },
    { prop: 'taskCount', label: '自查任务', width: 100, align: 'right' },
    { prop: 'completedTaskCount', label: '完成任务', width: 100, align: 'right' },
    {
      prop: 'taskCompletionRate',
      label: '任务完成率',
      width: 112,
      align: 'right',
      formatter: (row) => formatPercentValue(row.taskCompletionRate || 0, { fractionDigits: 2 })
    }
  ]
  const exportRows = computed(() =>
    state.data.records.map((row) => ({
      ...row,
      coverageRate: formatPercentValue(row.coverageRate || 0, { fractionDigits: 2 }),
      taskCompletionRate: formatPercentValue(row.taskCompletionRate || 0, { fractionDigits: 2 })
    }))
  )
  const exportColumns = {
    organizationName: { title: '组织名称', width: 24 },
    teamCount: { title: '班组数' },
    memberCount: { title: '班组总人数' },
    coveredMemberCount: { title: '班组自查覆盖人数' },
    coverageRate: { title: '班组自查涵盖率' },
    taskCount: { title: '班组自查任务' },
    completedTaskCount: { title: '已完成任务' },
    taskCompletionRate: { title: '任务完成率' }
  }
  const loadData = async (): Promise<void> => {
    state.loading = true
    state.error = null
    try {
      const result = await fetchTeamSelfInspectionCoverage({
        plannedFrom: query.value.plannedRange?.[0],
        plannedTo: query.value.plannedRange?.[1]
          ? `${query.value.plannedRange[1]}T23:59:59`
          : undefined,
        organizationId: query.value.organizationId
      })
      const organizationOptions = result.organizationOptions.length
        ? result.organizationOptions
        : state.data.organizationOptions
      state.data = { ...result, organizationOptions }
      if (result.error) state.error = '班组自查涵盖率加载失败，请重试。'
    } catch {
      state.error = '班组自查涵盖率加载失败，请重试。'
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
  .team-coverage-page {
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
      grid-template-columns: minmax(0, 1.2fr) minmax(420px, 0.8fr);
      gap: var(--art-space-4);
      min-width: 0;
    }

    @media (width <= 1180px) {
      &__workspace {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
