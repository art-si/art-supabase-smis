<template>
  <ArtPermissionGuard permission="SmisDualControlRiskListSummary:View" resource-name="风险清单汇总">
    <div class="risk-summary-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="ENTERPRISE RISK OVERVIEW"
        title="风险清单汇总"
        description="以企业风险底账口径汇总风险等级、控制措施和责任落实情况，支持全量报表导出。"
        icon="ri:bar-chart-box-line"
        density="compact"
        :tags="[
          { label: '统一风险口径', type: 'primary', effect: 'plain' },
          { label: '控制措施全景', type: 'warning', effect: 'light' },
          { label: '管理报表', type: 'success', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="risk-summary-page__coverage art-card-xs" aria-label="风险治理覆盖概览">
        <article>
          <span class="risk-summary-page__coverage-icon is-evaluation">
            <ArtSvgIcon icon="ri:calculator-line" />
          </span>
          <div class="risk-summary-page__coverage-main">
            <div>
              <span>评价覆盖率</span>
              <strong>{{ evaluationRate }}%</strong>
            </div>
            <ElProgress :percentage="evaluationRate" :stroke-width="7" :show-text="false" />
            <small>{{ overview.evaluated }} / {{ overview.total }} 项已完成定量评价</small>
          </div>
        </article>
        <article>
          <span class="risk-summary-page__coverage-icon is-control">
            <ArtSvgIcon icon="ri:shield-check-line" />
          </span>
          <div class="risk-summary-page__coverage-main">
            <div>
              <span>管控覆盖率</span>
              <strong>{{ controlRate }}%</strong>
            </div>
            <ElProgress
              :percentage="controlRate"
              :stroke-width="7"
              :show-text="false"
              status="success"
            />
            <small>{{ overview.controlled }} / {{ overview.total }} 项已落实管控责任</small>
          </div>
        </article>
        <aside :class="{ 'is-complete': isCoverageComplete }">
          <span>
            <ArtSvgIcon
              :icon="isCoverageComplete ? 'ri:checkbox-circle-line' : 'ri:focus-3-line'"
            />
          </span>
          <div>
            <strong>{{ coverageTitle }}</strong>
            <small>{{ coverageGuidance }}</small>
          </div>
        </aside>
      </div>

      <ArtTableQuery
        ref="tableQueryRef"
        class="risk-summary-page__table"
        v-model="searchQuery"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 84 }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无风险汇总数据',
          emptyDescription: '完成风险辨识后，汇总数据将在此自动形成。'
        }"
        focusable
      />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import dayjs from 'dayjs'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useUserStore } from '@/store/modules/user'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchSafetyRiskList,
    type SmisRiskControlLevel,
    type SmisSafetyRiskOverview,
    type SmisSafetyRiskRecord,
    type SmisSafetyRiskSearchParams
  } from '@smis/api'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisDualControlRiskListSummary' })
  type TableParams = SmisSafetyRiskSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  const userStore = useUserStore()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const searchQuery = ref<SmisSafetyRiskSearchParams>({})
  const overview = reactive<SmisSafetyRiskOverview>({
    total: 0,
    evaluated: 0,
    major: 0,
    controlled: 0
  })
  const controlLevelOptions: Array<{ label: string; value: SmisRiskControlLevel }> = [
    { label: '公司级（厂级）', value: 'company' },
    { label: '车间（部门级）', value: 'department' },
    { label: '班组级', value: 'team' },
    { label: '岗位级', value: 'position' }
  ]
  const controlLevelLabel = new Map(controlLevelOptions.map((item) => [item.value, item.label]))
  const evaluationRate = computed(() =>
    overview.total ? Math.round((overview.evaluated / overview.total) * 100) : 0
  )
  const controlRate = computed(() =>
    overview.total ? Math.round((overview.controlled / overview.total) * 100) : 0
  )
  const pendingEvaluation = computed(() => Math.max(overview.total - overview.evaluated, 0))
  const pendingControl = computed(() => Math.max(overview.total - overview.controlled, 0))
  const isCoverageComplete = computed(
    () => overview.total > 0 && !pendingEvaluation.value && !pendingControl.value
  )
  const coverageTitle = computed(() =>
    !overview.total ? '暂无风险数据' : isCoverageComplete.value ? '治理链路完整' : '治理缺口提示'
  )
  const coverageGuidance = computed(() => {
    if (!overview.total) return '完成风险辨识后，可在此持续跟踪评价和管控覆盖情况。'
    if (isCoverageComplete.value) {
      return '当前风险均已完成评价并落实管控责任，请持续跟踪执行效果。'
    }
    return `还有 ${pendingEvaluation.value} 项待评价、${pendingControl.value} 项待落实管控。`
  })
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '风险总数',
      value: overview.total,
      description: '当前汇总口径',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '已评价',
      value: overview.evaluated,
      description: `覆盖率 ${evaluationRate.value}%`,
      icon: 'ri:calculator-line',
      tone: 'success'
    },
    {
      label: '重大风险',
      value: overview.major,
      description: '需优先跟踪',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    },
    {
      label: '已管控',
      value: overview.controlled,
      description: `覆盖率 ${controlRate.value}%`,
      icon: 'ri:shield-check-line',
      tone: 'primary'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '风险关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '危险编号、风险点编号或危险源' }
    },
    {
      label: '风险名称',
      key: 'riskName',
      type: 'input',
      props: { clearable: true, placeholder: '风险点名称' }
    },
    {
      label: '管控层级',
      key: 'controlLevel',
      type: 'select',
      props: { options: controlLevelOptions, clearable: true, placeholder: '全部层级' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'hazardNo', title: '危险编号' },
    { key: 'riskName', title: '风险点名称' },
    { key: 'riskPointType', title: '风险点类型' },
    { key: 'siteName', title: '环节/单位' },
    { key: 'hazardSource', title: '危险源' },
    { key: 'accidentTypes', title: '事故类型' },
    { key: 'riskDescription', title: '风险描述' },
    { key: 'engineeringMeasures', title: '工程技术措施' },
    { key: 'managementMeasures', title: '管理措施' },
    { key: 'educationMeasures', title: '教育培训措施' },
    { key: 'personalProtectionMeasures', title: '个体防护措施' },
    { key: 'emergencyMeasures', title: '应急处置措施' },
    { key: 'riskAssessmentMethod', title: '风险评估方法' },
    { key: 'riskLevelName', title: '风险等级' },
    { key: 'controlLevels', title: '管控层级' },
    { key: 'responsibleNames', title: '责任人' },
    { key: 'responsibleDepartments', title: '责任部门' },
    { key: 'identifiedBy', title: '辨识人' },
    { key: 'identifiedAt', title: '辨识时间' }
  ]
  const accidentTypeText = (row: SmisSafetyRiskRecord): string =>
    row.accidentTypes
      .map((item) => userStore.getDictItemByValue('smisAccidentCategory', item)?.label || item)
      .join('、') || '暂无事故类型'
  const measureItems = (row: SmisSafetyRiskRecord) =>
    [
      { label: '工程', value: row.engineeringMeasures },
      { label: '管理', value: row.managementMeasures },
      { label: '培训', value: row.educationMeasures },
      { label: '个防', value: row.personalProtectionMeasures },
      { label: '应急', value: row.emergencyMeasures }
    ].filter((item) => Boolean(item.value))
  const columnsFactory = (): ColumnOption<SmisSafetyRiskRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'hazardNo',
      label: '危险编号',
      width: 142,
      fixed: 'left',
      formatter: (row) => <span class="risk-summary-page__code">{row.hazardNo}</span>
    },
    {
      prop: 'riskName',
      label: '风险点 / 危险源',
      minWidth: 250,
      fixed: 'left',
      formatter: (row) => (
        <div class="risk-summary-page__identity">
          <strong>{row.riskName}</strong>
          <small>{row.hazardSource}</small>
        </div>
      )
    },
    {
      prop: 'siteName',
      label: '风险场景',
      minWidth: 210,
      formatter: (row) => (
        <div class="risk-summary-page__context">
          <ArtDictDisplay dictCode="smisRiskPointType" value={row.riskPointType} display="tag" />
          <strong>{row.siteName}</strong>
          <small>{row.organizationName || '未关联责任单位'}</small>
        </div>
      )
    },
    {
      prop: 'accidentTypes',
      label: '风险信息',
      minWidth: 240,
      formatter: (row) => (
        <div class="risk-summary-page__risk-detail">
          <strong>{accidentTypeText(row)}</strong>
          <small>{row.riskDescription || '暂无风险描述'}</small>
        </div>
      )
    },
    {
      prop: 'riskAssessmentMethod',
      label: '评价结果',
      width: 170,
      formatter: (row) => (
        <div class="risk-summary-page__assessment">
          <span style={{ '--risk-color': row.riskLevelColor || 'var(--el-color-warning)' }} />
          <div>
            <strong>{row.riskLevelName || '待评价'}</strong>
            <small>{row.riskAssessmentMethod || '尚未完成定量评价'}</small>
          </div>
        </div>
      )
    },
    {
      prop: 'engineeringMeasures',
      label: '控制措施',
      minWidth: 360,
      formatter: (row) => {
        const items = measureItems(row)
        return items.length ? (
          <div class="risk-summary-page__measures">
            {items.map((item) => (
              <span key={item.label}>
                <b>{item.label}</b>
                <em>{item.value}</em>
              </span>
            ))}
          </div>
        ) : (
          <span class="risk-summary-page__empty-value">暂无控制措施</span>
        )
      }
    },
    {
      prop: 'responsibleNames',
      label: '管控责任',
      minWidth: 230,
      formatter: (row) => (
        <div class="risk-summary-page__responsibility">
          <span>
            {row.controlLevels.map((item) => controlLevelLabel.get(item)).join('、') ||
              '未配置层级'}
          </span>
          <strong>{row.responsibleNames || '待落实'}</strong>
          <small>{row.responsibleDepartments || '未关联责任部门'}</small>
        </div>
      )
    },
    {
      prop: 'identifiedAt',
      label: '辨识信息',
      width: 170,
      formatter: (row) => (
        <div class="risk-summary-page__identity">
          <strong>{row.identifiedBy || '系统记录'}</strong>
          <small>{formatTableDateTime(row.identifiedAt)}</small>
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchSafetyRiskList({ ...params, from, to }, { showErrorMessage: false })
    if (options?.signal?.aborted) return response
    if (response.error)
      throw new Error('风险清单汇总加载失败，请重新加载', { cause: response.error })
    Object.assign(overview, response.overview)
    return response
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlRiskListSummary:Export',
      type: 'export',
      exportFilename: '风险清单汇总',
      exportSheetName: '风险汇总',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: (await loadAllDocumentPages(fetchSafetyRiskList, { ...searchQuery.value })).map(
          (row) => ({
            ...row,
            accidentTypes: row.accidentTypes.join('、'),
            controlLevels: row.controlLevels.map((item) => controlLevelLabel.get(item)).join('、'),
            identifiedAt: dayjs(row.identifiedAt).format('YYYY-MM-DD HH:mm')
          })
        )
      })
    }
  ])
  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('smisRiskPointType'),
      userStore.ensureDictLoaded('smisAccidentCategory')
    ])
  })
</script>

<style scoped lang="scss">
  .risk-summary-page {
    min-width: 0;

    &__coverage {
      display: grid;
      grid-template-columns: minmax(260px, 0.85fr) minmax(260px, 0.85fr) minmax(320px, 1.3fr);
      gap: 0;
      padding: 8px;
    }

    &__coverage article {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 11px;
      align-items: center;
      padding: 7px 14px;
    }

    &__coverage article + article {
      border-left: 1px solid var(--el-border-color-lighter);
    }

    &__coverage-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      font-size: 18px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    &__coverage-icon.is-control {
      color: var(--el-color-success);
      background: color-mix(in srgb, var(--el-color-success) 9%, var(--el-bg-color));
    }

    &__coverage-main {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    &__coverage-main > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    &__coverage-main strong {
      color: var(--theme-color);
    }

    &__coverage-main small {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    &__coverage aside {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 10px 16px;
      margin-left: 8px;
      background: color-mix(in srgb, var(--el-color-warning) 7%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    &__coverage aside > span {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      font-size: 19px;
      color: var(--el-color-warning);
      background: color-mix(in srgb, var(--el-color-warning) 12%, var(--el-bg-color));
      border-radius: 50%;
    }

    &__coverage aside.is-complete {
      background: color-mix(in srgb, var(--el-color-success) 7%, var(--el-bg-color));
    }

    &__coverage aside.is-complete > span {
      color: var(--el-color-success);
      background: color-mix(in srgb, var(--el-color-success) 12%, var(--el-bg-color));
    }

    &__coverage aside strong,
    &__coverage aside small {
      display: block;
    }

    &__coverage aside small {
      margin-top: 4px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.risk-summary-page__code) {
      font-size: 12px;
      color: var(--theme-color);
    }

    :deep(.risk-summary-page__identity),
    :deep(.risk-summary-page__context),
    :deep(.risk-summary-page__risk-detail),
    :deep(.risk-summary-page__responsibility) {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    :deep(.risk-summary-page__identity strong),
    :deep(.risk-summary-page__identity small),
    :deep(.risk-summary-page__context strong),
    :deep(.risk-summary-page__context small),
    :deep(.risk-summary-page__risk-detail strong),
    :deep(.risk-summary-page__risk-detail small),
    :deep(.risk-summary-page__responsibility strong),
    :deep(.risk-summary-page__responsibility small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.risk-summary-page__identity small),
    :deep(.risk-summary-page__context small),
    :deep(.risk-summary-page__risk-detail small),
    :deep(.risk-summary-page__responsibility small) {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.risk-summary-page__context) {
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
    }

    :deep(.risk-summary-page__context small) {
      grid-column: 2;
    }

    :deep(.risk-summary-page__assessment) {
      display: grid;
      grid-template-columns: 9px minmax(0, 1fr);
      gap: 9px;
      align-items: center;
    }

    :deep(.risk-summary-page__assessment > span) {
      width: 9px;
      height: 32px;
      background: var(--risk-color);
      border-radius: 999px;
    }

    :deep(.risk-summary-page__assessment strong),
    :deep(.risk-summary-page__assessment small) {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.risk-summary-page__assessment small) {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.risk-summary-page__measures) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 8px;
    }

    :deep(.risk-summary-page__measures > span) {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 5px;
      min-width: 0;
    }

    :deep(.risk-summary-page__measures b) {
      font-size: 11px;
      color: var(--theme-color);
    }

    :deep(.risk-summary-page__measures em) {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
      font-style: normal;
      white-space: nowrap;
    }

    :deep(.risk-summary-page__responsibility > span) {
      width: fit-content;
      max-width: 100%;
      padding: 2px 7px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      color: var(--theme-color);
      white-space: nowrap;
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-small);
    }

    :deep(.risk-summary-page__empty-value) {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }

  @media (width <= 1180px) {
    .risk-summary-page__coverage {
      grid-template-columns: 1fr 1fr;
    }

    .risk-summary-page__coverage aside {
      grid-column: 1 / -1;
      margin-top: 8px;
      margin-left: 0;
    }
  }
</style>
