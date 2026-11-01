<template>
  <ArtPermissionGuard
    permission="SmisDualControlPositionSafetyResponsibilityChecklist:View"
    resource-name="岗位安全责任制清单"
  >
    <div class="position-responsibility-checklist business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="POSITION SAFETY DUTY"
        title="岗位安全责任制清单"
        description="按组织和岗位归并风险管控、隐患排查与整改闭环职责，明确每个岗位的责任边界。"
        icon="ri:user-settings-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="position-responsibility-checklist__table"
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
          emptyText: '暂无岗位安全责任',
          emptyDescription: '请先维护岗位风险管控措施或岗位隐患排查标准。'
        }"
        focusable
      />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { computed, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElTag } from 'element-plus'
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
    fetchPositionResponsibilityChecklist,
    type SmisChecklistSearchParams,
    type SmisPositionResponsibilityChecklistOverview,
    type SmisPositionResponsibilityChecklistRecord
  } from '@smis/api'
  import { useChecklistOptions } from '../shared/use-checklist-options'

  defineOptions({ name: 'SmisDualControlPositionSafetyResponsibilityChecklist' })
  type SearchModel = { keyword?: string; organizationId?: string }
  type TableParams = SearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  const route = useRoute()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const searchQuery = ref<SearchModel>({
    keyword: String(route.query.keyword || ''),
    organizationId: String(route.query.organizationId || '')
  })
  const overview = ref<SmisPositionResponsibilityChecklistOverview>({
    total: 0,
    organizations: 0,
    riskMeasures: 0,
    inspectionStandards: 0
  })
  const { organizationTree, organizationTreeProps, loadOptions } = useChecklistOptions()
  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '岗位责任边界', type: 'primary', effect: 'plain' },
    { label: '风险与排查合并', type: 'success', effect: 'light' },
    { label: '动态业务口径', type: 'info', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '责任岗位',
      value: overview.value.total,
      description: '当前筛选范围',
      icon: 'ri:briefcase-4-line'
    },
    {
      label: '覆盖组织',
      value: overview.value.organizations,
      description: '已明确责任组织',
      icon: 'ri:organization-chart',
      tone: 'info'
    },
    {
      label: '风险措施',
      value: overview.value.riskMeasures,
      description: '纳入岗位责任',
      icon: 'ri:shield-check-line',
      tone: 'warning'
    },
    {
      label: '排查标准',
      value: overview.value.inspectionStandards,
      description: '需周期执行',
      icon: 'ri:list-check-3',
      tone: 'success'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '岗位关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '岗位、组织或责任范围' }
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
    }
  ])
  const columnsFactory = (): ColumnOption<SmisPositionResponsibilityChecklistRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'positionName',
      label: '岗位全称',
      minWidth: 250,
      formatter: (row) => (
        <div class="position-responsibility-checklist__identity">
          <span aria-hidden="true">{row.positionName.slice(0, 1)}</span>
          <div>
            <strong>{row.positionName}</strong>
            <small>
              {row.organizationName} · {row.positionCode}
            </small>
          </div>
        </div>
      )
    },
    { prop: 'responsibilityScope', label: '责任范围', minWidth: 320 },
    { prop: 'workContent', label: '工作内容', minWidth: 500 },
    {
      prop: 'coverage',
      label: '责任覆盖',
      width: 210,
      formatter: (row) => (
        <div class="position-responsibility-checklist__coverage">
          <ElTag effect="plain">风险 {row.riskCount}</ElTag>
          <ElTag type="success" effect="plain">
            排查 {row.inspectionCount}
          </ElTag>
        </div>
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'organizationName', title: '所属组织' },
    { key: 'positionCode', title: '岗位编码' },
    { key: 'positionName', title: '岗位名称' },
    { key: 'responsibilityScope', title: '责任范围' },
    { key: 'workContent', title: '工作内容' },
    { key: 'riskCount', title: '风险措施数' },
    { key: 'inspectionCount', title: '排查标准数' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'export',
      label: '导出清单',
      permission: 'SmisDualControlPositionSafetyResponsibilityChecklist:Export',
      exportFilename: '岗位安全责任制清单',
      exportSheetName: '岗位安全责任制清单',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: await loadAllDocumentPages<
          SmisPositionResponsibilityChecklistRecord,
          SmisChecklistSearchParams
        >(fetchPositionResponsibilityChecklist, { ...searchQuery.value })
      })
    }
  ])
  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchPositionResponsibilityChecklist({ ...params, from, to })
    overview.value = response.overview
    return response
  }
  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .position-responsibility-checklist {
    min-width: 0;

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.position-responsibility-checklist__identity) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;
    }

    :deep(.position-responsibility-checklist__identity > span) {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      font-weight: 700;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    :deep(.position-responsibility-checklist__identity > div) {
      display: grid;
      min-width: 0;
    }

    :deep(.position-responsibility-checklist__identity strong),
    :deep(.position-responsibility-checklist__identity small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.position-responsibility-checklist__identity small) {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.position-responsibility-checklist__coverage) {
      display: flex;
      gap: 6px;
      align-items: center;
    }
  }
</style>
