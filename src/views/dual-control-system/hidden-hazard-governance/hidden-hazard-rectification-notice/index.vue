<template>
  <ArtPermissionGuard
    permission="SmisDualControlHiddenHazardRectificationNotice:View"
    resource-name="隐患整改通知书"
  >
    <div class="rectification-notice-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="RECTIFICATION NOTICE"
        title="隐患整改通知书"
        description="汇总已核准进入整改的隐患，按标准模板生成可直接签发和归档的整改通知书。"
        icon="ri:file-warning-line"
        density="compact"
        :tags="[
          { label: '自动套用模板', type: 'primary', effect: 'plain' },
          { label: '来源可追溯', type: 'info', effect: 'plain' },
          { label: '整改时限明确', type: 'warning', effect: 'light' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="rectification-notice-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 92, showExpand: true, defaultExpanded: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无整改通知书',
          emptyDescription: '隐患核准并进入整改后，将自动出现在此处。'
        }"
        focusable
      />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import { ElMessage } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchHazardReportingOptions,
    fetchRectificationNoticeList,
    type SmisHazardReportingOrganization,
    type SmisRectificationNoticeRecord,
    type SmisRectificationNoticeSearchParams
  } from '@smis/api'
  import { toDualControlOrganizationTree } from '@smis/views/dual-control-system/shared/organization-tree'
  import { printHtmlDocument } from '@/utils/file/print-document'
  import { buildHiddenHazardRectificationNoticeHtml } from './modules/rectification-notice-document'

  defineOptions({ name: 'SmisDualControlHiddenHazardRectificationNotice' })
  interface SearchModel extends SmisRectificationNoticeSearchParams {
    inspectionRange?: [string, string]
  }
  type TableParams = SearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  const tableRef = ref<ArtTableQueryExpose>()
  const searchQuery = ref<SearchModel>({})
  const organizations = ref<SmisHazardReportingOrganization[]>([])
  const overview = reactive({ total: 0, rectifying: 0, pendingAcceptance: 0, completed: 0 })
  const organizationTreeData = computed(() => toDualControlOrganizationTree(organizations.value))
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '通知书',
      value: overview.total,
      description: '当前查询口径',
      icon: 'ri:file-warning-line'
    },
    {
      label: '整改中',
      value: overview.rectifying,
      description: '等待反馈结果',
      icon: 'ri:tools-line',
      tone: 'danger'
    },
    {
      label: '待验收',
      value: overview.pendingAcceptance,
      description: '已提交整改',
      icon: 'ri:file-search-line',
      tone: 'warning'
    },
    {
      label: '已完成',
      value: overview.completed,
      description: '验收闭环',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '检查时间',
      key: 'inspectionRange',
      type: 'daterange',
      props: {
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期'
      }
    },
    {
      label: '检查单位',
      key: 'inspectionOrganizationId',
      type: 'treeSelect',
      props: {
        data: organizationTreeData.value,
        props: { label: 'organizationName', value: 'id', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        defaultExpandAll: true,
        filterable: true,
        clearable: true,
        placeholder: '全部检查单位'
      }
    },
    {
      label: '检查人',
      key: 'inspectorKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '输入检查人姓名' }
    },
    {
      label: '被检查单位',
      key: 'inspectedOrganizationId',
      type: 'treeSelect',
      props: {
        data: organizationTreeData.value,
        props: { label: 'organizationName', value: 'id', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        defaultExpandAll: true,
        filterable: true,
        clearable: true,
        placeholder: '全部被检查单位'
      }
    }
  ])
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const printNotice = (row: SmisRectificationNoticeRecord): void => {
    printHtmlDocument(buildHiddenHazardRectificationNoticeHtml(row), 'width=980,height=820')
  }
  const columnsFactory = (): ColumnOption<SmisRectificationNoticeRecord>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    { prop: 'noticeNo', label: '通知单号', width: 156, fixed: 'left' },
    { prop: 'rectificationPlanNo', label: '整改计划号', width: 160 },
    {
      prop: 'inspectionTime',
      label: '检查时间',
      width: 164,
      formatter: (row) => formatDate(row.inspectionTime)
    },
    {
      prop: 'inspectionOrganizationName',
      label: '检查单位',
      minWidth: 170,
      showOverflowTooltip: true
    },
    { prop: 'inspectorNames', label: '检查人员', width: 132, showOverflowTooltip: true },
    {
      prop: 'inspectedOrganizationName',
      label: '被检查单位',
      minWidth: 180,
      showOverflowTooltip: true
    },
    { prop: 'hazardDescription', label: '隐患描述', minWidth: 240, showOverflowTooltip: true },
    {
      prop: 'rectificationRequirement',
      label: '整改要求',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.rectificationRequirement || '请按要求落实整改并反馈证据'
    },
    {
      prop: 'rectificationDeadline',
      label: '整改时限',
      width: 164,
      formatter: (row) => formatDate(row.rectificationDeadline)
    },
    {
      prop: 'status',
      label: '状态',
      width: 108,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisHiddenHazardGovernanceStatus"
          value={row.status}
          display="tag"
        />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 82,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonTable
          type="view"
          icon="ri:printer-line"
          label="打印通知书"
          permission="SmisDualControlHiddenHazardRectificationNotice:Print"
          onClick={() => printNotice(row)}
        />
      )
    }
  ]
  const exportColumns = [
    { key: 'noticeNo', title: '通知单号' },
    { key: 'rectificationPlanNo', title: '整改计划号' },
    { key: 'inspectionTime', title: '检查时间' },
    { key: 'inspectionOrganizationName', title: '检查单位' },
    { key: 'inspectorNames', title: '检查人员' },
    { key: 'inspectedOrganizationName', title: '被检查单位' },
    { key: 'hazardDescription', title: '隐患描述' },
    { key: 'rectificationRequirement', title: '整改要求' },
    { key: 'rectificationDeadline', title: '整改时限' }
  ]
  const requireSingle = (context: ArtTableQueryHeaderActionContext) => {
    if (context.selectedRows.length !== 1) {
      ElMessage.warning('请选择一条整改通知书')
      return null
    }
    return context.selectedRows[0] as SmisRectificationNoticeRecord
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      key: 'print',
      label: '打印通知书',
      icon: 'ri:printer-line',
      permission: 'SmisDualControlHiddenHazardRectificationNotice:Print',
      selectionRequired: true,
      onClick: (context) => {
        const row = requireSingle(context)
        if (row) printNotice(row)
      }
    },
    {
      type: 'export',
      label: '导出',
      permission: 'SmisDualControlHiddenHazardRectificationNotice:Export',
      exportFilename: '隐患整改通知书',
      exportSheetName: '整改通知书',
      exportColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const query = searchParams as SearchModel
        const selected = new Set(selectedIds.map(String))
        const exportQuery: SmisRectificationNoticeSearchParams = {
          ...query,
          ids: undefined,
          inspectionFrom: query.inspectionRange?.[0],
          inspectionTo: query.inspectionRange?.[1]
            ? `${query.inspectionRange[1]}T23:59:59`
            : undefined
        }
        const rows = await loadAllDocumentPages(fetchRectificationNoticeList, exportQuery)
        return {
          data: rows
            .filter((row) => !selected.size || selected.has(row.id))
            .map((row) => ({
              ...row,
              inspectionTime: formatDate(row.inspectionTime),
              rectificationDeadline: formatDate(row.rectificationDeadline)
            }))
        }
      }
    }
  ])
  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchRectificationNoticeList({
      ...params,
      inspectionFrom: params.inspectionRange?.[0],
      inspectionTo: params.inspectionRange?.[1]
        ? `${params.inspectionRange[1]}T23:59:59`
        : undefined,
      from,
      to
    })
    Object.assign(overview, {
      total: result.total,
      rectifying: result.rectifyingCount,
      pendingAcceptance: result.pendingAcceptanceCount,
      completed: result.completedCount
    })
    return result
  }
  onMounted(async () => {
    const result = await fetchHazardReportingOptions()
    organizations.value = result.organizations
  })
</script>

<style scoped lang="scss">
  .rectification-notice-page {
    min-width: 0;
    overflow: hidden;
  }

  .rectification-notice-page__table {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }
</style>
