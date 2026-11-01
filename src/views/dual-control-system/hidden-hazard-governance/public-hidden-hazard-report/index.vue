<template>
  <ArtPermissionGuard
    permission="SmisDualControlPublicHiddenHazardReport:View"
    resource-name="公众举报隐患"
  >
    <div class="public-report-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="PUBLIC HAZARD REPORT"
        title="公众举报隐患"
        description="统一登记公众隐患线索，保存后自动生成隐患编号并进入核准、整改与验收闭环。"
        icon="ri:megaphone-line"
        density="compact"
        :tags="[
          { label: '举报线索归档', type: 'primary', effect: 'plain' },
          { label: '实名操作留痕', type: 'info', effect: 'plain' },
          { label: '闭环联动', type: 'success', effect: 'light' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="public-report-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 84, showExpand: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无公众举报隐患',
          emptyDescription: '点击“登记举报”录入第一条公众隐患线索。'
        }"
        focusable
      />
      <PublicReportDialog ref="dialogRef" @success="handleCreated" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import { toDictionaryOption } from '@/utils/form/option'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useUserStore } from '@/store/modules/user'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchHazardReportingOptions,
    fetchPublicHazardReportList,
    type SmisHazardReportingOrganization,
    type SmisHazardReportingSite,
    type SmisPublicHazardReportRecord,
    type SmisPublicHazardReportSearchParams
  } from '@smis/api'
  import PublicReportDialog, {
    type PublicReportDialogOpenData
  } from './modules/public-report-dialog.vue'

  defineOptions({ name: 'SmisDualControlPublicHiddenHazardReport' })
  interface SearchModel extends SmisPublicHazardReportSearchParams {
    reportedRange?: [string, string]
  }
  type TableParams = SearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: PublicReportDialogOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<SearchModel>({})
  const options = reactive<{
    organizations: SmisHazardReportingOrganization[]
    sites: SmisHazardReportingSite[]
  }>({ organizations: [], sites: [] })
  const overview = reactive({ total: 0, pending: 0, processing: 0, closed: 0 })
  const statusOptions = computed(() =>
    (getDictMap.value.smisHiddenHazardGovernanceStatus ?? []).map(toDictionaryOption)
  )
  const levelLabels = computed<Record<string, string>>(() =>
    Object.fromEntries(
      (getDictMap.value.smisHazardLevel ?? []).map((item) => [item.value, item.label || item.name])
    )
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '举报总数',
      value: overview.total,
      description: '当前查询口径',
      icon: 'ri:megaphone-line'
    },
    {
      label: '待核准',
      value: overview.pending,
      description: '等待核实处置',
      icon: 'ri:file-search-line',
      tone: 'warning'
    },
    {
      label: '处理中',
      value: overview.processing,
      description: '整改或待验收',
      icon: 'ri:loader-2-line',
      tone: 'danger'
    },
    {
      label: '已闭环',
      value: overview.closed,
      description: '完成或关闭',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '举报线索',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '编号、举报人或隐患描述' }
    },
    {
      label: '举报时间',
      key: 'reportedRange',
      type: 'daterange',
      props: {
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期'
      }
    },
    {
      label: '处理状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
    }
  ])
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const columnsFactory = (): ColumnOption<SmisPublicHazardReportRecord>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    { prop: 'hazardNo', label: '隐患编号', width: 154, fixed: 'left' },
    {
      prop: 'status',
      label: '处理状态',
      width: 108,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisHiddenHazardGovernanceStatus"
          value={row.status}
          display="tag"
        />
      )
    },
    { prop: 'reporterName', label: '举报人', width: 112 },
    {
      prop: 'reporterPhone',
      label: '联系电话',
      width: 136,
      formatter: (row) => row.reporterPhone || '—'
    },
    {
      prop: 'reporterUnit',
      label: '单位名称',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.reporterUnit || '—'
    },
    {
      prop: 'hazardLevel',
      label: '隐患级别',
      width: 112,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisHazardLevel" value={row.hazardLevel} display="tag" />
      )
    },
    {
      prop: 'hazardOrganizationName',
      label: '隐患所属部门',
      minWidth: 170,
      showOverflowTooltip: true
    },
    { prop: 'siteName', label: '场所', minWidth: 140, showOverflowTooltip: true },
    { prop: 'location', label: '隐患位置', minWidth: 160, showOverflowTooltip: true },
    { prop: 'description', label: '隐患描述', minWidth: 240, showOverflowTooltip: true },
    {
      prop: 'reportedAt',
      label: '举报时间',
      width: 164,
      formatter: (row) => formatDate(row.reportedAt)
    },
    { prop: 'handlerName', label: '登记操作人', width: 132 }
  ]
  const exportColumns = [
    { key: 'hazardNo', title: '隐患编号' },
    { key: 'status', title: '处理状态' },
    { key: 'reporterName', title: '举报人' },
    { key: 'reporterPhone', title: '联系电话' },
    { key: 'reporterUnit', title: '单位名称' },
    { key: 'hazardLevel', title: '隐患级别' },
    { key: 'hazardOrganizationName', title: '隐患所属部门' },
    { key: 'siteName', title: '场所' },
    { key: 'location', title: '隐患位置' },
    { key: 'description', title: '隐患描述' },
    { key: 'reportedAt', title: '举报时间' },
    { key: 'handlerName', title: '登记操作人' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      key: 'register',
      type: 'add',
      label: '登记举报',
      permission: 'SmisDualControlPublicHiddenHazardReport:Register',
      onClick: () => void dialogRef.value?.handleOpen({ ...options })
    },
    {
      type: 'export',
      label: '导出',
      permission: 'SmisDualControlPublicHiddenHazardReport:Export',
      exportFilename: '公众举报隐患',
      exportSheetName: '公众举报隐患',
      exportColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const query = searchParams as SearchModel
        const selected = new Set(selectedIds.map(String))
        const exportQuery: SmisPublicHazardReportSearchParams = {
          ...query,
          ids: undefined,
          reportedFrom: query.reportedRange?.[0],
          reportedTo: query.reportedRange?.[1] ? `${query.reportedRange[1]}T23:59:59` : undefined
        }
        const rows = await loadAllDocumentPages(fetchPublicHazardReportList, exportQuery)
        await Promise.all([
          userStore.ensureDictLoaded('smisHiddenHazardGovernanceStatus'),
          userStore.ensureDictLoaded('smisHazardLevel')
        ])
        return {
          data: rows
            .filter((row) => !selected.size || selected.has(row.id))
            .map((row) => ({
              ...row,
              status:
                statusOptions.value.find((item) => item.value === row.status)?.label || row.status,
              hazardLevel: levelLabels.value[row.hazardLevel] || row.hazardLevel,
              reportedAt: formatDate(row.reportedAt)
            }))
        }
      }
    }
  ])
  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchPublicHazardReportList({
      ...params,
      reportedFrom: params.reportedRange?.[0],
      reportedTo: params.reportedRange?.[1] ? `${params.reportedRange[1]}T23:59:59` : undefined,
      from,
      to
    })
    Object.assign(overview, {
      total: result.total,
      pending: result.pendingCount,
      processing: result.processingCount,
      closed: result.closedCount
    })
    return result
  }
  const handleCreated = () => void tableRef.value?.refreshCreate()
  const loadOptions = async () => {
    await Promise.all([
      userStore.ensureDictLoaded('smisHiddenHazardGovernanceStatus'),
      userStore.ensureDictLoaded('smisHazardLevel')
    ])
    const result = await fetchHazardReportingOptions()
    options.organizations = result.organizations
    options.sites = result.sites
  }
  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .public-report-page {
    min-width: 0;
    overflow: hidden;
  }

  .public-report-page__table {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }
</style>
