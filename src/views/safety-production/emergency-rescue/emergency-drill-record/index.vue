<template>
  <ArtPermissionGuard permission="SmisEmergencyDrillRecord:View">
    <div class="drill-record-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="DRILL EVIDENCE"
        title="应急演练记录"
        description="承接演练计划，沉淀实际日期、参演人员、过程评价与现场证据。"
        icon="ri:file-check-line"
        :tags="[
          { label: '计划自动带入', type: 'primary', effect: 'plain' },
          { label: '员工批量选择', type: 'success', effect: 'light' },
          { label: '提交即兑现', type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
        ><template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template
      ></BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="drill-record-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 82, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无应急演练记录',
          emptyDescription: '可从演练计划下推，或新增记录后选择计划编号。'
        }"
        focusable
      />
      <DrillRecordDialog ref="dialogRef" @success="handleSaveSuccess" />
      <EmergencyRecordDetailDialog ref="detailDialogRef" />
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
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
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
  import BusinessRecordLink from '@/components/business/business-record-link/index.vue'
  import {
    deleteEmergencyDrillRecords,
    fetchEmergencyDrillRecordList,
    type SmisEmergencyDrillPlanOption,
    type SmisEmergencyDrillRecord,
    type SmisEmergencyDrillRecordSearchParams
  } from '@smis/api'
  import DrillRecordDialog, {
    type DrillRecordDialogOpenData
  } from './modules/drill-record-dialog.vue'
  import EmergencyRecordDetailDialog, {
    type EmergencyRecordDetailOpenData
  } from '../shared/emergency-record-detail-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_emergency_drill_record',
    '应急演练记录'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  const commonDraftSubmittedStatusOptions = useDictionaryOptions('commonDraftSubmittedStatus')

  defineOptions({ name: 'SmisEmergencyDrillRecord' })
  type TableParams = SmisEmergencyDrillRecordSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: DrillRecordDialogOpenData) => Promise<void>
  }
  interface DetailDialogExpose {
    handleOpen: (data: EmergencyRecordDetailOpenData) => Promise<void>
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const detailDialogRef = ref<DetailDialogExpose>()
  const searchQuery = ref<SmisEmergencyDrillRecordSearchParams>({})
  const planOptions = shallowRef<SmisEmergencyDrillPlanOption[]>([])
  const overview = reactive({ total: 0, draft: 0, submitted: 0, late: 0 })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const recordStatusOptions = computed(() => {
    const options = dictOptions('commonDraftSubmittedStatus')
    return options.length ? options : commonDraftSubmittedStatusOptions
  })
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '记录总数',
      value: overview.total,
      description: '当前租户演练记录',
      icon: 'ri:file-list-3-line'
    },
    { label: '草稿', value: overview.draft, description: '等待补充并提交', icon: 'ri:draft-line' },
    {
      label: '已提交',
      value: overview.submitted,
      description: '正式演练证据',
      icon: 'ri:shield-check-line',
      tone: 'success'
    },
    {
      label: '延迟完成',
      value: overview.late,
      description: '实际日期晚于计划完成日',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '计划编号或演练名称' }
    },
    {
      label: '记录状态',
      key: 'status',
      type: 'select',
      props: {
        options: recordStatusOptions.value,
        clearable: true,
        placeholder: '全部状态'
      }
    },
    {
      label: '开始日期',
      key: 'startDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', clearable: true }
    },
    {
      label: '结束日期',
      key: 'endDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', clearable: true }
    }
  ])
  const toPlanOption = (row: SmisEmergencyDrillRecord): SmisEmergencyDrillPlanOption => ({
    id: row.drillPlanId,
    planNo: row.planNo,
    drillName: row.drillName,
    sourcePlanName: row.sourcePlanName,
    drillForm: row.drillForm,
    planCategory: row.planCategory,
    planLevel: row.planLevel,
    applicableOrganizationId: row.applicableOrganizationId,
    applicableOrganizationName: row.applicableOrganizationName,
    responsibleEmployeeName: row.responsibleEmployeeName,
    planStartDate: row.planStartDate,
    planEndDate: row.planEndDate,
    drillLocation: row.drillLocation,
    drillSubject: row.drillSubject,
    drillPurpose: row.drillPurpose
  })
  const openDialog = (row?: SmisEmergencyDrillRecord) => {
    const availablePlans = row
      ? [toPlanOption(row), ...planOptions.value.filter((item) => item.id !== row.drillPlanId)]
      : planOptions.value
    void dialogRef.value?.handleOpen({ row, planOptions: availablePlans })
  }
  const openDetail = (row: SmisEmergencyDrillRecord): void => {
    void detailDialogRef.value?.handleOpen({ kind: 'record', row })
  }
  const handleDelete = async (row: SmisEmergencyDrillRecord) => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.drillName ?? '应急演练记录')
        }
      ],
      permission: 'SmisEmergencyDrillRecord:Delete',
      confirmMessage: `确定删除草稿记录“${row.drillName}”吗？`,
      remove: async () => {
        await deleteEmergencyDrillRecords([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const columnsFactory = (): ColumnOption<SmisEmergencyDrillRecord>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'drillName',
      label: '演练记录',
      minWidth: 250,
      fixed: 'left',
      formatter: (row) => (
        <div class="drill-record-page__identity">
          <span>
            <ArtSvgIcon icon="ri:file-check-line" />
          </span>
          <BusinessRecordLink
            label={row.drillName}
            meta={row.planNo}
            title={`查看演练记录：${row.drillName}`}
            interactive
            compact
            onClick={() => openDetail(row)}
          />
        </div>
      )
    },
    { prop: 'sourcePlanName', label: '应急救援预案', minWidth: 190, showOverflowTooltip: true },
    {
      prop: 'actualStartDate',
      label: '实际演练日期',
      width: 130,
      formatter: (row) => row.actualStartDate || '待填写'
    },
    {
      prop: 'applicableOrganizationName',
      label: '演练单位',
      minWidth: 160,
      showOverflowTooltip: true
    },
    {
      prop: 'drillForm',
      label: '演练形式',
      width: 105,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEmergencyDrillForm" value={row.drillForm} display="tag" />
      )
    },
    {
      prop: 'planCategory',
      label: '计划类别',
      width: 135,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEmergencyPlanCategory" value={row.planCategory} />
      )
    },
    {
      prop: 'planLevel',
      label: '演练级别',
      width: 108,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEmergencyPlanLevel" value={row.planLevel} display="tag" />
      )
    },
    {
      prop: 'participants',
      label: '参演人数',
      width: 90,
      align: 'center',
      formatter: (row) => `${row.participants.length} 人`
    },
    {
      prop: 'drillSubject',
      label: '演练科目',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => row.drillSubject || '—'
    },
    {
      prop: 'status',
      label: '记录状态',
      width: 100,
      formatter: (row) => (
        <ElTag type={row.status === 'submitted' ? 'success' : 'info'} effect="light">
          {row.status === 'submitted' ? '已提交' : '草稿'}
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
      width: 162,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex">
          <ArtButtonTable
            type="view"
            permission="SmisEmergencyDrillRecord:View"
            label="查看演练记录"
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            type="edit"
            permission="SmisEmergencyDrillRecord:Edit"
            disabled={row.status !== 'draft'}
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisEmergencyDrillRecord:Delete"
            disabled={row.status !== 'draft'}
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisEmergencyDrillRecord:Add',
      type: 'add',
      label: '新增演练记录',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisEmergencyDrillRecord:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条草稿记录吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.drillName ?? '应急演练记录')
          })),
          permission: 'SmisEmergencyDrillRecord:Delete',
          remove: async () => {
            await deleteEmergencyDrillRecords(selectedRows.map((row) => row.id as string))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchEmergencyDrillRecordList({ ...params, from, to })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    planOptions.value = result.planOptions
    return result
  }
  const handleSaveSuccess = (type: 'add' | 'edit') =>
    void (type === 'add' ? tableRef.value?.refreshCreate() : tableRef.value?.refreshUpdate())
  onMounted(async () => {
    await Promise.all(
      [
        'commonDraftSubmittedStatus',
        'smisEmergencyDrillForm',
        'smisEmergencyPlanCategory',
        'smisEmergencyPlanLevel'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
  })
</script>

<style scoped lang="scss">
  .drill-record-page {
    gap: 12px;
    min-width: 0;

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.drill-record-page__identity) {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;

      > span:first-child {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        color: var(--el-color-success);
        background: color-mix(in srgb, var(--el-color-success) 9%, var(--el-bg-color));
        border-radius: var(--el-border-radius-base);
      }
    }
  }
</style>
