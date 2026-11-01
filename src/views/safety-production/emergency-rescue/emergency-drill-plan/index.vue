<template>
  <ArtPermissionGuard permission="SmisEmergencyDrillPlan:View">
    <div class="drill-plan-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="DRILL READINESS"
        title="应急演练计划"
        description="将有效应急预案转化为有负责人、有期限、可兑现的演练任务。"
        icon="ri:calendar-check-line"
        :tags="[
          { label: '预案一对多', type: 'primary', effect: 'plain' },
          { label: '到期前 3 天预警', type: 'warning', effect: 'light' },
          { label: '下推演练记录', type: 'success', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="drill-plan-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 82, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无应急演练计划',
          emptyDescription: '可新增计划，或从应急救援预案下推生成草稿。'
        }"
        focusable
      />
      <DrillPlanDialog ref="dialogRef" @success="handleSaveSuccess" />
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
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { useUserStore } from '@/store/modules/user'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessRecordLink from '@/components/business/business-record-link/index.vue'
  import {
    deleteEmergencyDrillPlans,
    fetchEmergencyDrillPlanList,
    pushEmergencyDrillPlanToRecord,
    type SmisEmergencyDrillPlan,
    type SmisEmergencyDrillPlanSearchParams,
    type SmisTreeOrganization
  } from '@smis/api'
  import DrillPlanDialog, { type DrillPlanDialogOpenData } from './modules/drill-plan-dialog.vue'
  import EmergencyRecordDetailDialog, {
    type EmergencyRecordDetailOpenData
  } from '../shared/emergency-record-detail-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_emergency_drill_plan',
    '应急演练计划'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisEmergencyDrillPlan' })
  type TableParams = SmisEmergencyDrillPlanSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: DrillPlanDialogOpenData) => Promise<void>
  }
  interface DetailDialogExpose {
    handleOpen: (data: EmergencyRecordDetailOpenData) => Promise<void>
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { confirm } = useArtFeedback()
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const detailDialogRef = ref<DetailDialogExpose>()
  const searchQuery = ref<SmisEmergencyDrillPlanSearchParams>({})
  const organizations = shallowRef<SmisTreeOrganization[]>([])
  const overview = reactive({ total: 0, planned: 0, completed: 0, warning: 0 })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '计划总数',
      value: overview.total,
      description: '当前租户全部计划',
      icon: 'ri:calendar-todo-line'
    },
    {
      label: '计划中',
      value: overview.planned,
      description: '等待演练兑现',
      icon: 'ri:timer-line'
    },
    {
      label: '已完成',
      value: overview.completed,
      description: '已有正式记录',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '预警计划',
      value: overview.warning,
      description: '临期、逾期或延迟完成',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '计划编号或名称' }
    },
    {
      label: '计划状态',
      key: 'status',
      type: 'select',
      props: {
        options: dictOptions('smisEmergencyDrillPlanStatus'),
        clearable: true,
        placeholder: '全部状态'
      }
    },
    {
      label: '演练形式',
      key: 'drillForm',
      type: 'select',
      props: {
        options: dictOptions('smisEmergencyDrillForm'),
        clearable: true,
        placeholder: '全部形式'
      }
    },
    {
      label: '预警状态',
      key: 'warningStatus',
      type: 'select',
      props: {
        options: dictOptions('commonWarningStatus'),
        clearable: true,
        placeholder: '全部状态'
      }
    }
  ])
  const openDialog = (row?: SmisEmergencyDrillPlan) =>
    void dialogRef.value?.handleOpen({ row, organizations: organizations.value })
  const openDetail = (row: SmisEmergencyDrillPlan): void => {
    void detailDialogRef.value?.handleOpen({ kind: 'drill', row })
  }
  const handlePush = async (row: SmisEmergencyDrillPlan) => {
    try {
      await confirm(`确定将计划“${row.drillName}”下推为演练记录草稿吗？`)
      await pushEmergencyDrillPlanToRecord(row.id)
      await tableRef.value?.refreshUpdate()
    } catch {
      /* 用户取消或服务端业务校验失败 */
    }
  }
  const handleDelete = async (row: SmisEmergencyDrillPlan) => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.drillName ?? '应急演练计划')
        }
      ],
      permission: 'SmisEmergencyDrillPlan:Delete',
      confirmMessage: `确定删除草稿计划“${row.drillName}”吗？`,
      remove: async () => {
        await deleteEmergencyDrillPlans([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const moreActions = (row: SmisEmergencyDrillPlan): ButtonMoreItem[] => [
    {
      auth: 'SmisEmergencyDrillPlan:Push',
      key: 'push',
      label: row.recordId ? '已下推演练记录' : '下推演练记录',
      icon: 'ri:git-branch-line',
      disabled: row.status !== 'planned' || Boolean(row.recordId)
    },
    {
      auth: 'SmisEmergencyDrillPlan:Delete',
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)',
      disabled: row.status !== 'draft'
    }
  ]
  const columnsFactory = (): ColumnOption<SmisEmergencyDrillPlan>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'drillName',
      label: '演练计划',
      minWidth: 250,
      fixed: 'left',
      formatter: (row) => (
        <div class="drill-plan-page__identity">
          <span class={row.warningStatus === 'warning' ? 'is-warning' : ''}>
            <ArtSvgIcon
              icon={
                row.warningStatus === 'warning' ? 'ri:alarm-warning-line' : 'ri:calendar-check-line'
              }
            />
          </span>
          <BusinessRecordLink
            label={row.drillName}
            meta={row.planNo}
            title={`查看演练计划：${row.drillName}`}
            interactive
            compact
            onClick={() => openDetail(row)}
          />
        </div>
      )
    },
    { prop: 'sourcePlanName', label: '应急救援预案', minWidth: 190, showOverflowTooltip: true },
    {
      prop: 'planStartDate',
      label: '计划周期',
      width: 190,
      formatter: (row) => `${row.planStartDate || '—'} 至 ${row.planEndDate || '—'}`
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
      prop: 'applicableOrganizationName',
      label: '演练单位',
      minWidth: 160,
      showOverflowTooltip: true
    },
    {
      prop: 'responsibleEmployeeName',
      label: '负责人',
      width: 110,
      formatter: (row) => row.responsibleEmployeeName || '待完善'
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
      prop: 'trainees',
      label: '参训人数',
      width: 90,
      align: 'center',
      formatter: (row) => `${row.trainees.length} 人`
    },
    {
      prop: 'warningStatus',
      label: '预警',
      width: 88,
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonWarningStatus" value={row.warningStatus} display="tag" />
      )
    },
    {
      prop: 'status',
      label: '计划状态',
      width: 100,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEmergencyDrillPlanStatus" value={row.status} display="tag" />
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
            permission="SmisEmergencyDrillPlan:View"
            label="查看演练计划"
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            type="edit"
            permission="SmisEmergencyDrillPlan:Edit"
            disabled={row.status !== 'draft'}
            onClick={() => openDialog(row)}
          />
          <ArtButtonMore
            list={moreActions(row)}
            onClick={(item: ButtonMoreItem) =>
              item.key === 'push' ? void handlePush(row) : void handleDelete(row)
            }
          />
        </div>
      )
    }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisEmergencyDrillPlan:Add',
      type: 'add',
      label: '新增演练计划',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisEmergencyDrillPlan:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条草稿计划吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.drillName ?? '应急演练计划')
          })),
          permission: 'SmisEmergencyDrillPlan:Delete',
          remove: async () => {
            await deleteEmergencyDrillPlans(selectedRows.map((row) => row.id as string))
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
    const result = await fetchEmergencyDrillPlanList({ ...params, from, to })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    organizations.value = result.organizations
    return result
  }
  const handleSaveSuccess = (type: 'add' | 'edit') =>
    void (type === 'add' ? tableRef.value?.refreshCreate() : tableRef.value?.refreshUpdate())
  onMounted(async () => {
    await Promise.all(
      [
        'smisEmergencyDrillPlanStatus',
        'smisEmergencyDrillForm',
        'smisEmergencyPlanCategory',
        'smisEmergencyPlanLevel',
        'commonWarningStatus'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
  })
</script>

<style scoped lang="scss">
  .drill-plan-page {
    min-width: 0;

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.drill-plan-page__identity) {
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
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
        border-radius: var(--el-border-radius-base);

        &.is-warning {
          color: var(--el-color-danger);
          background: color-mix(in srgb, var(--el-color-danger) 9%, var(--el-bg-color));
        }
      }
    }
  }
</style>
