<template>
  <ArtPermissionGuard permission="SmisSafetyQualificationReportAnalysis:View">
    <div class="qualification-analysis business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="SAFETY QUALIFICATION INSIGHTS"
        title="安全资质报表分析"
        description="围绕组织、持证人员、提醒变化、作业项目、注册类别与学历，形成统一的安全资质管理视图。"
        icon="ri:bar-chart-grouped-line"
        :tags="[
          { label: '10 个统计口径', type: 'primary', effect: 'plain' },
          { label: '到期风险时间窗', type: 'warning', effect: 'light' },
          { label: '租户数据隔离', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      />

      <ElScrollbar class="qualification-analysis__scroll">
        <div class="qualification-analysis__body">
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

          <div class="qualification-analysis__window" role="note">
            <div>
              <ArtSvgIcon icon="ri:calendar-check-line" />
              <span>统计时间窗</span>
              <strong>{{ periodLabel }}</strong>
            </div>
            <p
              >提醒按“有效日期 −
              提前提醒天数”统计；消除提醒按实际消除时间统计；新增按证件创建时间统计。</p
            >
          </div>

          <div class="qualification-analysis__charts">
            <ArtSectionCard
              title="一、组织证件分布"
              subtitle="按员工所在组织汇总五类安全资质证件"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.data.organizationDistribution.length"
              empty-title="当前范围暂无安全资质证件"
              empty-description="新增人员证件后会自动形成组织分布。"
              :min-height="380"
              @retry="loadData"
            >
              <ArtBarChart
                height="330px"
                :x-axis-data="organizationLabels"
                :data="organizationSeries"
                show-legend
                legend-position="bottom"
                stack
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="证件类别构成"
              subtitle="当前筛选范围内五类证件占比"
              :loading="state.loading"
              :error="state.error"
              :empty="!certificateComposition.length"
              empty-title="暂无证件类别构成"
              empty-description="证件台账建立后即可生成。"
              :min-height="380"
              @retry="loadData"
            >
              <ArtRingChart
                height="330px"
                :data="certificateComposition"
                :center-text="`${state.data.overview.totalCertificates} 张`"
                show-legend
                legend-position="right"
              />
            </ArtSectionCard>
          </div>

          <ArtSectionCard
            title="组织证件分布统计表"
            subtitle="图表与表格共用同一统计口径，便于核对与导出前检查"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.data.organizationDistribution.length"
            empty-title="暂无组织证件统计"
            empty-description="调整筛选条件，或在证件台账中补充人员证件。"
            :min-height="260"
            @retry="loadData"
          >
            <ArtTable
              :data="state.data.organizationDistribution"
              :columns="organizationColumns"
              :pagination="false"
              table-layout="fixed"
            />
          </ArtSectionCard>

          <div class="qualification-analysis__details">
            <ArtSectionCard
              title="二、持证数量前 10 名"
              subtitle="按人员持有的不同证件数量排序"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.data.topHolders.length"
              empty-title="暂无持证人员排行"
              empty-description="录入人员证件后可按持证数量查看排行。"
              :min-height="430"
              @retry="loadData"
            >
              <ArtTable
                :data="state.data.topHolders"
                :columns="holderColumns"
                :pagination="false"
                table-layout="fixed"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="三至五、期间变化"
              subtitle="触发提醒、消除提醒与新增证件的组织分布"
              :loading="state.loading"
              :error="state.error"
              :empty="!activePeriodRows.length"
              empty-title="当前期间暂无变化记录"
              empty-description="调整统计时间窗，或在新增证件及提醒发生后查看变化。"
              :min-height="430"
              @retry="loadData"
            >
              <template #actions>
                <ElSegmented v-model="activePeriodMetric" :options="periodMetricOptions" />
              </template>
              <ArtBarChart
                height="270px"
                :x-axis-data="activePeriodRows.map((item) => item.organizationName)"
                :data="periodSeries"
                show-legend
                legend-position="bottom"
                stack
              />
            </ArtSectionCard>
          </div>

          <div class="qualification-analysis__details">
            <ArtSectionCard
              title="六、特种设备作业项目"
              subtitle="安全管理人员证与作业人员证按作业项目统计"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.data.equipmentProjects.length"
              empty-title="暂无特种设备作业项目数据"
              empty-description="录入对应作业人员证件后可按项目统计。"
              :min-height="360"
              @retry="loadData"
            >
              <ArtTable
                :data="state.data.equipmentProjects"
                :columns="equipmentProjectColumns"
                :pagination="false"
                table-layout="fixed"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="七、特种作业准操项目"
              subtitle="按作业类别与准操项目统计持证人数"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.data.specialOperations.length"
              empty-title="暂无特种作业准操项目数据"
              empty-description="录入对应特种作业证件后可按准操项目统计。"
              :min-height="360"
              @retry="loadData"
            >
              <ArtTable
                :data="state.data.specialOperations"
                :columns="specialOperationColumns"
                :pagination="false"
                table-layout="fixed"
              />
            </ArtSectionCard>
          </div>

          <div class="qualification-analysis__types">
            <ArtSectionCard
              title="八、安全管理人员证类别"
              subtitle="按单位类型与职业类型统计"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.data.safetyManagerTypes.length"
              empty-title="暂无安全管理人员证类别数据"
              empty-description="录入安全管理人员证后可查看类别分布。"
              :min-height="330"
              @retry="loadData"
            >
              <ArtTable
                :data="safetyManagerTypeRows"
                :columns="dimensionColumns"
                :pagination="false"
                table-layout="fixed"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="九、注册安全工程师类别"
              subtitle="按安全员、工程师与注册类别统计"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.data.registeredEngineerTypes.length"
              empty-title="暂无注册安全工程师类别数据"
              empty-description="录入注册安全工程师证后可查看类别分布。"
              :min-height="330"
              @retry="loadData"
            >
              <ArtTable
                :data="registeredEngineerTypeRows"
                :columns="dimensionColumns"
                :pagination="false"
                table-layout="fixed"
              />
            </ArtSectionCard>

            <ArtSectionCard
              title="十、持证人员学历分布"
              subtitle="对比安全管理人员证与注册安全工程师证的学历构成"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.data.educationDistribution.length"
              empty-title="暂无持证人员学历数据"
              empty-description="在人员档案中补充学历后可查看分布。"
              :min-height="330"
              @retry="loadData"
            >
              <ArtBarChart
                height="280px"
                :x-axis-data="educationLabels"
                :data="educationSeries"
                show-legend
                legend-position="bottom"
              />
            </ArtSectionCard>
          </div>
        </div>
      </ElScrollbar>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { emptySafetyQualificationAnalysis } from '@smis/domain/report-defaults'
  import dayjs from 'dayjs'
  import { useAsyncState } from '@vueuse/core'
  import type { BarDataItem, PieDataItem } from '@/types/component/chart'
  import type { ColumnOption } from '@/types'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtSearchBar, {
    type SearchFormItem
  } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtBarChart from '@/components/core/charts/art-bar-chart/index.vue'
  import ArtRingChart from '@/components/core/charts/art-ring-chart/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchSafetyQualificationAnalysis,
    type SmisCertificateCategory,
    type SmisSafetyQualificationDimensionStat,
    type SmisSafetyQualificationEquipmentProjectStat,
    type SmisSafetyQualificationHolderStat,
    type SmisSafetyQualificationOrganizationStat,
    type SmisSafetyQualificationPeriodStat,
    type SmisSafetyQualificationSpecialOperationStat
  } from '@smis/api'

  defineOptions({ name: 'SmisSafetyQualificationReportAnalysis' })

  type PeriodMetric = SmisSafetyQualificationPeriodStat['metric']
  interface AnalysisQuery extends Record<string, unknown> {
    dateRange?: [string, string]
    organizationId?: string
  }
  interface DimensionRow extends SmisSafetyQualificationDimensionStat {
    dimensionLabel: string
    valueLabel: string
  }

  const initialQuery = (): AnalysisQuery => ({
    dateRange: [dayjs().startOf('year').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
    organizationId: undefined
  })
  const userStore = useUserStore()
  const query = ref<AnalysisQuery>(initialQuery())
  const request = useAsyncState(
    async (params: Parameters<typeof fetchSafetyQualificationAnalysis>[0]) => {
      const result = await fetchSafetyQualificationAnalysis(params, { showErrorMessage: false })
      if (result.error) {
        throw new Error('安全资质统计加载失败，请重试。', { cause: result.error })
      }
      return result
    },
    emptySafetyQualificationAnalysis(),
    {
      immediate: false,
      resetOnExecute: false,
      // The report cards own recoverable errors; preserve the diagnostic cause without a toast.
      onError: () => undefined
    }
  )
  const state = reactive({
    loading: request.isLoading,
    error: computed(() => (request.error.value ? '安全资质统计加载失败，请重试。' : null)),
    data: request.state
  })
  const activePeriodMetric = ref<PeriodMetric>('reminder')
  const periodMetricOptions = [
    { label: '触发提醒', value: 'reminder' },
    { label: '消除提醒', value: 'dismissed' },
    { label: '新增证件', value: 'added' }
  ]
  const categoryKeys: Array<{
    key: keyof Pick<
      SmisSafetyQualificationOrganizationStat,
      | 'specialEquipmentPersonnel'
      | 'specialEquipmentOperator'
      | 'specialOperation'
      | 'safetyManager'
      | 'registeredSafetyEngineer'
    >
    category: SmisCertificateCategory
  }> = [
    { key: 'specialEquipmentPersonnel', category: 'special_equipment_personnel' },
    { key: 'specialEquipmentOperator', category: 'special_equipment_operator' },
    { key: 'specialOperation', category: 'special_operation' },
    { key: 'safetyManager', category: 'safety_manager' },
    { key: 'registeredSafetyEngineer', category: 'registered_safety_engineer' }
  ]

  const categoryLabel = (value: SmisCertificateCategory): string =>
    userStore.getDictLabelByValue('smisCertificateCategory', value) || value || '未维护'
  const periodLabel = computed(() =>
    query.value.dateRange?.length === 2
      ? `${query.value.dateRange[0]} — ${query.value.dateRange[1]}`
      : '全部时间'
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '证件总数',
      value: state.data.overview.totalCertificates,
      description: `${state.data.overview.certificateHolders} 名持证人员`,
      icon: 'ri:award-line'
    },
    {
      label: '预警证件',
      value: state.data.overview.warningCount,
      description: '台账预警状态',
      icon: 'ri:alarm-warning-line',
      tone: state.data.overview.warningCount ? 'warning' : 'success'
    },
    {
      label: '期间到期',
      value: state.data.overview.expiringInRange,
      description: periodLabel.value,
      icon: 'ri:calendar-close-line',
      tone: state.data.overview.expiringInRange ? 'danger' : undefined
    },
    {
      label: '新增 / 消除',
      value: `${state.data.overview.addedInRange} / ${state.data.overview.dismissedInRange}`,
      description: '期间业务变化',
      icon: 'ri:swap-box-line',
      tone: 'primary'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '统计时间',
      key: 'dateRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        rangeSeparator: '至',
        clearable: false
      }
    },
    {
      label: '所属组织',
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

  const organizationLabels = computed(() =>
    state.data.organizationDistribution.map((item) => item.organizationName)
  )
  const organizationSeries = computed<BarDataItem[]>(() =>
    categoryKeys.map(({ key, category }) => ({
      name: categoryLabel(category),
      stack: 'certificate',
      data: state.data.organizationDistribution.map((item) => item[key])
    }))
  )
  const certificateComposition = computed<PieDataItem[]>(() =>
    categoryKeys
      .map(({ key, category }) => ({
        name: categoryLabel(category),
        value: state.data.organizationDistribution.reduce((total, item) => total + item[key], 0)
      }))
      .filter((item) => item.value > 0)
  )
  const activePeriodRows = computed(() =>
    state.data.periodStats.filter((item) => item.metric === activePeriodMetric.value)
  )
  const periodSeries = computed<BarDataItem[]>(() =>
    categoryKeys.map(({ key, category }) => ({
      name: categoryLabel(category),
      stack: activePeriodMetric.value,
      data: activePeriodRows.value.map((item) => item[key])
    }))
  )
  const educationLabels = computed(() =>
    state.data.educationDistribution.map(
      (item) =>
        userStore.getDictLabelByValue('hrEducationLevel', item.educationLevel) ||
        item.educationLevel ||
        '未维护'
    )
  )
  const educationSeries = computed<BarDataItem[]>(() => [
    {
      name: '安全管理人员证',
      data: state.data.educationDistribution.map((item) => item.safetyManagerCount)
    },
    {
      name: '注册安全工程师证',
      data: state.data.educationDistribution.map((item) => item.registeredSafetyEngineerCount)
    }
  ])

  const organizationColumns: ColumnOption<SmisSafetyQualificationOrganizationStat>[] = [
    { type: 'globalIndex', label: '序号', width: 72, fixed: 'left' },
    {
      prop: 'organizationName',
      label: '组织名称',
      minWidth: 180,
      fixed: 'left',
      showOverflowTooltip: true
    },
    {
      prop: 'specialEquipmentPersonnel',
      label: '特种设备安全管理',
      minWidth: 150,
      align: 'right'
    },
    {
      prop: 'specialEquipmentOperator',
      label: '特种设备作业人员',
      minWidth: 150,
      align: 'right'
    },
    { prop: 'specialOperation', label: '特种作业操作证', minWidth: 140, align: 'right' },
    { prop: 'safetyManager', label: '安全管理人员证', minWidth: 140, align: 'right' },
    {
      prop: 'registeredSafetyEngineer',
      label: '注册安全工程师',
      minWidth: 140,
      align: 'right'
    },
    { prop: 'total', label: '小计', width: 90, align: 'right', fixed: 'right' }
  ]
  const holderColumns: ColumnOption<SmisSafetyQualificationHolderStat>[] = [
    { type: 'globalIndex', label: '排名', width: 72 },
    { prop: 'employeeName', label: '姓名', width: 110 },
    {
      prop: 'organizationName',
      label: '所在组织',
      minWidth: 170,
      showOverflowTooltip: true
    },
    { prop: 'certificateCount', label: '证件数', width: 88, align: 'right' },
    {
      prop: 'certificateCategories',
      label: '证件类别',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.certificateCategories.map(categoryLabel).join('、')
    }
  ]
  const equipmentProjectColumns: ColumnOption<SmisSafetyQualificationEquipmentProjectStat>[] = [
    { type: 'globalIndex', label: '序号', width: 72 },
    { prop: 'workName', label: '作业项目', minWidth: 180, showOverflowTooltip: true },
    { prop: 'workCode', label: '项目代号', width: 100 },
    { prop: 'safetyManagerCount', label: '安全管理人员', minWidth: 130, align: 'right' },
    { prop: 'operatorCount', label: '作业人员', minWidth: 120, align: 'right' },
    { prop: 'total', label: '合计', width: 88, align: 'right' }
  ]
  const specialOperationColumns: ColumnOption<SmisSafetyQualificationSpecialOperationStat>[] = [
    { type: 'globalIndex', label: '序号', width: 72 },
    {
      prop: 'workCategoryName',
      label: '作业类别',
      minWidth: 160,
      showOverflowTooltip: true
    },
    { prop: 'workName', label: '准操项目', minWidth: 200, showOverflowTooltip: true },
    { prop: 'count', label: '人数', width: 90, align: 'right' }
  ]
  const dimensionDictionary: Record<SmisSafetyQualificationDimensionStat['dimension'], string> = {
    unitType: 'smisSafetyManagerUnitType',
    occupationType: 'smisSafetyManagerOccupationType',
    safetyOfficerType: 'smisRegisteredSafetyOfficerType',
    engineerType: 'smisRegisteredEngineerType',
    practiceCategory: 'smisRegisteredPracticeCategory'
  }
  const dimensionNames: Record<SmisSafetyQualificationDimensionStat['dimension'], string> = {
    unitType: '单位类型',
    occupationType: '职业类型',
    safetyOfficerType: '安全员类别',
    engineerType: '工程师类别',
    practiceCategory: '注册类别'
  }
  const toDimensionRows = (rows: SmisSafetyQualificationDimensionStat[]): DimensionRow[] =>
    rows.map((item) => ({
      ...item,
      dimensionLabel: dimensionNames[item.dimension],
      valueLabel:
        userStore.getDictLabelByValue(dimensionDictionary[item.dimension], item.value) ||
        item.value ||
        '未维护'
    }))
  const safetyManagerTypeRows = computed(() => toDimensionRows(state.data.safetyManagerTypes))
  const registeredEngineerTypeRows = computed(() =>
    toDimensionRows(state.data.registeredEngineerTypes)
  )
  const dimensionColumns: ColumnOption<DimensionRow>[] = [
    { prop: 'dimensionLabel', label: '统计维度', width: 120 },
    { prop: 'valueLabel', label: '类别名称', minWidth: 160, showOverflowTooltip: true },
    { prop: 'count', label: '人数', width: 88, align: 'right' }
  ]

  const loadData = async (): Promise<void> => {
    await request.executeImmediate({
      startDate: query.value.dateRange?.[0],
      endDate: query.value.dateRange?.[1],
      organizationId: query.value.organizationId
    })
  }
  const resetQuery = (): void => {
    Object.assign(query.value, initialQuery())
    activePeriodMetric.value = 'reminder'
    void loadData()
  }

  onMounted(async () => {
    await Promise.all(
      [
        'smisCertificateCategory',
        'smisSafetyManagerUnitType',
        'smisSafetyManagerOccupationType',
        'smisRegisteredSafetyOfficerType',
        'smisRegisteredEngineerType',
        'smisRegisteredPracticeCategory',
        'hrEducationLevel'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
    await loadData()
  })
</script>

<style scoped lang="scss">
  .qualification-analysis {
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

    &__window {
      display: flex;
      gap: 20px;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
      padding: 12px 16px;
      color: var(--art-gray-800);
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);

      div {
        display: flex;
        flex: none;
        gap: 8px;
        align-items: center;
      }

      span,
      p {
        color: var(--el-text-color-secondary);
      }

      p {
        min-width: 0;
        margin: 0;
        font-size: 12px;
        text-align: right;
      }
    }

    &__charts,
    &__details,
    &__types {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(340px, 0.8fr);
      gap: 14px;
      min-width: 0;
    }

    &__details {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    &__types {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    @media (width <= 1180px) {
      &__types {
        grid-template-columns: repeat(2, minmax(0, 1fr));

        > :last-child {
          grid-column: 1 / -1;
        }
      }
    }

    @media (width <= 1060px) {
      &__charts,
      &__details,
      &__types {
        grid-template-columns: 1fr;
      }

      &__types > :last-child {
        grid-column: auto;
      }
    }

    @media (width <= 720px) {
      &__window {
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;

        p {
          text-align: left;
        }
      }
    }
  }
</style>
