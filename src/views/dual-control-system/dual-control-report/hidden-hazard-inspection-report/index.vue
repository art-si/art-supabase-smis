<template>
  <ArtPermissionGuard
    permission="SmisDualControlHiddenHazardInspectionReport:View"
    resource-name="隐患排查报表"
  >
    <div class="inspection-report-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="inspection-report-page__overview"
        eyebrow="INSPECTION PERFORMANCE"
        title="隐患排查报表"
        description="按被检组织统计排查计划、任务完成率、漏检人员与异常转隐患结果。"
        icon="ri:pie-chart-2-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="inspection-report-page__coverage art-card-xs" aria-label="排查执行概览">
        <article>
          <span><ArtSvgIcon icon="ri:task-line" /></span>
          <div
            ><small>任务完成进度</small><strong>{{ overview.inspectionRate }}%</strong></div
          >
          <ElProgress :percentage="overview.inspectionRate" :stroke-width="8" :show-text="false" />
        </article>
        <p>{{ coverageGuidance }}</p>
      </div>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="inspection-report-page__table"
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
          emptyText: '暂无隐患排查统计',
          emptyDescription: '所选日期范围内尚未生成排查任务。'
        }"
        focusable
      />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
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
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchHiddenHazardInspectionReport,
    type SmisHiddenHazardInspectionReportOverview,
    type SmisHiddenHazardInspectionReportRecord,
    type SmisHiddenHazardInspectionReportSearchParams
  } from '@smis/api'
  import { useChecklistOptions } from '../../dual-control-checklist/shared/use-checklist-options'

  defineOptions({ name: 'SmisDualControlHiddenHazardInspectionReport' })

  interface InspectionReportQuery extends SmisHiddenHazardInspectionReportSearchParams {
    plannedRange?: [string, string]
  }
  type TableParams = InspectionReportQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const searchQuery = ref<TableParams>({
    current: 1,
    size: 20,
    plannedRange: [dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
  })
  const overview = reactive<SmisHiddenHazardInspectionReportOverview>({
    organizations: 0,
    generatedTasks: 0,
    completedTasks: 0,
    inspectionRate: 0,
    missedInspectors: 0,
    generatedHazards: 0
  })
  const { organizationTree, organizationTreeProps, loadOptions } = useChecklistOptions()
  useDictionaryOptions('organizationType')
  const userStore = useUserStore()

  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '组织排查率', type: 'primary', effect: 'plain' },
    { label: '漏检人员识别', type: 'danger', effect: 'light' },
    { label: '异常转隐患', type: 'warning', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '覆盖组织',
      value: overview.organizations,
      description: '配置有效排查计划',
      icon: 'ri:organization-chart'
    },
    {
      label: '生成任务',
      value: overview.generatedTasks,
      description: `已完成 ${overview.completedTasks} 项`,
      icon: 'ri:file-list-3-line',
      tone: 'primary'
    },
    {
      label: '排查率',
      value: `${overview.inspectionRate}%`,
      description: '按任务完成口径',
      icon: 'ri:pie-chart-line',
      tone: overview.inspectionRate >= 90 ? 'success' : 'warning'
    },
    {
      label: '漏检人员',
      value: overview.missedInspectors,
      description: `异常转隐患 ${overview.generatedHazards} 项`,
      icon: 'ri:user-unfollow-line',
      tone: overview.missedInspectors ? 'danger' : 'success'
    }
  ])
  const coverageGuidance = computed(() => {
    if (!overview.generatedTasks)
      return '当前日期范围内暂无排查任务，请检查计划周期或调整查询范围。'
    if (overview.missedInspectors)
      return `还有 ${overview.missedInspectors} 名执行人存在到期未完成任务，建议及时跟进。`
    return '当前到期排查任务均已有执行结果，请持续关注异常项的隐患闭环。'
  })
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '计划日期',
      key: 'plannedRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        clearable: false
      }
    },
    {
      label: '被检组织',
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
        ariaLabel: '被检组织',
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
  const columnsFactory = (): ColumnOption<SmisHiddenHazardInspectionReportRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68, fixed: 'left' },
    {
      prop: 'organizationName',
      label: '被检组织',
      minWidth: 210,
      fixed: 'left',
      formatter: (row) => (
        <div class="inspection-report-page__identity">
          <span aria-hidden="true">{row.organizationName.slice(0, 1)}</span>
          <div>
            <strong>{row.organizationName}</strong>
            <small>
              {row.organizationCode} ·{' '}
              {userStore.getDictLabelByValue('organizationType', row.organizationType) ||
                row.organizationType}
            </small>
          </div>
        </div>
      )
    },
    {
      prop: 'activePlanCount',
      label: '计划覆盖',
      minWidth: 150,
      formatter: (row) => (
        <div class="inspection-report-page__stack">
          <strong>{row.activePlanCount} 个有效计划</strong>
          <small>{row.executorCount} 名任务执行人</small>
        </div>
      )
    },
    {
      prop: 'generatedTaskCount',
      label: '任务执行',
      minWidth: 195,
      formatter: (row) => (
        <div class="inspection-report-page__task-tags">
          <ElTag type="success" effect="plain">
            完成 {row.completedTaskCount}
          </ElTag>
          <ElTag effect="plain">进行中 {row.inProgressTaskCount}</ElTag>
          <ElTag type="danger" effect="plain">
            逾期 {row.overdueTaskCount}
          </ElTag>
        </div>
      )
    },
    {
      prop: 'inspectionRate',
      label: '排查率',
      minWidth: 180,
      formatter: (row) => (
        <div class="inspection-report-page__progress">
          <div>
            <strong>{row.inspectionRate}%</strong>
            <small>
              {row.completedTaskCount} / {row.generatedTaskCount}
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
      prop: 'missedInspectorCount',
      label: '漏检人员',
      width: 106,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.missedInspectorCount ? 'danger' : 'success'} effect="light">
          {row.missedInspectorCount}
        </ElTag>
      )
    },
    {
      prop: 'abnormalCount',
      label: '异常闭环',
      minWidth: 160,
      formatter: (row) => (
        <div class="inspection-report-page__stack">
          <strong>{row.abnormalCount} 项异常</strong>
          <small>{row.generatedHazardCount} 项已转隐患</small>
        </div>
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'organizationCode', title: '组织编码' },
    { key: 'organizationName', title: '被检组织' },
    { key: 'organizationType', title: '组织类型' },
    { key: 'activePlanCount', title: '有效计划' },
    { key: 'generatedTaskCount', title: '生成排查任务' },
    { key: 'completedTaskCount', title: '完成排查任务' },
    { key: 'inProgressTaskCount', title: '进行中任务' },
    { key: 'overdueTaskCount', title: '逾期任务' },
    { key: 'cancelledTaskCount', title: '取消任务' },
    { key: 'inspectionRate', title: '排查率(%)' },
    { key: 'executorCount', title: '执行人数' },
    { key: 'missedInspectorCount', title: '漏检人数' },
    { key: 'abnormalCount', title: '异常项' },
    { key: 'generatedHazardCount', title: '转隐患数量' }
  ]
  const normalizeQuery = (
    params: TableParams,
    range: Pick<SmisHiddenHazardInspectionReportSearchParams, 'from' | 'to'> = {}
  ): SmisHiddenHazardInspectionReportSearchParams => ({
    ...params,
    plannedFrom: params.plannedRange?.[0],
    plannedTo: params.plannedRange?.[1] ? `${params.plannedRange[1]}T23:59:59` : undefined,
    ...range
  })
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'export',
      label: '导出报表',
      permission: 'SmisDualControlHiddenHazardInspectionReport:Export',
      exportFilename: '隐患排查报表',
      exportSheetName: '隐患排查报表',
      exportColumns: excelColumns,
      exportApi: async () => {
        await userStore.ensureDictLoaded('organizationType')
        const rows = await loadAllDocumentPages(
          fetchHiddenHazardInspectionReport,
          normalizeQuery(searchQuery.value)
        )
        return {
          data: rows.map((row) => ({
            ...row,
            organizationType:
              userStore.getDictLabelByValue('organizationType', row.organizationType) ||
              row.organizationType
          }))
        }
      }
    }
  ])
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchHiddenHazardInspectionReport(normalizeQuery(params, { from, to }))
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    return response
  }
  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .inspection-report-page {
    min-width: 0;
    overflow: hidden;

    &__coverage {
      display: grid;
      grid-template-columns: minmax(340px, 0.9fr) minmax(0, 1.1fr);
      gap: 18px;
      align-items: center;
      min-height: 62px;
      padding: 10px 14px;
    }

    &__coverage article {
      display: grid;
      grid-template-columns: 40px 120px minmax(100px, 1fr);
      gap: 12px;
      align-items: center;
    }

    &__coverage article > span {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    &__coverage small,
    &__coverage strong {
      display: block;
    }

    &__coverage small {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__coverage p {
      margin: 0;
      color: var(--el-text-color-secondary);
      text-align: right;
    }

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.inspection-report-page__identity) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
    }

    :deep(.inspection-report-page__identity > span) {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      font-weight: 700;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
      border-radius: 50%;
    }

    :deep(.inspection-report-page__identity div),
    :deep(.inspection-report-page__stack) {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    :deep(.inspection-report-page__identity strong),
    :deep(.inspection-report-page__identity small),
    :deep(.inspection-report-page__stack strong),
    :deep(.inspection-report-page__stack small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.inspection-report-page__identity small),
    :deep(.inspection-report-page__stack small),
    :deep(.inspection-report-page__progress small) {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.inspection-report-page__task-tags) {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    :deep(.inspection-report-page__progress) {
      display: grid;
      gap: 7px;
    }

    :deep(.inspection-report-page__progress > div) {
      display: flex;
      gap: 10px;
      align-items: baseline;
      justify-content: space-between;
    }

    @media (width <= 900px) {
      &__coverage {
        grid-template-columns: 1fr;
      }

      &__coverage p {
        text-align: left;
      }
    }
  }
</style>
