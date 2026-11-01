<template>
  <ArtPermissionGuard
    permission="SmisDualControlHiddenHazardGovernanceLedger:View"
    resource-name="隐患治理信息台账"
  >
    <div class="hazard-ledger-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="hazard-ledger-page__overview"
        eyebrow="HAZARD GOVERNANCE LEDGER"
        title="隐患治理信息台账"
        description="以隐患为主线汇总上报、核准、整改与验收证据，快速识别逾期和未闭环事项。"
        icon="ri:file-list-3-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="hazard-ledger-page__table"
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
          emptyText: '暂无隐患治理记录',
          emptyDescription: '隐患登记或排查异常产生后，会自动汇入此台账。'
        }"
        focusable
      />

      <HazardLedgerDetailDrawer ref="detailRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { ElTag } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
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
    fetchHiddenHazardLedgerList,
    type SmisHiddenHazardLedgerOverview,
    type SmisHiddenHazardLedgerRecord,
    type SmisHiddenHazardLedgerSearchParams
  } from '@smis/api'
  import { useChecklistOptions } from '../shared/use-checklist-options'
  import HazardLedgerDetailDrawer, {
    type HazardLedgerDetailOpenData
  } from './modules/hazard-ledger-detail-drawer.vue'

  defineOptions({ name: 'SmisDualControlHiddenHazardGovernanceLedger' })

  interface LedgerQuery extends SmisHiddenHazardLedgerSearchParams {
    reportedRange?: [string, string]
  }
  type TableParams = LedgerQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DetailExpose {
    handleOpen: (data: HazardLedgerDetailOpenData) => Promise<void>
  }

  const tableQueryRef = ref<ArtTableQueryExpose>()
  const detailRef = ref<DetailExpose>()
  const searchQuery = ref<TableParams>({ current: 1, size: 20 })
  const overview = reactive<SmisHiddenHazardLedgerOverview>({
    total: 0,
    open: 0,
    overdue: 0,
    completed: 0,
    major: 0
  })
  const {
    organizationTree,
    organizationTreeProps,
    dictionaryOptions,
    getDictDisplayLabelByValue,
    loadOptions
  } = useChecklistOptions([
    'smisHiddenHazardGovernanceStatus',
    'smisHiddenHazardSourceType',
    'smisHazardLevel'
  ])

  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '全过程留痕', type: 'primary', effect: 'plain' },
    { label: '逾期自动识别', type: 'danger', effect: 'light' },
    { label: '多来源汇总', type: 'success', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '隐患总数',
      value: overview.total,
      description: '当前筛选口径',
      icon: 'ri:alert-line'
    },
    {
      label: '待闭环',
      value: overview.open,
      description: '仍在治理流程中',
      icon: 'ri:loop-right-line',
      tone: 'warning'
    },
    {
      label: '逾期整改',
      value: overview.overdue,
      description: '超过整改时限',
      icon: 'ri:timer-flash-line',
      tone: 'danger'
    },
    {
      label: '已闭环',
      value: overview.completed,
      description: `重大隐患 ${overview.major} 项`,
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '隐患关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '编号、描述、位置或责任人' }
    },
    {
      label: '责任单位',
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
        ariaLabel: '责任单位',
        placeholder: '全部单位'
      }
    },
    {
      label: '上报时间',
      key: 'reportedRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期'
      }
    },
    {
      label: '治理状态',
      key: 'status',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部状态',
        options: dictionaryOptions('smisHiddenHazardGovernanceStatus')
      }
    },
    {
      label: '隐患级别',
      key: 'hazardLevel',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部级别',
        options: dictionaryOptions('smisHazardLevel')
      }
    },
    {
      label: '隐患来源',
      key: 'sourceType',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部来源',
        options: dictionaryOptions('smisHiddenHazardSourceType')
      }
    }
  ])
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const openDetail = (row: SmisHiddenHazardLedgerRecord): void => {
    void detailRef.value?.handleOpen({ row })
  }
  const columnsFactory = (): ColumnOption<SmisHiddenHazardLedgerRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68, fixed: 'left' },
    {
      prop: 'hazardNo',
      label: '隐患身份',
      width: 170,
      fixed: 'left',
      formatter: (row) => (
        <button type="button" class="hazard-ledger-page__link" onClick={() => openDetail(row)}>
          <strong>{row.hazardNo}</strong>
          <small>
            {getDictDisplayLabelByValue(
              'smisHiddenHazardSourceType',
              row.sourceType,
              row.sourceType || '—'
            )}
          </small>
        </button>
      )
    },
    {
      prop: 'status',
      label: '状态',
      width: 104,
      align: 'center',
      formatter: (row) => (
        <div class="hazard-ledger-page__status">
          <ArtDictDisplay
            dictCode="smisHiddenHazardGovernanceStatus"
            value={row.status}
            display="tag"
          />
          {row.overdue ? <small>已逾期</small> : null}
        </div>
      )
    },
    {
      prop: 'description',
      label: '隐患内容',
      minWidth: 230,
      formatter: (row) => (
        <div class="hazard-ledger-page__stack">
          <strong>{row.description}</strong>
          <small>{row.location}</small>
        </div>
      )
    },
    {
      prop: 'hazardOrganizationName',
      label: '责任单位 / 上报人',
      minWidth: 205,
      formatter: (row) => (
        <div class="hazard-ledger-page__stack">
          <strong>{row.hazardOrganizationName || '未关联责任单位'}</strong>
          <small>
            {row.reporterEmployeeName} · {formatDate(row.reportedAt)}
          </small>
        </div>
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
      prop: 'rectificationResponsibleEmployeeName',
      label: '整改闭环',
      minWidth: 210,
      formatter: (row) => (
        <div class="hazard-ledger-page__stack">
          <strong>{row.rectificationResponsibleEmployeeName || '待明确责任人'}</strong>
          <small>
            时限 {formatDate(row.rectificationDeadline)} · 完成{' '}
            {formatDate(row.rectificationCompletedAt)}
          </small>
        </div>
      )
    },
    {
      prop: 'evidenceCount',
      label: '证据',
      width: 92,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.evidenceCount ? 'success' : 'info'} effect="plain">
          {row.evidenceCount} 份
        </ElTag>
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
          label="查看隐患治理详情"
          permission="SmisDualControlHiddenHazardGovernanceLedger:ViewDetail"
          onClick={() => openDetail(row)}
        />
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'hazardNo', title: '隐患编号' },
    { key: 'statusText', title: '治理状态' },
    { key: 'sourceText', title: '隐患来源' },
    { key: 'description', title: '隐患描述' },
    { key: 'hazardOrganizationName', title: '责任单位' },
    { key: 'location', title: '隐患位置' },
    { key: 'hazardLevelText', title: '隐患级别' },
    { key: 'reporterEmployeeName', title: '上报人' },
    { key: 'reportedAtText', title: '上报时间' },
    { key: 'rectificationSuggestion', title: '整改要求' },
    { key: 'rectificationMeasures', title: '整改措施' },
    { key: 'rectificationResponsibleEmployeeName', title: '整改责任人' },
    { key: 'rectificationDeadlineText', title: '整改时限' },
    { key: 'rectificationCompletedAtText', title: '实际整改时间' },
    { key: 'acceptorEmployeeName', title: '验收人' },
    { key: 'acceptedAtText', title: '验收时间' },
    { key: 'acceptanceDescription', title: '验收说明' },
    { key: 'evidenceCount', title: '证据数量' }
  ]
  const mapExportRow = (row: SmisHiddenHazardLedgerRecord) => ({
    ...row,
    statusText: getDictDisplayLabelByValue(
      'smisHiddenHazardGovernanceStatus',
      row.status,
      row.status || '—'
    ),
    sourceText: getDictDisplayLabelByValue(
      'smisHiddenHazardSourceType',
      row.sourceType,
      row.sourceType || '—'
    ),
    hazardLevelText: getDictDisplayLabelByValue(
      'smisHazardLevel',
      row.hazardLevel,
      row.hazardLevel || '—'
    ),
    reportedAtText: formatDate(row.reportedAt),
    rectificationDeadlineText: formatDate(row.rectificationDeadline),
    rectificationCompletedAtText: formatDate(row.rectificationCompletedAt),
    acceptedAtText: formatDate(row.acceptedAt)
  })
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'export',
      label: '导出台账',
      permission: 'SmisDualControlHiddenHazardGovernanceLedger:Export',
      exportFilename: '隐患治理信息台账',
      exportSheetName: '隐患治理信息台账',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: (
          await loadAllDocumentPages(fetchHiddenHazardLedgerList, normalizeQuery(searchQuery.value))
        ).map(mapExportRow)
      })
    }
  ])
  const normalizeQuery = (
    params: TableParams,
    range: Pick<SmisHiddenHazardLedgerSearchParams, 'from' | 'to'> = {}
  ): SmisHiddenHazardLedgerSearchParams => ({
    ...params,
    reportedFrom: params.reportedRange?.[0],
    reportedTo: params.reportedRange?.[1] ? `${params.reportedRange[1]}T23:59:59` : undefined,
    ...range
  })
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchHiddenHazardLedgerList(normalizeQuery(params, { from, to }))
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    return response
  }
  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .hazard-ledger-page {
    min-width: 0;
    overflow: hidden;

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.hazard-ledger-page__link) {
      display: grid;
      gap: 2px;
      width: 100%;
      padding: 0;
      color: var(--theme-color);
      text-align: left;
      background: transparent;
      border: 0;
    }

    :deep(.hazard-ledger-page__link strong),
    :deep(.hazard-ledger-page__link small),
    :deep(.hazard-ledger-page__stack strong),
    :deep(.hazard-ledger-page__stack small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.hazard-ledger-page__link small),
    :deep(.hazard-ledger-page__stack small) {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.hazard-ledger-page__stack),
    :deep(.hazard-ledger-page__status) {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    :deep(.hazard-ledger-page__status small) {
      font-size: 11px;
      font-weight: 700;
      color: var(--el-color-danger);
      text-align: center;
    }

    :deep(.hazard-ledger-page__link:focus-visible) {
      outline: 2px solid color-mix(in srgb, var(--theme-color) 65%, transparent);
      outline-offset: 2px;
    }

    :deep(.art-button-table) {
      margin-right: 0;
    }
  }
</style>
