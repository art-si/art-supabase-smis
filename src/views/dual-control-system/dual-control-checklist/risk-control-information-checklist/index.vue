<template>
  <ArtPermissionGuard
    permission="SmisDualControlRiskControlInformationChecklist:View"
    resource-name="风险管控信息清单"
  >
    <div class="risk-information-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="risk-information-page__overview"
        eyebrow="RISK CONTROL REGISTER"
        title="风险管控信息清单"
        description="贯通风险辨识、定量评价、岗位措施与巡查异常，形成可追溯的风险管控底账。"
        icon="ri:shield-check-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="risk-information-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 84, showExpand: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          showOverflowTooltip: true,
          emptyText: '暂无风险管控信息',
          emptyDescription: '完成风险辨识与评价后，清单会自动汇总管控措施。'
        }"
        focusable
      />

      <RiskControlDetailDrawer ref="detailRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { ElTag } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
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
    fetchRiskControlInformationList,
    fetchSiteList,
    type SmisRiskControlInformationOverview,
    type SmisRiskControlInformationRecord,
    type SmisRiskControlInformationSearchParams,
    type SmisSite
  } from '@smis/api'
  import { useChecklistOptions } from '../shared/use-checklist-options'
  import RiskControlDetailDrawer, {
    type RiskControlDetailOpenData
  } from './modules/risk-control-detail-drawer.vue'

  const commonBooleanOptions = useDictionaryOptions('commonBoolean', (value) => value === 'true')

  defineOptions({ name: 'SmisDualControlRiskControlInformationChecklist' })

  type TableParams = SmisRiskControlInformationSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DetailExpose {
    handleOpen: (data: RiskControlDetailOpenData) => Promise<void>
  }

  const tableQueryRef = ref<ArtTableQueryExpose>()
  const detailRef = ref<DetailExpose>()
  const searchQuery = ref<TableParams>({ current: 1, size: 20 })
  const sites = shallowRef<SmisSite[]>([])
  const overview = reactive<SmisRiskControlInformationOverview>({
    total: 0,
    evaluated: 0,
    major: 0,
    controlled: 0,
    generatedHazards: 0
  })
  const {
    organizationTree,
    organizationTreeProps,
    dictionaryOptions,
    getDictDisplayLabelByValue,
    loadOptions
  } = useChecklistOptions(['smisRiskLevel', 'smisAccidentCategory'])

  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '风险辨识联动', type: 'primary', effect: 'plain' },
    { label: '评价措施同源', type: 'success', effect: 'light' },
    { label: '巡查异常追溯', type: 'warning', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '风险项',
      value: overview.total,
      description: '当前筛选口径',
      icon: 'ri:focus-3-line'
    },
    {
      label: '已评价',
      value: overview.evaluated,
      description: '完成定量评价',
      icon: 'ri:calculator-line',
      tone: 'success'
    },
    {
      label: '重大风险',
      value: overview.major,
      description: '需要优先关注',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    },
    {
      label: '已落实措施',
      value: overview.controlled,
      description: `巡查转隐患 ${overview.generatedHazards} 项`,
      icon: 'ri:shield-check-line',
      tone: 'primary'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '风险关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '危险编号、风险点或危险源' }
    },
    {
      label: '辨识单位',
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
        ariaLabel: '辨识单位',
        placeholder: '全部单位'
      }
    },
    {
      label: '场所',
      key: 'siteId',
      type: 'select',
      props: {
        clearable: true,
        filterable: true,
        placeholder: '全部场所',
        options: sites.value.map((item) => ({ label: item.siteName, value: item.id }))
      }
    },
    {
      label: '风险等级',
      key: 'riskLevel',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部等级',
        options: dictionaryOptions('smisRiskLevel')
      }
    },
    {
      label: '特种设备',
      key: 'isSpecialEquipment',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部',
        options: commonBooleanOptions
      }
    }
  ])
  const accidentText = (values: string[]): string =>
    values.length
      ? values
          .map((value) => getDictDisplayLabelByValue('smisAccidentCategory', value, value || '—'))
          .join('、')
      : '—'
  const assessmentText = (row: SmisRiskControlInformationRecord): string => {
    if (!row.methodCode) return '待评价'
    const values = [row.lValue, row.eValue, row.cValue, row.sValue].filter((value) => value != null)
    return `${row.methodCode} · ${values.join(' × ')} = ${row.riskScore ?? '—'}`
  }
  const openDetail = (row: SmisRiskControlInformationRecord): void => {
    void detailRef.value?.handleOpen({ row })
  }
  const columnsFactory = (): ColumnOption<SmisRiskControlInformationRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68, fixed: 'left' },
    {
      prop: 'hazardNo',
      label: '风险身份',
      width: 176,
      fixed: 'left',
      formatter: (row) => (
        <button type="button" class="risk-information-page__link" onClick={() => openDetail(row)}>
          <strong>{row.hazardNo}</strong>
          <small>{row.pointNo}</small>
        </button>
      )
    },
    {
      prop: 'organizationNames',
      label: '辨识单位与场所',
      minWidth: 220,
      formatter: (row) => (
        <div class="risk-information-page__stack">
          <strong>{row.organizationNames}</strong>
          <small>
            {row.siteName} · {row.identificationLocation}
          </small>
        </div>
      )
    },
    {
      prop: 'equipmentFacility',
      label: '设备 / 作业活动',
      minWidth: 210,
      formatter: (row) => (
        <div class="risk-information-page__stack">
          <strong>{row.equipmentFacility}</strong>
          <small>{row.activityNames}</small>
        </div>
      )
    },
    {
      prop: 'hazardFactor',
      label: '危险有害因素',
      minWidth: 180,
      formatter: (row) => (
        <div class="risk-information-page__stack">
          <strong>{row.hazardFactor}</strong>
          <small>{accidentText(row.accidentTypes)}</small>
        </div>
      )
    },
    {
      prop: 'riskLevelName',
      label: '风险评价',
      minWidth: 176,
      formatter: (row) => (
        <div class="risk-information-page__assessment">
          <span
            style={{ '--risk-color': row.riskLevelColor || 'var(--el-color-info)' }}
            aria-hidden="true"
          />
          <div>
            <strong>{row.riskLevelName || '待评价'}</strong>
            <small>{assessmentText(row)}</small>
          </div>
        </div>
      )
    },
    {
      prop: 'measureCount',
      label: '管控覆盖',
      minWidth: 190,
      formatter: (row) => (
        <div class="risk-information-page__coverage">
          <ElTag effect="plain">措施 {row.measureCount}</ElTag>
          <ElTag type="success" effect="plain">
            岗位 {row.linkedPositionCount}
          </ElTag>
          <ElTag type={row.generatedHazardCount ? 'warning' : 'info'} effect="plain">
            隐患 {row.generatedHazardCount}
          </ElTag>
        </div>
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 64,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonTable
          type="view"
          icon="ri:eye-line"
          label="查看风险管控详情"
          permission="SmisDualControlRiskControlInformationChecklist:ViewDetail"
          onClick={() => openDetail(row)}
        />
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'hazardNo', title: '危险编号' },
    { key: 'pointNo', title: '风险点编号' },
    { key: 'organizationNames', title: '辨识单位' },
    { key: 'siteName', title: '场所' },
    { key: 'identificationLocation', title: '辨识位置' },
    { key: 'equipmentFacility', title: '设备设施' },
    { key: 'activityNames', title: '作业活动' },
    { key: 'hazardFactor', title: '危险有害因素' },
    { key: 'accidentTypesText', title: '事故类型' },
    { key: 'assessmentText', title: '评分明细' },
    { key: 'riskLevelName', title: '风险等级' },
    { key: 'measureCount', title: '措施数量' },
    { key: 'linkedPositionCount', title: '责任岗位数量' },
    { key: 'generatedHazardCount', title: '创建隐患数量' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'export',
      label: '导出清单',
      permission: 'SmisDualControlRiskControlInformationChecklist:Export',
      exportFilename: '风险管控信息清单',
      exportSheetName: '风险管控信息清单',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: (
          await loadAllDocumentPages(fetchRiskControlInformationList, { ...searchQuery.value })
        ).map((row) => ({
          ...row,
          accidentTypesText: accidentText(row.accidentTypes),
          assessmentText: assessmentText(row)
        }))
      })
    }
  ])
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchRiskControlInformationList({ ...params, from, to })
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    return response
  }
  onMounted(async () => {
    const [, siteResponse] = await Promise.all([loadOptions(), fetchSiteList()])
    sites.value = siteResponse.data ?? []
  })
</script>

<style scoped lang="scss">
  .risk-information-page {
    min-width: 0;
    overflow: hidden;

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.risk-information-page__link) {
      display: grid;
      gap: 2px;
      width: 100%;
      padding: 0;
      color: var(--theme-color);
      text-align: left;
      background: transparent;
      border: 0;
    }

    :deep(.risk-information-page__link strong),
    :deep(.risk-information-page__link small),
    :deep(.risk-information-page__stack strong),
    :deep(.risk-information-page__stack small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.risk-information-page__link small),
    :deep(.risk-information-page__stack small),
    :deep(.risk-information-page__assessment small) {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.risk-information-page__stack) {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    :deep(.risk-information-page__assessment) {
      display: grid;
      grid-template-columns: 4px minmax(0, 1fr);
      gap: 9px;
      align-items: stretch;
    }

    :deep(.risk-information-page__assessment > span) {
      background: var(--risk-color);
      border-radius: 999px;
    }

    :deep(.risk-information-page__assessment div) {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    :deep(.risk-information-page__coverage) {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    :deep(.risk-information-page__link:focus-visible) {
      outline: 2px solid color-mix(in srgb, var(--theme-color) 65%, transparent);
      outline-offset: 2px;
    }

    :deep(.art-button-table) {
      margin-right: 0;
    }
  }
</style>
