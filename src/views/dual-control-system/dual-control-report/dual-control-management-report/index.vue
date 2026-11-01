<template>
  <ArtPermissionGuard
    permission="SmisDualControlManagementReport:View"
    resource-name="双控管控报表"
  >
    <div class="dual-control-report-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="dual-control-report-page__overview"
        eyebrow="DUAL CONTROL PERFORMANCE"
        title="双控管控报表"
        description="按组织汇总风险分级、管控措施、隐患排查与治理闭环，统一查看双控运行质量。"
        icon="ri:bar-chart-box-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="dual-control-report-page__signal art-card-xs" aria-label="双控运行提示">
        <span><ArtSvgIcon :icon="signalIcon" /></span>
        <div
          ><strong>{{ signalTitle }}</strong
          ><p>{{ signalDescription }}</p></div
        >
        <small>{{ dayjs(searchQuery.month).format('YYYY 年 MM 月') }}</small>
      </div>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="dual-control-report-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 84, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          showOverflowTooltip: true,
          emptyText: '暂无双控管控数据',
          emptyDescription: '所选月份和组织范围内尚未形成风险或排查记录。'
        }"
        focusable
      />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { formatSensitiveCountValue } from '@/utils/ui/format'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import dayjs from 'dayjs'
  import { ElProgress, ElTag } from 'element-plus'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import {
    fetchDualControlManagementReport,
    type SmisDualControlReportOverview,
    type SmisDualControlReportRecord,
    type SmisDualControlReportSearchParams
  } from '@smis/api'
  import { useChecklistOptions } from '../../dual-control-checklist/shared/use-checklist-options'

  defineOptions({ name: 'SmisDualControlManagementReport' })

  type TableParams = SmisDualControlReportSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const searchQuery = ref<TableParams>({
    current: 1,
    size: 20,
    month: dayjs().format('YYYY-MM')
  })
  const overview = reactive<SmisDualControlReportOverview>({
    organizations: 0,
    riskItems: 0,
    measures: 0,
    inspectionRate: 0,
    openHazards: 0
  })
  const { organizationTree, organizationTreeProps, loadOptions } = useChecklistOptions()

  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '风险四级分布', type: 'primary', effect: 'plain' },
    { label: '月度排查绩效', type: 'success', effect: 'light' },
    { label: '隐患闭环联动', type: 'warning', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '覆盖组织',
      value: overview.organizations,
      description: '具备双控业务数据',
      icon: 'ri:organization-chart'
    },
    {
      label: '风险项次',
      value: overview.riskItems,
      description: `已配置 ${overview.measures} 项措施`,
      icon: 'ri:shield-flash-line',
      tone: 'primary'
    },
    {
      label: '排查完成率',
      value: `${overview.inspectionRate}%`,
      description: '所选月份任务完成情况',
      icon: 'ri:task-line',
      tone: overview.inspectionRate >= 90 ? 'success' : 'warning'
    },
    {
      label: '待闭环隐患',
      value: overview.openHazards,
      description: '所选月份上报且未闭环',
      icon: 'ri:alarm-warning-line',
      tone: overview.openHazards ? 'danger' : 'success'
    }
  ])
  const signalTitle = computed(() =>
    overview.openHazards ? '仍有治理缺口需要跟踪' : '本期双控链路运行平稳'
  )
  const signalDescription = computed(() =>
    overview.openHazards
      ? `当前月份还有 ${overview.openHazards} 项隐患未闭环，建议优先查看排查完成率较低的组织。`
      : '当前月份未发现未闭环隐患，请持续保持风险措施与排查任务的执行节奏。'
  )
  const signalIcon = computed(() =>
    overview.openHazards ? 'ri:alarm-warning-line' : 'ri:checkbox-circle-line'
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '统计月份',
      key: 'month',
      type: 'date',
      props: { type: 'month', valueFormat: 'YYYY-MM', clearable: false, placeholder: '选择月份' }
    },
    {
      label: '所属组织',
      key: 'organizationId',
      type: 'treeSelect',
      props: {
        data: organizationTree.value,
        props: organizationTreeProps,
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        filterable: true,
        clearable: true,
        defaultExpandAll: true,
        ariaLabel: '所属组织',
        placeholder: '全部组织'
      }
    },
    {
      label: '组织关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '组织名称或编码' }
    }
  ])
  const columnsFactory = (): ColumnOption<SmisDualControlReportRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68, fixed: 'left' },
    {
      prop: 'organizationName',
      label: '组织单元',
      minWidth: 200,
      fixed: 'left',
      formatter: (row) => (
        <div class="dual-control-report-page__identity">
          <span aria-hidden="true">{row.organizationName.slice(0, 1)}</span>
          <div>
            <strong>{row.organizationName}</strong>
            <small>{row.organizationCode}</small>
          </div>
        </div>
      )
    },
    {
      prop: 'riskDistribution',
      label: '风险等级分布',
      minWidth: 252,
      formatter: (row) => (
        <div class="dual-control-report-page__risk-levels">
          <ElTag type="danger" effect="plain">
            重大 {row.majorCount}
          </ElTag>
          <ElTag type="warning" effect="plain">
            较大 {row.highCount}
          </ElTag>
          <ElTag effect="plain">一般 {row.mediumCount}</ElTag>
          <ElTag type="info" effect="plain">
            低 {row.lowCount}
          </ElTag>
        </div>
      )
    },
    {
      prop: 'riskItemCount',
      label: '风险管控',
      minWidth: 175,
      formatter: (row) => (
        <div class="dual-control-report-page__stack">
          <strong>
            {row.riskItemCount} 项风险 · {row.measureCount} 项措施
          </strong>
          <small>
            {row.riskPointCount} 个风险点 · 风险值{' '}
            {formatSensitiveCountValue(Number(row.riskValue))}
          </small>
        </div>
      )
    },
    {
      prop: 'inspectionRate',
      label: '排查执行',
      minWidth: 190,
      formatter: (row) => (
        <div class="dual-control-report-page__progress">
          <div>
            <strong>{row.inspectionRate}%</strong>
            <small>
              {row.completedTaskCount} / {row.generatedTaskCount} 项任务
            </small>
          </div>
          <ElProgress
            percentage={row.inspectionRate}
            strokeWidth={7}
            showText={false}
            status={row.inspectionRate >= 90 ? 'success' : undefined}
          />
        </div>
      )
    },
    {
      prop: 'hazardCount',
      label: '隐患闭环',
      minWidth: 178,
      formatter: (row) => (
        <div class="dual-control-report-page__stack">
          <strong>
            {row.closedHazardCount} / {row.hazardCount} 项已闭环
          </strong>
          <small>
            闭环率 {row.closureRate}% · 异常项 {row.abnormalCount}
          </small>
        </div>
      )
    },
    {
      prop: 'openHazardCount',
      label: '待闭环',
      width: 92,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.openHazardCount ? 'danger' : 'success'} effect="light">
          {row.openHazardCount}
        </ElTag>
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'organizationCode', title: '组织编码' },
    { key: 'organizationName', title: '组织名称' },
    { key: 'majorCount', title: '重大风险' },
    { key: 'highCount', title: '较大风险' },
    { key: 'mediumCount', title: '一般风险' },
    { key: 'lowCount', title: '低风险' },
    { key: 'unevaluatedCount', title: '待评价风险' },
    { key: 'riskPointCount', title: '风险点' },
    { key: 'riskItemCount', title: '危害因素' },
    { key: 'measureCount', title: '管控措施' },
    { key: 'riskValue', title: '风险值合计' },
    { key: 'generatedTaskCount', title: '生成排查任务' },
    { key: 'completedTaskCount', title: '完成排查任务' },
    { key: 'inspectionRate', title: '排查完成率(%)' },
    { key: 'abnormalCount', title: '异常项' },
    { key: 'hazardCount', title: '隐患数' },
    { key: 'closedHazardCount', title: '已闭环隐患' },
    { key: 'openHazardCount', title: '待闭环隐患' },
    { key: 'closureRate', title: '隐患闭环率(%)' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'export',
      label: '导出报表',
      permission: 'SmisDualControlManagementReport:Export',
      exportFilename: `双控管控报表-${searchQuery.value.month}`,
      exportSheetName: '双控管控报表',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: await loadAllDocumentPages(fetchDualControlManagementReport, { ...searchQuery.value })
      })
    }
  ])
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchDualControlManagementReport({ ...params, from, to })
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    return response
  }
  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .dual-control-report-page {
    min-width: 0;
    overflow: hidden;

    &__signal {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      min-height: 58px;
      padding: 9px 14px;
    }

    &__signal > span {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    &__signal p {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__signal small {
      color: var(--el-text-color-secondary);
    }

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.dual-control-report-page__identity) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
    }

    :deep(.dual-control-report-page__identity > span) {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      font-weight: 700;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
      border-radius: 50%;
    }

    :deep(.dual-control-report-page__identity div),
    :deep(.dual-control-report-page__stack) {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    :deep(.dual-control-report-page__identity strong),
    :deep(.dual-control-report-page__identity small),
    :deep(.dual-control-report-page__stack strong),
    :deep(.dual-control-report-page__stack small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.dual-control-report-page__identity small),
    :deep(.dual-control-report-page__stack small),
    :deep(.dual-control-report-page__progress small) {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.dual-control-report-page__risk-levels) {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    :deep(.dual-control-report-page__progress) {
      display: grid;
      gap: 7px;
    }

    :deep(.dual-control-report-page__progress > div) {
      display: flex;
      gap: 10px;
      align-items: baseline;
      justify-content: space-between;
    }
  }
</style>
