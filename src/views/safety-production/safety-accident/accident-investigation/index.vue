<template>
  <ArtPermissionGuard permission="SmisAccidentInvestigation:View">
    <div class="analysis-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="ACCIDENT ANALYSIS"
        title="事故调查处理"
        description="事故快报保存后自动生成分析单，统一记录主持、参会、记录与整改责任人员。"
        icon="ri:mind-map"
        :tags="[
          { label: '事故快报自动生成', type: 'primary', effect: 'plain' },
          { label: '员工花名册联动', type: 'success', effect: 'light' },
          { label: '分析责任闭环', type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="analysis-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 76, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无事故分析单',
          emptyDescription: '事故快报保存后会自动生成，也可点击事故分析选择已有事故。'
        }"
        focusable
      />
      <AccidentAnalysisDialog ref="dialogRef" @success="handleSaveSuccess" />
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
  import { ElTag } from 'element-plus'
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
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import {
    deleteAccidentAnalyses,
    fetchAccidentAnalysisList,
    type SmisAccidentAnalysis,
    type SmisAccidentAnalysisSearchParams
  } from '@smis/api'
  import AccidentAnalysisDialog, {
    type AccidentAnalysisDialogOpenData
  } from './modules/accident-analysis-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_accident_analysis',
    '事故分析'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisAccidentInvestigation' })
  type TableParams = SmisAccidentAnalysisSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: AccidentAnalysisDialogOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<SmisAccidentAnalysisSearchParams>({})
  const overview = reactive({ total: 0, complete: 0, pending: 0, participantCount: 0 })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '分析单总数',
      value: overview.total,
      description: '与事故快报一一关联',
      icon: 'ri:file-chart-line'
    },
    {
      label: '已完善',
      value: overview.complete,
      description: '关键会议角色已配置',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '待完善',
      value: overview.pending,
      description: '仍需补充人员信息',
      icon: 'ri:time-line',
      tone: 'warning'
    },
    {
      label: '参会人次',
      value: overview.participantCount,
      description: '分析会议累计参加人员',
      icon: 'ri:group-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '事故名称',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '搜索事故名称或事故单号' }
    },
    {
      label: '事故级别',
      key: 'accidentLevel',
      type: 'select',
      props: {
        options: dictOptions('smisAccidentLevel'),
        clearable: true,
        placeholder: '全部事故级别'
      }
    }
  ])
  const employeeName = (employee?: { employeeName?: string } | null): string =>
    employee?.employeeName || '待选择'
  const openDialog = (row?: SmisAccidentAnalysis): void => {
    void dialogRef.value?.handleOpen({ row })
  }
  const handleDelete = async (row: SmisAccidentAnalysis): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.accident.accidentName ?? '事故分析')
        }
      ],
      permission: 'SmisAccidentInvestigation:Delete',
      confirmMessage: `确定删除“${row.accident.accidentName}”的事故分析单吗？`,
      remove: async () => {
        await deleteAccidentAnalyses([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const columnsFactory = (): ColumnOption<SmisAccidentAnalysis>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'accident',
      label: '事故信息',
      minWidth: 250,
      fixed: 'left',
      formatter: (row) => (
        <div class="analysis-page__identity">
          <span>
            <ArtSvgIcon icon="ri:file-search-line" />
          </span>
          <span>
            <strong>{row.accident.accidentName}</strong>
            <small>{row.accident.accidentNo}</small>
          </span>
        </div>
      )
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
      prop: 'hostEmployee',
      label: '主持人',
      minWidth: 120,
      formatter: (row) => employeeName(row.hostEmployee)
    },
    {
      prop: 'participants',
      label: '参加人员',
      minWidth: 210,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.participants.length
          ? row.participants.map((employee) => employee.employeeName).join('、')
          : '待选择'
    },
    {
      prop: 'recorderEmployee',
      label: '记录人',
      minWidth: 120,
      formatter: (row) => employeeName(row.recorderEmployee)
    },
    {
      prop: 'rectificationResponsibleEmployee',
      label: '整改责任人',
      minWidth: 130,
      formatter: (row) => employeeName(row.rectificationResponsibleEmployee)
    },
    {
      prop: 'isComplete',
      label: '准备状态',
      width: 108,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.isComplete ? 'success' : 'warning'} effect="light" round>
          {row.isComplete ? '已完善' : '待完善'}
        </ElTag>
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 158,
      formatter: (row) => formatTableDateTime(row.updateTime)
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
            label="事故分析"
            permission="SmisAccidentInvestigation:Edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisAccidentInvestigation:Delete"
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'accidentNo', title: '关联事故单号' },
    { key: 'accidentName', title: '关联事故名称' },
    { key: 'accidentLevel', title: '事故级别' },
    { key: 'hostName', title: '主持人' },
    { key: 'participantNames', title: '参加人员' },
    { key: 'recorderName', title: '记录人' },
    { key: 'responsibleName', title: '整改责任人' },
    { key: 'status', title: '准备状态' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisAccidentInvestigation:Add',
      type: 'add',
      label: '事故分析',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisAccidentInvestigation:Export',
      type: 'export',
      label: '导出',
      exportFilename: '事故分析单',
      exportSheetName: '事故分析单',
      exportColumns: excelColumns,
      exportApi: async ({ selectedIds, maxRows }) => {
        const rows = (
          await fetchAccidentAnalysisList({
            ...searchQuery.value,
            ids: selectedIds?.map(String),
            from: 0,
            to: maxRows - 1
          })
        ).data
        return {
          data: rows.map((row) => ({
            accidentNo: row.accident.accidentNo,
            accidentName: row.accident.accidentName,
            accidentLevel:
              userStore.getDictLabelByValue('smisAccidentLevel', row.accidentLevel) ||
              row.accidentLevel,
            hostName: employeeName(row.hostEmployee),
            participantNames: row.participants.map((employee) => employee.employeeName).join('、'),
            recorderName: employeeName(row.recorderEmployee),
            responsibleName: employeeName(row.rectificationResponsibleEmployee),
            status: row.isComplete ? '已完善' : '待完善'
          }))
        }
      }
    },
    {
      permission: 'SmisAccidentInvestigation:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条事故分析单吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.accident.accidentName ?? '事故分析')
          })),
          permission: 'SmisAccidentInvestigation:Delete',
          remove: async () => {
            await deleteAccidentAnalyses(selectedRows.map((row) => String(row.id)))
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
    const result = await fetchAccidentAnalysisList({ ...filters, from, to })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return result
  }
  const handleSaveSuccess = (): void => {
    void tableRef.value?.getData()
  }
  onMounted(() => userStore.ensureDictLoaded('smisAccidentLevel'))
</script>

<style scoped lang="scss">
  .analysis-page {
    min-width: 0;

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.analysis-page__identity) {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;

      > span:first-child {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        border-radius: var(--el-border-radius-base);
      }

      > span:last-child {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
