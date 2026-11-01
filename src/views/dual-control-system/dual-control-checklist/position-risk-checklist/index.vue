<template>
  <ArtPermissionGuard
    permission="SmisDualControlPositionRiskChecklist:View"
    resource-name="岗位风险清单"
  >
    <div class="position-risk-checklist business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="POSITION RISK REGISTER"
        title="岗位风险清单"
        description="将风险辨识、评价结果、管控措施、排查周期与辨识单位归并到岗位维度。"
        icon="ri:shield-flash-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="position-risk-checklist__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 88, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          showOverflowTooltip: true,
          emptyText: '暂无岗位风险',
          emptyDescription: '请先在风险辨识及风险评价业务中维护岗位关联的管控措施。'
        }"
        focusable
      />
      <IdentificationUnitDialog ref="unitDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
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
    fetchPositionRiskChecklist,
    type SmisChecklistSearchParams,
    type SmisPositionRiskChecklistOverview,
    type SmisPositionRiskChecklistRecord
  } from '@smis/api'
  import { formatChecklistFrequency, useChecklistOptions } from '../shared/use-checklist-options'
  import IdentificationUnitDialog from './modules/identification-unit-dialog.vue'

  defineOptions({ name: 'SmisDualControlPositionRiskChecklist' })
  type SearchModel = { keyword?: string; organizationId?: string; riskLevel?: string }
  type TableParams = SearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface UnitDialogExpose {
    handleOpen: (data: SmisPositionRiskChecklistRecord) => Promise<void>
  }

  const route = useRoute()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const unitDialogRef = ref<UnitDialogExpose>()
  const searchQuery = ref<SearchModel>({
    keyword: String(route.query.keyword || ''),
    organizationId: String(route.query.organizationId || '')
  })
  const overview = ref<SmisPositionRiskChecklistOverview>({
    total: 0,
    major: 0,
    identifiedUnits: 0,
    positions: 0
  })
  const {
    organizationTree,
    organizationTreeProps,
    dictionaryOptions,
    getDictDisplayLabelByValue,
    loadOptions
  } = useChecklistOptions([
    'smisRiskLevel',
    'smisAccidentCategory',
    'smisControlMeasureCategory',
    'smisControlLevel',
    'smisHazardLevel'
  ])
  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '风险辨识来源', type: 'primary', effect: 'plain' },
    { label: '评价结果联动', type: 'warning', effect: 'light' },
    { label: '辨识单位可追溯', type: 'success', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '风险措施',
      value: overview.value.total,
      description: '当前筛选范围',
      icon: 'ri:shield-line'
    },
    {
      label: '覆盖岗位',
      value: overview.value.positions,
      description: '已关联岗位',
      icon: 'ri:briefcase-4-line',
      tone: 'info'
    },
    {
      label: '辨识单位',
      value: overview.value.identifiedUnits,
      description: '参与风险辨识组织',
      icon: 'ri:organization-chart',
      tone: 'success'
    },
    {
      label: '重大风险',
      value: overview.value.major,
      description: '需重点管控',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键内容',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '岗位、部位、危害或措施' }
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
      label: '风险等级',
      key: 'riskLevel',
      type: 'select',
      props: {
        options: dictionaryOptions('smisRiskLevel'),
        clearable: true,
        placeholder: '全部等级'
      }
    }
  ])
  const riskScoreDetail = (row: SmisPositionRiskChecklistRecord): string => {
    if (!row.methodCode) return '待评价'
    if (row.methodCode === 'LEC')
      return `LEC：L=${row.lValue ?? '—'}，E=${row.eValue ?? '—'}，C=${row.cValue ?? '—'}，D=${row.riskScore ?? '—'}`
    return `${row.methodCode}：S=${row.sValue ?? '—'}，R=${row.riskScore ?? '—'}`
  }
  const columnsFactory = (): ColumnOption<SmisPositionRiskChecklistRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'positionName',
      label: '岗位全称',
      minWidth: 220,
      link: {
        permission: 'SmisDualControlPositionRiskChecklist:ViewIdentificationUnit',
        onClick: (row) => unitDialogRef.value?.handleOpen(row)
      },
      formatter: (row) => (
        <div class="position-risk-checklist__stack">
          <strong>{row.positionName}</strong>
          <small>
            {row.organizationName} · {row.positionCode}
          </small>
        </div>
      )
    },
    { prop: 'identificationLocation', label: '辨识部位', minWidth: 180 },
    { prop: 'equipmentFacility', label: '设备设施', minWidth: 150 },
    { prop: 'activityNames', label: '作业 / 活动', minWidth: 180 },
    { prop: 'hazardFactor', label: '危险有害因素', minWidth: 210 },
    {
      prop: 'accidentTypes',
      label: '事故类型',
      minWidth: 160,
      formatter: (row) =>
        row.accidentTypes
          ?.map((item) => getDictDisplayLabelByValue('smisAccidentCategory', item, item || '—'))
          .join('、') || '—'
    },
    {
      prop: 'riskScore',
      label: '打分明细',
      minWidth: 220,
      formatter: (row) => riskScoreDetail(row)
    },
    {
      prop: 'riskLevelName',
      label: '风险等级',
      width: 118,
      formatter: (row) =>
        row.riskLevelName ? (
          <span
            class="position-risk-checklist__level"
            style={{ '--risk-level-color': row.riskLevelColor || 'var(--el-color-info)' }}
          >
            {row.riskLevelName}
          </span>
        ) : (
          <span class="position-risk-checklist__muted">待评价</span>
        )
    },
    {
      prop: 'controlMeasureCategory',
      label: '措施类别',
      width: 120,
      formatter: (row) => (
        <ElTag effect="plain">
          {getDictDisplayLabelByValue(
            'smisControlMeasureCategory',
            row.controlMeasureCategory,
            row.controlMeasureCategory || '—'
          )}
        </ElTag>
      )
    },
    { prop: 'controlMeasure', label: '管控措施', minWidth: 260 },
    { prop: 'standardBasis', label: '标准依据', minWidth: 190 },
    { prop: 'failureMode', label: '失效形式', minWidth: 180 },
    {
      prop: 'frequencyCount',
      label: '排查周期',
      width: 104,
      formatter: (row) => formatChecklistFrequency(row.frequencyCount, row.frequencyUnit)
    },
    {
      prop: 'identificationUnits',
      label: '辨识单位',
      width: 92,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonTable
          type="view"
          icon="ri:building-2-line"
          label={`查看辨识单位（${row.identificationUnits.length} 个）`}
          permission="SmisDualControlPositionRiskChecklist:ViewIdentificationUnit"
          onClick={() => void unitDialogRef.value?.handleOpen(row)}
        />
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'organizationName', title: '所属组织' },
    { key: 'positionName', title: '岗位名称' },
    { key: 'identificationLocation', title: '辨识部位' },
    { key: 'equipmentFacility', title: '设备设施' },
    { key: 'activityNames', title: '作业/活动' },
    { key: 'hazardFactor', title: '危险有害因素' },
    { key: 'accidentTypes', title: '事故类型' },
    { key: 'riskScore', title: '风险分值' },
    { key: 'riskLevelName', title: '风险等级' },
    { key: 'controlMeasureCategory', title: '管控措施类别' },
    { key: 'controlMeasure', title: '管控措施' },
    { key: 'standardBasis', title: '标准依据' },
    { key: 'failureMode', title: '失效形式' },
    { key: 'frequencyCount', title: '排查周期' },
    { key: 'identificationUnits', title: '辨识单位' }
  ]
  const exportRows = (rows: SmisPositionRiskChecklistRecord[]) =>
    rows.map((row) => ({
      ...row,
      accidentTypes: row.accidentTypes
        .map((item) => getDictDisplayLabelByValue('smisAccidentCategory', item, item || '—'))
        .join('、'),
      controlMeasureCategory: getDictDisplayLabelByValue(
        'smisControlMeasureCategory',
        row.controlMeasureCategory,
        row.controlMeasureCategory || '—'
      ),
      frequencyCount: formatChecklistFrequency(row.frequencyCount, row.frequencyUnit),
      identificationUnits: row.identificationUnits.map((item) => item.organizationName).join('、')
    }))
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'export',
      label: '导出清单',
      permission: 'SmisDualControlPositionRiskChecklist:Export',
      exportFilename: '岗位风险清单',
      exportSheetName: '岗位风险清单',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: exportRows(
          await loadAllDocumentPages<SmisPositionRiskChecklistRecord, SmisChecklistSearchParams>(
            fetchPositionRiskChecklist,
            { ...searchQuery.value }
          )
        )
      })
    }
  ])
  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchPositionRiskChecklist({ ...params, from, to })
    overview.value = response.overview
    return response
  }
  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .position-risk-checklist {
    min-width: 0;

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.position-risk-checklist__stack) {
      display: grid;
      min-width: 0;
    }

    :deep(.position-risk-checklist__stack strong),
    :deep(.position-risk-checklist__stack small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.position-risk-checklist__stack small) {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.position-risk-checklist__level) {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-weight: 600;
    }

    :deep(.position-risk-checklist__level::before) {
      width: 8px;
      height: 8px;
      content: '';
      background: var(--risk-level-color);
      border-radius: 50%;
    }

    :deep(.position-risk-checklist__muted) {
      color: var(--el-text-color-placeholder);
    }

    :deep(.art-button-table) {
      margin-right: 0;
    }
  }
</style>
