<template>
  <ArtPermissionGuard permission="SmisAccidentFlashReport:View">
    <div class="accident-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="INCIDENT RESPONSE"
        title="事故快报"
        description="及时固化事故事实、人员影响与防范责任，为调查处置和工伤申报提供统一依据。"
        icon="ri:alarm-warning-line"
        :tags="[
          { label: '编号自动生成', type: 'primary', effect: 'plain' },
          { label: '人员档案快照', type: 'warning', effect: 'light' },
          { label: '防范责任闭环', type: 'success', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="accident-page__risk-strip" role="note">
        <span><ArtSvgIcon icon="ri:shield-cross-line" /></span>
        <p
          ><strong>快报完整性提示</strong
          >事故时间、地点、类别与级别是追溯核心；人员记录按保存时的花名册内容留存。</p
        >
      </div>

      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="accident-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 76, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无事故快报',
          emptyDescription: '可点击新增，快速记录事故及相关人员信息。'
        }"
        focusable
      />
      <AccidentReportDialog ref="dialogRef" @success="handleSaveSuccess" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import dayjs from 'dayjs'
  import { computed, onMounted, reactive, ref, shallowRef } from 'vue'
  import { storeToRefs } from 'pinia'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { useUserStore } from '@/store/modules/user'

  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import {
    deleteAccidentReports,
    fetchAccidentReportList,
    type SmisAccidentEmployee,
    type SmisAccidentReport,
    type SmisAccidentReportSearchParams,
    type SmisTreeOrganization
  } from '@smis/api'
  import AccidentReportDialog, {
    type AccidentReportDialogOpenData
  } from './modules/accident-report-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('smis_accident_report', '事故快报')

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })
  const formatTableDateTime2 = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisAccidentFlashReport' })
  interface AccidentSearchModel extends SmisAccidentReportSearchParams {
    accidentTimeRange?: [string, string]
  }
  type TableParams = AccidentSearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: AccidentReportDialogOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<AccidentSearchModel>({})
  const organizations = shallowRef<SmisTreeOrganization[]>([])
  const currentEmployee = shallowRef<SmisAccidentEmployee | null>(null)
  const overview = reactive({ total: 0, currentMonth: 0, highSeverity: 0, affectedPeople: 0 })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '事故快报',
      value: overview.total,
      description: '当前租户全部记录',
      icon: 'ri:file-warning-line'
    },
    {
      label: '本月新增',
      value: overview.currentMonth,
      description: '本月发生事故',
      icon: 'ri:calendar-event-line'
    },
    {
      label: '较大及以上',
      value: overview.highSeverity,
      description: '需重点跟踪处置',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    },
    {
      label: '涉及人员',
      value: overview.affectedPeople,
      description: '已登记人员人次',
      icon: 'ri:group-line',
      tone: 'warning'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '事故编号、名称或地点' }
    },
    {
      label: '事故级别',
      key: 'accidentLevel',
      type: 'select',
      props: { options: dictOptions('smisAccidentLevel'), clearable: true, placeholder: '全部级别' }
    },
    {
      label: '事故类别',
      key: 'accidentCategory',
      type: 'select',
      props: {
        options: dictOptions('smisAccidentCategory'),
        clearable: true,
        filterable: true,
        placeholder: '全部类别'
      }
    },
    {
      label: '事故时间',
      key: 'accidentTimeRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        clearable: true
      }
    }
  ])
  const openDialog = (row?: SmisAccidentReport): void => {
    void dialogRef.value?.handleOpen({
      row,
      organizations: organizations.value,
      currentEmployee: currentEmployee.value
    })
  }
  const handleDelete = async (row: SmisAccidentReport): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.accidentName ?? '事故快报')
        }
      ],
      permission: 'SmisAccidentFlashReport:Delete',
      confirmMessage: `确定删除事故快报“${row.accidentName}”吗？`,
      remove: async () => {
        await deleteAccidentReports([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const categorySummary = (row: SmisAccidentReport): string =>
    row.accidentCategories
      .map((value) => userStore.getDictLabelByValue('smisAccidentCategory', value) || value)
      .join('、') || '—'
  const columnsFactory = (): ColumnOption<SmisAccidentReport>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'accidentName',
      label: '事故信息',
      minWidth: 250,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.accidentName}
          secondary={row.accidentNo}
          icon="ri:alarm-warning-line"
          iconTone={
            ['major', 'severe', 'catastrophic'].includes(row.accidentLevel) ? 'danger' : 'warning'
          }
        />
      )
    },
    {
      prop: 'accidentTime',
      label: '事故时间',
      width: 158,
      formatter: (row) => formatTableDateTime(row.accidentTime)
    },
    { prop: 'accidentLocation', label: '事故地点', minWidth: 180, showOverflowTooltip: true },
    {
      prop: 'accidentCategories',
      label: '事故类别',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: categorySummary
    },
    {
      prop: 'accidentLevel',
      label: '事故级别',
      width: 112,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisAccidentLevel" value={row.accidentLevel} display="tag" />
      )
    },
    {
      prop: 'operationAreaOrganizationName',
      label: '发生作业区',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.operationAreaOrganizationName || '未选择'
    },
    {
      prop: 'reporterEmployee',
      label: '上报人',
      width: 112,
      formatter: (row) => row.reporterEmployee?.employeeName || '—'
    },
    {
      prop: 'minorInjuryCount',
      label: '人员统计',
      minWidth: 238,
      formatter: (row) => (
        <div class="accident-page__people-stats">
          <span>
            <small>轻伤</small>
            {row.minorInjuryCount}
          </span>
          <span>
            <small>重伤</small>
            {row.seriousInjuryCount}
          </span>
          <span class={{ 'is-danger': row.deathCount > 0 }}>
            <small>死亡</small>
            {row.deathCount}
          </span>
          <span>
            <small>现场</small>
            {row.onSiteCount}
          </span>
        </div>
      )
    },
    {
      prop: 'briefDescription',
      label: '事故简要经过',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.briefDescription || '—'
    },
    {
      prop: 'indirectEconomicLoss',
      label: '间接损失',
      width: 112,
      align: 'right',
      formatter: (row) => `${Number(row.indirectEconomicLoss || 0).toFixed(2)} 万元`
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 158,
      formatter: (row) => formatTableDateTime2(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) => (
        <div>
          <ArtButtonTable
            type="edit"
            permission="SmisAccidentFlashReport:Edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisAccidentFlashReport:Delete"
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'accidentNo', title: '事故编号' },
    { key: 'accidentName', title: '事故名称' },
    { key: 'reporterName', title: '上报人' },
    { key: 'accidentTime', title: '事故时间' },
    { key: 'accidentLocation', title: '事故地点' },
    { key: 'accidentCategories', title: '事故类别' },
    { key: 'operationAreaOrganizationName', title: '事故发生作业区' },
    { key: 'accidentLevel', title: '事故级别' },
    { key: 'indirectEconomicLoss', title: '间接经济损失（万元）' },
    { key: 'minorInjuryCount', title: '轻伤人数' },
    { key: 'seriousInjuryCount', title: '重伤人数' },
    { key: 'deathCount', title: '死亡人数' },
    { key: 'onSiteCount', title: '现场人数' },
    { key: 'briefDescription', title: '事故简要经过' },
    { key: 'causeAnalysis', title: '原因分析' },
    { key: 'resultDetermination', title: '结果判定' },
    { key: 'peopleCount', title: '涉及人员数' }
  ]
  const toApiParams = (params: AccidentSearchModel): SmisAccidentReportSearchParams => {
    const { accidentTimeRange, ...rest } = params
    return {
      ...rest,
      startTime: accidentTimeRange?.[0] ? `${accidentTimeRange[0]} 00:00:00` : undefined,
      endTime: accidentTimeRange?.[1] ? `${accidentTimeRange[1]} 23:59:59` : undefined
    }
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisAccidentFlashReport:Add',
      type: 'add',
      label: '新增事故快报',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisAccidentFlashReport:Export',
      type: 'export',
      label: '导出',
      exportFilename: '事故快报',
      exportSheetName: '事故快报',
      exportColumns: excelColumns,
      exportApi: async ({ selectedIds, maxRows }) => {
        const rows = (
          await fetchAccidentReportList({
            ...toApiParams(searchQuery.value),
            ids: selectedIds?.map(String),
            from: 0,
            to: maxRows - 1
          })
        ).data
        return {
          data: rows.map((row) => ({
            accidentNo: row.accidentNo,
            accidentName: row.accidentName,
            reporterName: row.reporterEmployee?.employeeName || '',
            accidentTime: dayjs(row.accidentTime).format('YYYY-MM-DD HH:mm:ss'),
            accidentLocation: row.accidentLocation,
            accidentCategories: categorySummary(row),
            operationAreaOrganizationName: row.operationAreaOrganizationName || '',
            accidentLevel:
              userStore.getDictLabelByValue('smisAccidentLevel', row.accidentLevel) ||
              row.accidentLevel,
            indirectEconomicLoss: Number(row.indirectEconomicLoss || 0),
            minorInjuryCount: row.minorInjuryCount,
            seriousInjuryCount: row.seriousInjuryCount,
            deathCount: row.deathCount,
            onSiteCount: row.onSiteCount,
            briefDescription: row.briefDescription || '',
            causeAnalysis: row.causeAnalysis || '',
            resultDetermination: row.resultDetermination || '',
            peopleCount: row.people.length
          }))
        }
      }
    },
    {
      permission: 'SmisAccidentFlashReport:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条事故快报吗？关联工伤申报的事故不可删除。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.accidentName ?? '事故快报')
          })),
          permission: 'SmisAccidentFlashReport:Delete',
          remove: async () => {
            await deleteAccidentReports(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { current, size, ...filters } = params
    const { from, to } = buildSupabasePageRange({ current, size })
    const result = await fetchAccidentReportList({ ...toApiParams(filters), from, to })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    organizations.value = result.organizations
    currentEmployee.value = result.currentEmployee
    return result
  }
  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add' ? tableRef.value?.refreshCreate() : tableRef.value?.refreshUpdate())
  }
  onMounted(async () => {
    await Promise.all(
      ['smisAccidentCategory', 'smisAccidentLevel'].map((code) => userStore.ensureDictLoaded(code))
    )
  })
</script>

<style scoped lang="scss">
  .accident-page {
    min-width: 0;

    &__risk-strip {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 9px 14px;
      color: var(--el-text-color-regular);
      background: color-mix(in srgb, var(--el-color-warning) 7%, var(--el-bg-color));
      border-left: 3px solid var(--el-color-warning);
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        flex: 0 0 30px;
        place-items: center;
        width: 30px;
        height: 30px;
        color: var(--el-color-warning-dark-2);
        background: var(--el-bg-color);
        border-radius: 50%;
      }

      p {
        margin: 0;
        font-size: 12px;
      }

      strong {
        margin-right: 8px;
        font-size: 13px;
        color: var(--el-text-color-primary);
      }
    }

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.accident-page__people-stats) {
      display: grid;
      grid-template-columns: repeat(4, minmax(42px, 1fr));
      gap: 6px;
      font-variant-numeric: tabular-nums;

      > span {
        display: grid;
        gap: 1px;
        min-width: 0;
        font-weight: 600;
        color: var(--el-text-color-primary);
        text-align: center;
      }

      small {
        font-size: 11px;
        font-weight: 400;
        color: var(--el-text-color-secondary);
      }

      .is-danger,
      .is-danger small {
        color: var(--el-color-danger);
      }
    }

    @media (width <= 720px) {
      &__risk-strip {
        align-items: flex-start;
      }

      &__risk-strip strong {
        display: block;
        margin-bottom: 2px;
      }
    }
  }
</style>
