<template>
  <ArtPermissionGuard permission="SmisDualControlSpecialEquipmentRiskControlStatistics:View">
    <div class="special-equipment-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="SPECIAL EQUIPMENT RISK CONTROL"
        title="特种设备风控统计"
        description="联动设备台账、风险辨识、管控措施与巡查任务，集中呈现特种设备风险控制完整度。"
        icon="ri:settings-5-line"
        density="compact"
        :tags="[
          { label: '设备台账联动', type: 'primary', effect: 'plain' },
          { label: '风险分级', type: 'warning', effect: 'light' },
          { label: '巡查闭环', type: 'success', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions>
          <ArtExcelExport
            v-auth="'SmisDualControlSpecialEquipmentRiskControlStatistics:Export'"
            :data="exportRows"
            :columns="exportColumns"
            filename="特种设备风控统计"
            sheet-name="设备风险明细"
            button-text="导出统计"
            type="primary"
            plain
            auto-index
          >
            <ArtSvgIcon icon="ri:file-excel-2-line" /> 导出统计
          </ArtExcelExport>
        </template>
      </BusinessWorkspaceHeader>

      <ElScrollbar class="special-equipment-page__scroll">
        <div class="special-equipment-page__body">
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
            description="以设备台账“特种设备”标记为主，关联风险点、风险项、管控措施及巡查任务；未建立风险点的设备仍保留展示。"
          />

          <ArtSectionCard
            title="风险分级控制矩阵"
            subtitle="对比各风险级别下的设备、风险点、风险项和控制措施"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.loading && !state.error && !state.data.riskLevelStats.length"
            empty-title="暂无风险分级数据"
            empty-description="特种设备关联风险点并完成风险评价后会形成分级矩阵。"
            :min-height="200"
            @retry="loadData"
          >
            <div class="special-equipment-page__levels">
              <article
                v-for="item in state.data.riskLevelStats"
                :key="item.riskLevelCode"
                :style="{ '--level-color': item.color || 'var(--el-color-info)' }"
              >
                <header
                  ><span></span><strong>{{ item.riskLevelName }}</strong></header
                >
                <div
                  ><p
                    ><b>{{ item.equipmentCount }}</b
                    ><small>设备</small></p
                  ><p
                    ><b>{{ item.riskPointCount }}</b
                    ><small>风险点</small></p
                  ><p
                    ><b>{{ item.riskItemCount }}</b
                    ><small>风险项</small></p
                  ><p
                    ><b>{{ item.measureCount }}</b
                    ><small>措施</small></p
                  ></div
                >
              </article>
            </div>
          </ArtSectionCard>

          <div class="special-equipment-page__charts">
            <ArtSectionCard
              title="设备类别分布"
              subtitle="按设备台账类别统计特种设备数量"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.categoryStats.length"
              empty-title="暂无设备类别数据"
              empty-description="请先在设备台账维护特种设备标识。"
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
              title="巡查周期执行"
              subtitle="按计划周期汇总已生成和已完成任务"
              :loading="state.loading"
              :error="state.error"
              :empty="!state.loading && !state.error && !state.data.cycleStats.length"
              empty-title="暂无巡查周期数据"
              empty-description="特种设备风险点生成巡查任务后会自动归集。"
              :min-height="350"
              @retry="loadData"
            >
              <ArtTable
                :data="state.data.cycleStats"
                :columns="cycleColumns"
                :pagination="false"
                table-layout="fixed"
                max-height="295"
                empty-text="暂无周期任务"
              />
            </ArtSectionCard>
          </div>

          <ArtSectionCard
            title="组织风控成效"
            subtitle="按设备使用组织汇总设备、风险点与巡查完成情况"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.loading && !state.error && !state.data.organizationStats.length"
            empty-title="暂无组织风控数据"
            empty-description="设备配置使用组织后会自动进入统计。"
            :min-height="280"
            @retry="loadData"
          >
            <ArtTable
              :data="state.data.organizationStats"
              :columns="organizationColumns"
              :pagination="false"
              table-layout="fixed"
              max-height="330"
              empty-text="暂无组织统计"
            />
          </ArtSectionCard>

          <ArtSectionCard
            title="设备风险明细"
            subtitle="保留未关联风险点或未评价设备，便于发现数据治理缺口"
            :loading="state.loading"
            :error="state.error"
            :empty="!state.loading && !state.error && !state.data.riskDetails.length"
            empty-title="当前范围暂无特种设备"
            empty-description="请检查设备台账的特种设备标记和组织归属。"
            :min-height="400"
            @retry="loadData"
          >
            <ArtTable
              :data="state.data.riskDetails"
              :columns="detailColumns"
              :pagination="false"
              table-layout="fixed"
              max-height="450"
              empty-text="暂无设备风险明细"
            />
          </ArtSectionCard>
        </div>
      </ElScrollbar>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { emptySpecialEquipmentRiskControl } from '@smis/domain/report-defaults'
  import { formatPercentValue } from '@/utils/ui/format'
  import { ElProgress, ElTag } from 'element-plus'
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
    fetchSpecialEquipmentRiskControlStatistics,
    type SmisSpecialEquipmentCycleStat,
    type SmisSpecialEquipmentOrganizationStat,
    type SmisSpecialEquipmentRiskControlStatisticsResult,
    type SmisSpecialEquipmentRiskDetail
  } from '@smis/api'
  import { toDualControlOrganizationTree } from '../../shared/organization-tree'
  import ReportDefinitionStrip from '../shared/report-definition-strip.vue'

  defineOptions({ name: 'SmisDualControlSpecialEquipmentRiskControlStatistics' })
  interface EquipmentQuery extends Record<string, unknown> {
    organizationId?: string
  }

  const query = ref<EquipmentQuery>({ organizationId: undefined })
  const state = reactive<{
    loading: boolean
    error: string | null
    data: SmisSpecialEquipmentRiskControlStatisticsResult
  }>({ loading: false, error: null, data: emptySpecialEquipmentRiskControl() })
  const organizationOptions = computed(() =>
    toDualControlOrganizationTree(state.data.organizationOptions)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '设备使用组织',
      key: 'organizationId',
      span: 8,
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
      label: '特种设备',
      value: state.data.overview.equipmentCount,
      description: '台账启用设备',
      icon: 'ri:settings-5-line'
    },
    {
      label: '关联风险点',
      value: state.data.overview.riskPointCount,
      description: `${state.data.overview.highRiskPointCount} 个高风险点`,
      icon: 'ri:map-pin-line',
      tone: state.data.overview.highRiskPointCount ? 'danger' : 'info'
    },
    {
      label: '风险项',
      value: state.data.overview.riskItemCount,
      description: '已辨识风险因素',
      icon: 'ri:shield-flash-line'
    },
    {
      label: '管控措施',
      value: state.data.overview.measureCount,
      description: '已配置控制措施',
      icon: 'ri:list-check-3'
    },
    {
      label: '巡查完成率',
      value: `${state.data.overview.inspectionRate}%`,
      description: `${state.data.overview.completedTaskCount}/${state.data.overview.taskCount} 项`,
      icon: 'ri:progress-4-line',
      tone: state.data.overview.inspectionRate >= 90 ? 'success' : 'warning'
    }
  ])
  const categoryStats = computed(() => state.data.categoryStats.slice(0, 10).reverse())
  const categoryLabels = computed(() => categoryStats.value.map((row) => row.categoryName))
  const categoryValues = computed(() => categoryStats.value.map((row) => row.equipmentCount))
  const cycleLabel = (unit: string): string =>
    (
      ({
        shift: '每班',
        day: '每日',
        ten_day: '每旬',
        week: '每周',
        month: '每月',
        quarter: '每季',
        year: '每年'
      }) as Record<string, string>
    )[unit] || unit
  const cycleColumns: ColumnOption<SmisSpecialEquipmentCycleStat>[] = [
    {
      prop: 'frequencyUnit',
      label: '巡查周期',
      minWidth: 110,
      formatter: (row) => cycleLabel(row.frequencyUnit)
    },
    { prop: 'taskCount', label: '生成任务', width: 96, align: 'right' },
    { prop: 'completedCount', label: '完成任务', width: 96, align: 'right' },
    {
      prop: 'completionRate',
      label: '完成率',
      width: 160,
      formatter: (row) => (
        <div class="special-equipment-page__rate">
          <ElProgress percentage={row.completionRate} strokeWidth={7} />
        </div>
      )
    }
  ]
  const organizationColumns: ColumnOption<SmisSpecialEquipmentOrganizationStat>[] = [
    { type: 'globalIndex', label: '序号', width: 66 },
    {
      prop: 'organizationName',
      label: '使用组织',
      minWidth: 190,
      fixed: 'left',
      showOverflowTooltip: true
    },
    { prop: 'equipmentCount', label: '设备数', width: 96, align: 'right' },
    { prop: 'riskPointCount', label: '风险点', width: 96, align: 'right' },
    { prop: 'taskCount', label: '巡查任务', width: 104, align: 'right' },
    { prop: 'completedTaskCount', label: '完成任务', width: 104, align: 'right' },
    {
      prop: 'inspectionRate',
      label: '巡查完成率',
      width: 180,
      formatter: (row) => (
        <div class="special-equipment-page__org-rate">
          <ElProgress
            percentage={row.inspectionRate}
            format={(value) => formatPercentValue(value, { fractionDigits: 2 })}
            strokeWidth={7}
            color={row.inspectionRate >= 90 ? 'var(--el-color-success)' : 'var(--theme-color)'}
          />
        </div>
      )
    }
  ]
  const detailColumns: ColumnOption<SmisSpecialEquipmentRiskDetail>[] = [
    { type: 'globalIndex', label: '序号', width: 66 },
    { prop: 'equipmentCode', label: '设备编号', width: 150, fixed: 'left' },
    {
      prop: 'equipmentName',
      label: '设备名称',
      minWidth: 190,
      fixed: 'left',
      showOverflowTooltip: true
    },
    { prop: 'categoryName', label: '设备类别', width: 130, showOverflowTooltip: true },
    { prop: 'organizationName', label: '使用组织', minWidth: 170, showOverflowTooltip: true },
    { prop: 'riskPointName', label: '风险点', minWidth: 170, showOverflowTooltip: true },
    {
      prop: 'riskLevelName',
      label: '风险级别',
      width: 112,
      formatter: (row) => (
        <ElTag effect="light" style={{ color: row.riskLevelColor || undefined }}>
          {row.riskLevelName}
        </ElTag>
      )
    },
    { prop: 'riskItemCount', label: '风险项', width: 88, align: 'right' },
    { prop: 'hazardFactors', label: '危险因素', minWidth: 220, showOverflowTooltip: true },
    { prop: 'measureCount', label: '措施数', width: 88, align: 'right' },
    { prop: 'controlMeasures', label: '防控措施', minWidth: 240, showOverflowTooltip: true },
    { prop: 'taskCount', label: '巡查任务', width: 100, align: 'right' },
    {
      prop: 'inspectionRate',
      label: '完成率',
      width: 96,
      align: 'right',
      formatter: (row) => formatPercentValue(row.inspectionRate || 0, { fractionDigits: 2 })
    }
  ]
  const exportRows = computed(() =>
    state.data.riskDetails.map((row) => ({
      ...row,
      inspectionRate: formatPercentValue(row.inspectionRate || 0, { fractionDigits: 2 })
    }))
  )
  const exportColumns = {
    equipmentCode: { title: '设备编号' },
    equipmentName: { title: '设备名称', width: 26 },
    categoryName: { title: '设备类别' },
    organizationName: { title: '使用组织', width: 22 },
    riskPointName: { title: '风险点', width: 22 },
    riskLevelName: { title: '风险级别' },
    riskItemCount: { title: '风险项' },
    hazardFactors: { title: '危险因素', width: 36 },
    measureCount: { title: '措施数' },
    controlMeasures: { title: '防控措施', width: 40 },
    taskCount: { title: '巡查任务' },
    completedTaskCount: { title: '完成任务' },
    inspectionRate: { title: '完成率' }
  }
  const loadData = async (): Promise<void> => {
    state.loading = true
    state.error = null
    try {
      const result = await fetchSpecialEquipmentRiskControlStatistics({
        organizationId: query.value.organizationId
      })
      const organizationOptions = result.organizationOptions.length
        ? result.organizationOptions
        : state.data.organizationOptions
      state.data = { ...result, organizationOptions }
      if (result.error) state.error = '特种设备风控统计加载失败，请重试。'
    } catch {
      state.error = '特种设备风控统计加载失败，请重试。'
    } finally {
      state.loading = false
    }
  }
  const resetQuery = (): void => {
    query.value.organizationId = undefined
    void loadData()
  }
  onMounted(loadData)
</script>

<style scoped lang="scss">
  .special-equipment-page {
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

    &__levels {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;

      article {
        padding: 14px 16px;
        background: color-mix(in srgb, var(--level-color) 6%, var(--el-bg-color));
        border: 1px solid color-mix(in srgb, var(--level-color) 24%, var(--el-border-color-lighter));
        border-radius: var(--el-border-radius-base);

        header {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 14px;

          span {
            width: 8px;
            height: 8px;
            background: var(--level-color);
            border-radius: 50%;
            box-shadow: 0 0 0 4px color-mix(in srgb, var(--level-color) 14%, transparent);
          }
        }

        > div {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        p {
          display: grid;
          gap: 2px;
          margin: 0;

          b {
            font-size: 20px;
            font-variant-numeric: tabular-nums;
          }

          small {
            color: var(--el-text-color-secondary);
          }
        }
      }
    }

    &__charts {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(420px, 0.9fr);
      gap: var(--art-space-4);
      min-width: 0;
    }

    &__rate {
      width: 128px;
      margin-inline: auto;
    }

    &__org-rate {
      width: 150px;
      margin-inline: auto;
    }

    @media (width <= 1120px) {
      &__charts {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
