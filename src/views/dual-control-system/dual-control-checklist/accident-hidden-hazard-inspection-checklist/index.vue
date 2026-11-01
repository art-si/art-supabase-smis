<template>
  <ArtPermissionGuard
    permission="SmisDualControlAccidentHiddenHazardInspectionChecklist:View"
    resource-name="事故隐患排查清单"
  >
    <div class="accident-inspection-checklist business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="HAZARD INSPECTION STANDARD"
        title="事故隐患排查清单"
        description="汇总岗位排查项目、执行标准、隐患分类与排查周期，形成现场可执行的检查依据。"
        icon="ri:file-search-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="accident-inspection-checklist__table"
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
          emptyText: '暂无隐患排查标准',
          emptyDescription: '请先在岗位安全责任制中维护排查项目和标准。'
        }"
        focusable
      />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
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
    fetchAccidentInspectionChecklist,
    type SmisChecklistSearchParams,
    type SmisAccidentInspectionChecklistOverview,
    type SmisAccidentInspectionChecklistRecord
  } from '@smis/api'
  import { formatChecklistFrequency, useChecklistOptions } from '../shared/use-checklist-options'

  defineOptions({ name: 'SmisDualControlAccidentHiddenHazardInspectionChecklist' })
  type SearchModel = { keyword?: string; organizationId?: string; hazardLevel?: string }
  type TableParams = SearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  const route = useRoute()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const searchQuery = ref<SearchModel>({
    keyword: String(route.query.keyword || ''),
    organizationId: String(route.query.organizationId || '')
  })
  const overview = ref<SmisAccidentInspectionChecklistOverview>({
    total: 0,
    positions: 0,
    organizations: 0,
    major: 0
  })
  const {
    organizationTree,
    organizationTreeProps,
    dictionaryOptions,
    getDictDisplayLabelByValue,
    loadOptions
  } = useChecklistOptions([
    'smisPrimaryHazardCategory',
    'smisSecondaryHazardCategory',
    'smisHazardLevel',
    'smisRiskLevel'
  ])
  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '岗位标准来源', type: 'primary', effect: 'plain' },
    { label: '隐患分类统一', type: 'success', effect: 'light' },
    { label: '周期执行口径', type: 'info', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '排查标准',
      value: overview.value.total,
      description: '当前筛选范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '覆盖岗位',
      value: overview.value.positions,
      description: '承担排查职责',
      icon: 'ri:briefcase-4-line',
      tone: 'info'
    },
    {
      label: '覆盖组织',
      value: overview.value.organizations,
      description: '已配置组织',
      icon: 'ri:organization-chart',
      tone: 'success'
    },
    {
      label: '重大隐患项',
      value: overview.value.major,
      description: '需重点关注',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键内容',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '岗位、排查项目或标准' }
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
      label: '隐患级别',
      key: 'hazardLevel',
      type: 'select',
      props: {
        options: dictionaryOptions('smisHazardLevel'),
        clearable: true,
        placeholder: '全部级别'
      }
    }
  ])
  const columnsFactory = (): ColumnOption<SmisAccidentInspectionChecklistRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'positionName',
      label: '岗位全称',
      minWidth: 220,
      formatter: (row) => (
        <div class="accident-inspection-checklist__stack">
          <strong>{row.positionName}</strong>
          <small>
            {row.organizationName} · {row.positionCode}
          </small>
        </div>
      )
    },
    { prop: 'inspectionItem', label: '排查项目', minWidth: 220 },
    { prop: 'inspectionStandard', label: '排查标准', minWidth: 320 },
    {
      prop: 'primaryHazardCategory',
      label: '隐患类别',
      width: 128,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisPrimaryHazardCategory"
          value={row.primaryHazardCategory}
          display="tag"
        />
      )
    },
    {
      prop: 'secondaryHazardCategory',
      label: '隐患子类别',
      minWidth: 160,
      formatter: (row) =>
        getDictDisplayLabelByValue(
          'smisSecondaryHazardCategory',
          row.secondaryHazardCategory,
          row.secondaryHazardCategory || '—'
        )
    },
    {
      prop: 'hazardLevel',
      label: '隐患级别',
      width: 116,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisHazardLevel" value={row.hazardLevel} display="tag" />
      )
    },
    {
      prop: 'inspectionFrequency',
      label: '周期',
      width: 100,
      formatter: (row) => formatChecklistFrequency(row.inspectionFrequency, row.frequencyUnit)
    },
    { prop: 'standardSource', label: '排查标准来源', width: 150 }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'organizationName', title: '所属组织' },
    { key: 'positionName', title: '岗位名称' },
    { key: 'inspectionItem', title: '排查项目' },
    { key: 'inspectionStandard', title: '排查标准' },
    { key: 'primaryHazardCategory', title: '隐患类别' },
    { key: 'secondaryHazardCategory', title: '隐患子类别' },
    { key: 'hazardLevel', title: '隐患级别' },
    { key: 'inspectionFrequency', title: '周期' },
    { key: 'standardSource', title: '排查标准来源' }
  ]
  const exportRows = (rows: SmisAccidentInspectionChecklistRecord[]) =>
    rows.map((row) => ({
      ...row,
      primaryHazardCategory: getDictDisplayLabelByValue(
        'smisPrimaryHazardCategory',
        row.primaryHazardCategory,
        row.primaryHazardCategory || '—'
      ),
      secondaryHazardCategory: getDictDisplayLabelByValue(
        'smisSecondaryHazardCategory',
        row.secondaryHazardCategory,
        row.secondaryHazardCategory || '—'
      ),
      hazardLevel: getDictDisplayLabelByValue(
        'smisHazardLevel',
        row.hazardLevel,
        row.hazardLevel || '—'
      ),
      inspectionFrequency: formatChecklistFrequency(row.inspectionFrequency, row.frequencyUnit)
    }))
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'export',
      label: '导出清单',
      permission: 'SmisDualControlAccidentHiddenHazardInspectionChecklist:Export',
      exportFilename: '事故隐患排查清单',
      exportSheetName: '事故隐患排查清单',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: exportRows(
          await loadAllDocumentPages<
            SmisAccidentInspectionChecklistRecord,
            SmisChecklistSearchParams
          >(fetchAccidentInspectionChecklist, { ...searchQuery.value })
        )
      })
    }
  ])
  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchAccidentInspectionChecklist({ ...params, from, to })
    overview.value = response.overview
    return response
  }
  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .accident-inspection-checklist {
    min-width: 0;

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.accident-inspection-checklist__stack) {
      display: grid;
      min-width: 0;
    }

    :deep(.accident-inspection-checklist__stack strong),
    :deep(.accident-inspection-checklist__stack small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.accident-inspection-checklist__stack small) {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
