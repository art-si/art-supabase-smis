<template>
  <ArtPermissionGuard permission="SmisSafetyTrainingPlan:View">
    <div class="business-workspace-page art-full-height min-w-0 gap-[12px]">
      <BusinessWorkspaceHeader
        eyebrow="TRAINING READINESS"
        title="安全培训计划"
        description="从参训范围、培训内容到实施记录建立可追溯的安全教育计划。"
        icon="ri:calendar-schedule-line"
        :tags="[
          { label: '员工花名册联动', type: 'primary', effect: 'plain' },
          { label: '计划发布后锁定', type: 'warning', effect: 'light' },
          { label: '记录与签到闭环', type: 'success', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="min-h-0 min-w-0 flex-1"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 82 }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无安全培训计划',
          emptyDescription: '新增培训计划并发布后，可从计划直接创建实施记录。'
        }"
        focusable
      />
      <TrainingPlanDialog ref="dialogRef" @success="handleSaveSuccess" />
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
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useUserStore } from '@/store/modules/user'

  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import {
    deleteSafetyTrainingPlans,
    fetchSafetyTrainingPlanList,
    saveSafetyTrainingPlan,
    type SmisSafetyTrainingOrganizationOption,
    type SmisSafetyTrainingPlan,
    type SmisSafetyTrainingPlanSearchParams
  } from '@smis/api'
  import TrainingPlanDialog, {
    type TrainingPlanDialogOpenData
  } from './modules/training-plan-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_safety_training_plan',
    '安全培训计划'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisSafetyTrainingPlan' })
  type TableParams = SmisSafetyTrainingPlanSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: TrainingPlanDialogOpenData) => Promise<void>
  }
  const router = useRouter()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<SmisSafetyTrainingPlanSearchParams>({})
  const organizations = shallowRef<SmisSafetyTrainingOrganizationOption[]>([])
  const overview = reactive({ total: 0, draft: 0, published: 0, completed: 0, warning: 0 })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '计划总数',
      value: overview.total,
      description: '当前租户全部计划',
      icon: 'ri:calendar-todo-line'
    },
    {
      label: '待发布',
      value: overview.draft,
      description: '仍可调整的草稿',
      icon: 'ri:draft-line'
    },
    {
      label: '执行中',
      value: overview.published,
      description: '等待培训记录兑现',
      icon: 'ri:timer-line',
      tone: 'warning'
    },
    {
      label: '已完成',
      value: overview.completed,
      description: '已有正式培训记录',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '预警计划',
      value: overview.warning,
      description: '人工预警或已逾期',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '计划编号、主题或讲师' }
    },
    {
      label: '计划状态',
      key: 'status',
      type: 'select',
      props: {
        options: dictOptions('smisSafetyTrainingPlanStatus'),
        clearable: true,
        placeholder: '全部状态'
      }
    },
    {
      label: '执行状态',
      key: 'executionStatus',
      type: 'select',
      props: {
        options: dictOptions('smisSafetyTrainingExecutionStatus'),
        clearable: true,
        placeholder: '全部进度'
      }
    },
    {
      label: '培训类别',
      key: 'trainingCategory',
      type: 'select',
      props: {
        options: dictOptions('smisSafetyTrainingCategory'),
        clearable: true,
        placeholder: '全部类别'
      }
    },
    {
      label: '组织单位',
      key: 'organizationId',
      type: 'treeSelect',
      props: {
        data: organizations.value,
        props: { label: 'organizationName', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        clearable: true,
        filterable: true,
        defaultExpandAll: true,
        placeholder: '全部组织'
      }
    },
    {
      label: '计划时间',
      key: 'dateRange',
      type: 'date',
      props: {
        type: 'datetimerange',
        valueFormat: 'YYYY-MM-DDTHH:mm:ssZ',
        startPlaceholder: '开始时间',
        endPlaceholder: '结束时间',
        clearable: true
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
  const openDialog = (row?: SmisSafetyTrainingPlan, copy = false) =>
    void dialogRef.value?.handleOpen({ row, copy, organizations: organizations.value })
  const createRecord = (row: SmisSafetyTrainingPlan) =>
    void router.push({ name: 'SmisSafetyTrainingRecord', query: { planId: row.id } })
  const handlePublish = async (row: SmisSafetyTrainingPlan) => {
    await saveSafetyTrainingPlan(
      {
        id: row.id,
        subject: row.subject,
        trainingCategory: row.trainingCategory,
        trainingType: row.trainingType,
        trainingForm: row.trainingForm,
        trainingLevel: row.trainingLevel,
        organizerOrganizationId: row.organizerOrganizationId,
        targetOrganizationId: row.targetOrganizationId,
        responsibleEmployeeId: row.responsibleEmployeeId,
        instructorName: row.instructorName,
        plannedStartAt: row.plannedStartAt,
        plannedEndAt: row.plannedEndAt,
        location: row.location,
        content: row.content,
        requirements: row.requirements,
        trainingHours: row.trainingHours,
        assessmentMethod: row.assessmentMethod,
        warningStatus: row.warningStatus,
        attachmentUrls: row.attachmentUrls,
        remark: row.remark,
        participantIds: row.participants.map((item) => item.employeeId)
      },
      true
    )
    await tableRef.value?.refreshUpdate()
  }
  const handleDelete = async (row: SmisSafetyTrainingPlan) => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.subject ?? '安全培训计划')
        }
      ],
      permission: 'SmisSafetyTrainingPlan:Delete',
      confirmMessage: `确定删除草稿计划“${row.subject}”吗？`,
      remove: async () => {
        await deleteSafetyTrainingPlans([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const moreActions = (row: SmisSafetyTrainingPlan): ButtonMoreItem[] => [
    {
      auth: 'SmisSafetyTrainingPlan:Copy',
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-2-line'
    },
    {
      auth: 'SmisSafetyTrainingPlan:Publish',
      key: 'publish',
      label: '发布计划',
      icon: 'ri:send-plane-line',
      disabled: row.status !== 'draft'
    },
    {
      auth: 'SmisSafetyTrainingPlan:CreateRecord',
      key: 'record',
      label: row.recordId ? '已创建培训记录' : '创建培训记录',
      icon: 'ri:file-list-3-line',
      disabled: row.status !== 'published' || Boolean(row.recordId)
    },
    {
      auth: 'SmisSafetyTrainingPlan:Delete',
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)',
      disabled: row.status !== 'draft'
    }
  ]
  const handleMore = (item: ButtonMoreItem, row: SmisSafetyTrainingPlan) => {
    if (item.key === 'copy') openDialog(row, true)
    else if (item.key === 'publish') void handlePublish(row)
    else if (item.key === 'record') createRecord(row)
    else void handleDelete(row)
  }
  const columnsFactory = (): ColumnOption<SmisSafetyTrainingPlan>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'subject',
      label: '培训计划',
      minWidth: 260,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.subject}
          secondary={row.planNo}
          icon={
            row.warningStatus === 'warning' ? 'ri:alarm-warning-line' : 'ri:calendar-schedule-line'
          }
          iconTone={row.warningStatus === 'warning' ? 'warning' : 'primary'}
        />
      )
    },
    {
      prop: 'plannedStartAt',
      label: '计划时间',
      width: 220,
      formatter: (row) =>
        `${formatTableDateTime(row.plannedStartAt)} 至 ${formatTableDateTime(row.plannedEndAt)}`
    },
    {
      prop: 'trainingCategory',
      label: '培训类别',
      width: 132,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisSafetyTrainingCategory" value={row.trainingCategory} />
      )
    },
    {
      prop: 'trainingForm',
      label: '培训形式',
      width: 112,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisSafetyTrainingForm" value={row.trainingForm} display="tag" />
      )
    },
    {
      prop: 'organizerOrganizationName',
      label: '组织单位',
      minWidth: 170,
      showOverflowTooltip: true
    },
    {
      prop: 'instructorName',
      label: '培训讲师',
      width: 110,
      formatter: (row) => row.instructorName || '待确定'
    },
    {
      prop: 'participantCount',
      label: '计划人数',
      width: 92,
      align: 'center',
      formatter: (row) => `${row.participantCount} 人`
    },
    {
      prop: 'trainingHours',
      label: '学时',
      width: 76,
      align: 'center',
      formatter: (row) => `${row.trainingHours} h`
    },
    {
      prop: 'executionStatus',
      label: '执行进度',
      width: 96,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisSafetyTrainingExecutionStatus"
          value={row.executionStatus}
          display="tag"
        />
      )
    },
    {
      prop: 'status',
      label: '计划状态',
      width: 96,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisSafetyTrainingPlanStatus" value={row.status} display="tag" />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 124,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex">
          <ArtButtonTable
            type="edit"
            permission="SmisSafetyTrainingPlan:Edit"
            disabled={row.status !== 'draft'}
            onClick={() => openDialog(row)}
          />
          <ArtButtonMore
            list={moreActions(row)}
            onClick={(item: ButtonMoreItem) => handleMore(item, row)}
          />
        </div>
      )
    }
  ]
  const exportColumns = [
    { key: 'planNo', title: '培训计划编号' },
    { key: 'subject', title: '培训主题' },
    { key: 'organizerOrganizationName', title: '组织单位' },
    { key: 'plannedStartAt', title: '计划开始时间' },
    { key: 'plannedEndAt', title: '计划结束时间' },
    { key: 'instructorName', title: '培训讲师' },
    { key: 'participantCount', title: '计划人数' },
    { key: 'trainingHours', title: '培训学时' },
    { key: 'status', title: '计划状态' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisSafetyTrainingPlan:Add',
      type: 'add',
      label: '新增培训计划',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisSafetyTrainingPlan:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条草稿计划吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.subject ?? '安全培训计划')
          })),
          permission: 'SmisSafetyTrainingPlan:Delete',
          remove: async () => {
            await deleteSafetyTrainingPlans(selectedRows.map((row) => row.id as string))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    },
    {
      permission: 'SmisSafetyTrainingPlan:Export',
      type: 'export',
      label: '导出',
      exportFilename: '安全培训计划',
      exportSheetName: '培训计划',
      exportColumns,
      exportApi: async () => ({
        data: await loadAllDocumentPages<
          SmisSafetyTrainingPlan,
          SmisSafetyTrainingPlanSearchParams
        >(fetchSafetyTrainingPlanList, { ...searchQuery.value })
      })
    }
  ])
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchSafetyTrainingPlanList(
      { ...params, from, to },
      { showErrorMessage: false }
    )
    if (options?.signal?.aborted) return result
    if (result.error) {
      throw new Error('培训计划加载失败，请重新加载', { cause: result.error })
    }
    Object.assign(overview, result.overview)
    organizations.value = result.organizations
    return result
  }
  const handleSaveSuccess = (type: 'add' | 'edit') =>
    void (type === 'add' ? tableRef.value?.refreshCreate() : tableRef.value?.refreshUpdate())
  onMounted(async () => {
    await Promise.all(
      [
        'smisSafetyTrainingPlanStatus',
        'smisSafetyTrainingExecutionStatus',
        'smisSafetyTrainingCategory',
        'commonWarningStatus',
        'smisSafetyTrainingForm'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
  })
</script>
