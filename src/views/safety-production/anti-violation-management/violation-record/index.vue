<template>
  <ArtPermissionGuard permission="SmisViolationRecord:View" resource-name="违章记录">
    <div class="violation-record-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="VIOLATION RECORDS"
        title="违章记录"
        description="统一登记违章人员、发生地点、违章项目、检查证据与考核处置，保留主数据历史快照。"
        icon="ri:shield-cross-line"
        :tags="[
          { label: '员工花名册联动', type: 'primary', effect: 'plain' },
          { label: '场所维护联动', type: 'success', effect: 'plain' },
          { label: '标准库自动计分', type: 'warning', effect: 'light' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="violation-record-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 82, showExpand: true, defaultExpanded: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无违章记录',
          emptyDescription: '新增记录后，系统会自动汇总所选标准的扣减分值并保留现场图片。'
        }"
        focusable
      >
      </ArtTableQuery>

      <ViolationRecordDialog ref="dialogRef" @success="handleSaveSuccess" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { uniq } from 'lodash-es'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import dayjs from 'dayjs'
  import { ElAvatar, ElTag } from 'element-plus'
  import TreeUtils from '@/utils/tree'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'

  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteViolationRecords,
    fetchAntiViolationStandardList,
    fetchSiteList,
    fetchViolationRecordList,
    type SmisAntiViolationStandardOption,
    type SmisSite,
    type SmisViolationRecord,
    type SmisViolationRecordOverview,
    type SmisViolationRecordSearchParams
  } from '@smis/api'
  import ViolationRecordDialog, {
    type ViolationRecordDialogMode,
    type ViolationRecordDialogOpenData
  } from './modules/violation-record-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_violation_record',
    '违章记录'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisViolationRecord' })

  type TableParams = SmisViolationRecordSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: ViolationRecordDialogOpenData) => Promise<void>
  }
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const violatorSearchSelection = ref<EmployeeIntegrationItem[]>([])
  const searchQuery = ref<SmisViolationRecordSearchParams>({})
  const sites = shallowRef<SmisSite[]>([])
  const standards = shallowRef<SmisAntiViolationStandardOption[]>([])
  const masterLoading = ref(false)
  const overview = reactive<SmisViolationRecordOverview>({
    total: 0,
    violatorCount: 0,
    deductionPoints: 0,
    fineAmount: 0
  })
  const siteTreeUtils = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '违章记录',
      value: overview.total,
      description: '当前筛选范围',
      icon: 'ri:file-warning-line'
    },
    {
      label: '涉及人员',
      value: overview.violatorCount,
      description: '去重后员工数',
      icon: 'ri:group-line',
      tone: 'warning'
    },
    {
      label: '累计扣分',
      value: Number(overview.deductionPoints).toFixed(2),
      description: '标准库自动汇总',
      icon: 'ri:subtract-line',
      tone: 'danger'
    },
    {
      label: '罚款金额',
      value: `¥${Number(overview.fineAmount).toFixed(2)}`,
      description: '当前筛选合计',
      icon: 'ri:money-cny-circle-line',
      tone: 'success'
    }
  ])

  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '违章编号',
      key: 'recordNo',
      type: 'input',
      props: { clearable: true, placeholder: '输入违章编号' }
    },
    {
      label: '违章情况',
      key: 'violationKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '项目编码、名称或现场情况' }
    },
    {
      label: '违章人员',
      key: 'violatorEmployeeId',
      type: 'employeeSelect',
      props: {
        selectedData: violatorSearchSelection.value,
        title: '选择违章人员',
        subtitle: '数据来自当前租户员工花名册',
        placeholder: '请选择违章人员',
        'onUpdate:selectedData': (rows: EmployeeIntegrationItem[]) => {
          violatorSearchSelection.value = rows
        }
      }
    },
    {
      label: '违章时间',
      key: 'violationTimeRange',
      type: 'date',
      span: 12,
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        rangeSeparator: '至',
        clearable: true,
        class: '!w-full'
      }
    }
  ])

  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'recordNo', title: '违章编号' },
    { key: 'violationSituation', title: '违章情况' },
    { key: 'violatorNames', title: '违章人员' },
    { key: 'organizations', title: '所属部门' },
    { key: 'violationTimeText', title: '违章时间' },
    { key: 'siteName', title: '违章地点' },
    { key: 'deductionPoints', title: '扣减分值' },
    { key: 'fineAmount', title: '罚款金额(元)' },
    { key: 'checkerName', title: '检查人' },
    { key: 'situationDescription', title: '现场情况补充' },
    { key: 'imageCount', title: '图片数量' },
    { key: 'remark', title: '备注' }
  ]
  const formatExportRows = (rows: SmisViolationRecord[]) =>
    rows.map((row) => ({
      ...row,
      violationSituation: row.items
        .map((item) => `(${item.standardCode})${item.standardName}`)
        .join('；'),
      violatorNames: row.violators
        .map((item) => `${item.employeeName}(${item.employeeNo})`)
        .join('、'),
      organizations: uniq(row.violators.map((item) => item.organizationName).filter(Boolean)).join(
        '、'
      ),
      violationTimeText: dayjs(row.violationTime).format('YYYY-MM-DD HH:mm'),
      imageCount: row.imageUrls.length
    }))

  let masterLoadPromise: Promise<void> | null = null
  const loadMasterData = (): Promise<void> => {
    if (masterLoadPromise) return masterLoadPromise
    masterLoading.value = true
    masterLoadPromise = (async () => {
      const [siteResult, standardResult] = await Promise.all([
        fetchSiteList(),
        fetchAntiViolationStandardList({ status: 'enabled', from: 0, to: 999 })
      ])
      sites.value = siteTreeUtils.treeToList(siteResult.data ?? [])
      standards.value = standardResult.data.map((item) => ({
        id: item.id,
        standardCode: item.standardCode,
        standardName: item.standardName,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        deductionPoints: Number(item.deductionPoints)
      }))
    })().finally(() => {
      masterLoading.value = false
      masterLoadPromise = null
    })
    return masterLoadPromise
  }
  const openDialog = async (
    mode: ViolationRecordDialogMode,
    row?: SmisViolationRecord
  ): Promise<void> => {
    await dialogRef.value?.handleOpen({
      mode,
      row,
      sites: sites.value,
      standards: standards.value,
      loadOptions: async () => {
        await loadMasterData()
        return { sites: sites.value, standards: standards.value }
      }
    })
  }

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisViolationRecord:Add',
      type: 'add',
      label: '新增',
      onClick: () => void openDialog('add')
    },
    {
      permission: 'SmisViolationRecord:Copy',
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) => void openDialog('copy', selectedRows[0] as SmisViolationRecord)
    },
    {
      permission: 'SmisViolationRecord:Edit',
      key: 'edit',
      label: '编辑',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) => void openDialog('edit', selectedRows[0] as SmisViolationRecord)
    },
    {
      permission: 'SmisViolationRecord:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条违章记录吗？相关人员、项目与图片引用将一并删除。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.recordNo ?? '违章记录')
          })),
          permission: 'SmisViolationRecord:Delete',
          remove: async () => {
            await deleteViolationRecords(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    },
    {
      permission: 'SmisViolationRecord:Export',
      type: 'export',
      label: '导出',
      exportFilename: '违章记录',
      exportSheetName: '违章记录',
      exportColumns: excelColumns,
      exportApi: async ({ maxRows }) => ({
        data: formatExportRows(
          (
            await fetchViolationRecordList({
              ...searchQuery.value,
              purpose: 'export',
              from: 0,
              to: maxRows - 1
            })
          ).data
        )
      })
    }
  ])

  const columnsFactory = (): ColumnOption<SmisViolationRecord>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    { prop: 'recordNo', label: '违章编号', width: 156, fixed: 'left', showOverflowTooltip: true },
    {
      prop: 'violators',
      label: '违章人员',
      minWidth: 230,
      fixed: 'left',
      formatter: (row) => (
        <div class="violation-record-page__people">
          <div class="violation-record-page__avatars">
            {row.violators.slice(0, 3).map((person) => (
              <ElAvatar size={30} src={person.avatarUrl || undefined}>
                {person.employeeName.slice(-1)}
              </ElAvatar>
            ))}
          </div>
          <div>
            <strong>{row.violators.map((person) => person.employeeName).join('、')}</strong>
            <small>{row.violators.map((person) => person.employeeNo).join('、')}</small>
          </div>
        </div>
      )
    },
    {
      prop: 'items',
      label: '违章情况',
      minWidth: 320,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.items.map((item) => `(${item.standardCode}) ${item.standardName}`).join('；')
    },
    {
      prop: 'organizations',
      label: '所属部门',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) =>
        uniq(row.violators.map((item) => item.organizationName).filter(Boolean)).join('、') || '—'
    },
    {
      prop: 'violationTime',
      label: '违章时间',
      width: 158,
      formatter: (row) => formatTableDateTime(row.violationTime)
    },
    { prop: 'siteName', label: '违章地点', minWidth: 170, showOverflowTooltip: true },
    {
      prop: 'deductionPoints',
      label: '扣减分值',
      width: 108,
      align: 'right',
      formatter: (row) => Number(row.deductionPoints).toFixed(2)
    },
    {
      prop: 'fineAmount',
      label: '罚款金额(元)',
      width: 126,
      align: 'right',
      formatter: (row) => Number(row.fineAmount).toFixed(2)
    },
    { prop: 'checkerName', label: '检查人', width: 116, showOverflowTooltip: true },
    {
      prop: 'imageUrls',
      label: '现场图片',
      width: 104,
      align: 'center',
      formatter: (row) =>
        row.imageUrls.length ? <ElTag effect="plain">{row.imageUrls.length} 张</ElTag> : '—'
    },
    { prop: 'remark', label: '备注', minWidth: 180, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 148,
      fixed: 'right',
      formatter: (row) => (
        <div class="violation-record-page__actions">
          <ArtButtonTable
            permission="SmisViolationRecord:Edit"
            type="edit"
            onClick={() => void openDialog('edit', row)}
          />
          <ArtButtonMore
            list={[
              {
                key: 'copy',
                label: '复制并新增',
                icon: 'ri:file-copy-line',
                auth: 'SmisViolationRecord:Copy'
              },
              {
                key: 'delete',
                label: '删除',
                icon: 'ri:delete-bin-line',
                color: 'var(--el-color-danger)',
                auth: 'SmisViolationRecord:Delete'
              }
            ]}
            onClick={(item: ButtonMoreItem) => void handleMoreAction(item, row)}
          />
        </div>
      )
    }
  ]

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchViolationRecordList({ ...params, ...buildSupabasePageRange(params) })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }
  const handleMoreAction = async (
    item: ButtonMoreItem,
    row: SmisViolationRecord
  ): Promise<void> => {
    if (item.key === 'copy') {
      await openDialog('copy', row)
      return
    }
    if (item.key !== 'delete') return

    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.recordNo ?? '违章记录')
        }
      ],
      permission: 'SmisViolationRecord:Delete',
      confirmMessage: `确定删除违章记录“${row.recordNo}”吗？`,
      remove: async () => {
        await deleteViolationRecords([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }
  const handleSaveSuccess = (): void => void tableQueryRef.value?.getData()
  watch(
    () => searchQuery.value.violatorEmployeeId,
    (value) => {
      if (!value) violatorSearchSelection.value = []
    }
  )
  onMounted(() => void loadMasterData())
</script>

<style scoped lang="scss">
  .violation-record-page {
    gap: 12px;
    min-width: 0;

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.violation-record-page__people) {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;

      > div:last-child {
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
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.violation-record-page__avatars) {
      display: flex;

      .el-avatar + .el-avatar {
        margin-left: -8px;
        box-shadow: 0 0 0 2px var(--el-bg-color);
      }
    }
  }
</style>
