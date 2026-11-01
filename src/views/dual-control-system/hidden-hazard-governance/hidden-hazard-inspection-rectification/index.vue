<template>
  <ArtPermissionGuard
    permission="SmisDualControlHiddenHazardInspectionRectification:View"
    resource-name="隐患检查落实整改"
  >
    <div class="inspection-rectification-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="INSPECTION RECTIFICATION"
        title="隐患检查落实整改"
        description="集中查看隐患整改落实记录与现场证据；整改中的隐患可继续提交，完成后仍保留追溯。"
        icon="ri:task-line"
        density="compact"
        :tags="[
          { label: '整改任务聚合', type: 'primary', effect: 'plain' },
          { label: '现场证据', type: 'info', effect: 'plain' },
          { label: '提交即待验收', type: 'success', effect: 'light' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="inspection-rectification-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 88, showExpand: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无整改落实记录',
          emptyDescription: '隐患进入整改后，可新增并持续查看整改落实记录。'
        }"
        focusable
      />
      <InspectionRectificationDialog ref="dialogRef" @success="handleCreated" />
      <InspectionRectificationDetailDialog ref="detailDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import { useUserStore } from '@/store/modules/user'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
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
    fetchRectificationNoticeList,
    type SmisRectificationNoticeRecord,
    type SmisRectificationNoticeSearchParams
  } from '@smis/api'
  import InspectionRectificationDialog, {
    type InspectionRectificationDialogOpenData
  } from './modules/inspection-rectification-dialog.vue'
  import InspectionRectificationDetailDialog from './modules/inspection-rectification-detail-dialog.vue'

  defineOptions({ name: 'SmisDualControlHiddenHazardInspectionRectification' })
  interface SearchModel extends SmisRectificationNoticeSearchParams {
    inspectionRange?: [string, string]
  }
  type TableParams = SearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: InspectionRectificationDialogOpenData) => Promise<void>
  }
  interface DetailDialogExpose {
    handleOpen: (row: SmisRectificationNoticeRecord) => Promise<void>
  }

  const tableRef = ref<ArtTableQueryExpose>()
  const userStore = useUserStore()
  const dialogRef = ref<DialogExpose>()
  const detailDialogRef = ref<DetailDialogExpose>()
  const searchQuery = ref<SearchModel>({})
  const overview = reactive({ total: 0, rectifying: 0, pendingAcceptance: 0, completed: 0 })
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    { label: '整改记录', value: overview.total, description: '当前查询范围', icon: 'ri:task-line' },
    {
      label: '整改中',
      value: overview.rectifying,
      description: '可新增整改记录',
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
  const searchItems: SearchFormItem[] = [
    {
      label: '检查人',
      key: 'inspectorKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '输入检查人姓名' }
    },
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
    }
  ]
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const openDialog = async (selectedId?: string): Promise<void> => {
    await dialogRef.value?.handleOpen({
      records: [],
      selectedId,
      loadRecords: async () =>
        (await fetchRectificationNoticeList({ rectifiableOnly: true, from: 0, to: 999 })).data ?? []
    })
  }
  const columnsFactory = (): ColumnOption<SmisRectificationNoticeRecord>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'hazardNo',
      label: '隐患编号',
      width: 154,
      fixed: 'left',
      link: { onClick: (row) => void detailDialogRef.value?.handleOpen(row) }
    },
    {
      prop: 'status',
      label: '隐患状态',
      width: 108,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisHiddenHazardGovernanceStatus"
          value={row.status}
          display="tag"
        />
      )
    },
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
    { prop: 'inspectorNames', label: '检查人员', width: 132 },
    {
      prop: 'inspectedOrganizationName',
      label: '被检查单位',
      minWidth: 180,
      showOverflowTooltip: true
    },
    { prop: 'hazardDescription', label: '检查问题', minWidth: 230, showOverflowTooltip: true },
    {
      prop: 'rectificationRequirement',
      label: '整改措施',
      minWidth: 220,
      showOverflowTooltip: true
    },
    {
      prop: 'responsibleEmployeeName',
      label: '整改负责人',
      width: 132,
      formatter: (row) => row.responsibleEmployeeName || '—'
    },
    {
      prop: 'rectificationDeadline',
      label: '整改时限',
      width: 164,
      formatter: (row) => formatDate(row.rectificationDeadline)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) => (
        <div class="inspection-rectification-page__actions">
          <ArtButtonTable
            type="view"
            label="查看整改详情"
            onClick={() => void detailDialogRef.value?.handleOpen(row)}
          />
          {row.status === 'rectifying' ? (
            <ArtButtonTable
              type="edit"
              icon="ri:tools-line"
              label="落实整改"
              permission="SmisDualControlHiddenHazardInspectionRectification:Create"
              onClick={() => void openDialog(row.id)}
            />
          ) : null}
        </div>
      )
    }
  ]
  const exportColumns = [
    { key: 'hazardNo', title: '隐患编号' },
    { key: 'status', title: '隐患状态' },
    { key: 'rectificationPlanNo', title: '整改计划号' },
    { key: 'inspectionTime', title: '检查时间' },
    { key: 'inspectionOrganizationName', title: '检查单位' },
    { key: 'inspectorNames', title: '检查人员' },
    { key: 'inspectedOrganizationName', title: '被检查单位' },
    { key: 'hazardDescription', title: '检查问题' },
    { key: 'rectificationRequirement', title: '整改措施' },
    { key: 'responsibleEmployeeName', title: '整改负责人' },
    { key: 'rectificationDeadline', title: '整改时限' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'add',
      label: '新增整改记录',
      permission: 'SmisDualControlHiddenHazardInspectionRectification:Create',
      onClick: () => void openDialog()
    },
    {
      type: 'export',
      label: '导出',
      permission: 'SmisDualControlHiddenHazardInspectionRectification:Export',
      exportFilename: '隐患检查落实整改',
      exportSheetName: '落实整改',
      exportColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const query = searchParams as SearchModel
        const selected = new Set(selectedIds.map(String))
        const exportQuery: SmisRectificationNoticeSearchParams = {
          ...query,
          rectifiableOnly: false,
          ids: undefined,
          inspectionFrom: query.inspectionRange?.[0],
          inspectionTo: query.inspectionRange?.[1]
            ? `${query.inspectionRange[1]}T23:59:59`
            : undefined
        }
        const rows = await loadAllDocumentPages(fetchRectificationNoticeList, exportQuery)
        await userStore.ensureDictLoaded('smisHiddenHazardGovernanceStatus')
        return {
          data: rows
            .filter((row) => !selected.size || selected.has(row.id))
            .map((row) => ({
              ...row,
              status: userStore.getDictLabelByValue('smisHiddenHazardGovernanceStatus', row.status),
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
      rectifiableOnly: false,
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
  const handleCreated = () => void tableRef.value?.refreshUpdate()
</script>

<style scoped lang="scss">
  .inspection-rectification-page {
    min-width: 0;
    overflow: hidden;
  }

  .inspection-rectification-page__table {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }

  :deep(.inspection-rectification-page__actions) {
    display: flex;
    gap: var(--art-space-1);
    align-items: center;
  }
</style>
