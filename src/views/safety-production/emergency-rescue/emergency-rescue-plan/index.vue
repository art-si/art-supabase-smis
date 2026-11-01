<template>
  <ArtPermissionGuard permission="SmisEmergencyRescuePlan:View">
    <div class="emergency-plan-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="EMERGENCY PREPAREDNESS"
        title="应急救援预案"
        description="统一管理预案适用范围、演练频次、有效状态和下推演练计划。"
        icon="ri:file-shield-2-line"
        :tags="[
          { label: '组织级别联动', type: 'primary', effect: 'plain' },
          { label: '有效性控制', type: 'success', effect: 'light' },
          { label: '下推演练计划', type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="emergency-plan-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 82, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无应急救援预案',
          emptyDescription: '可新增预案并提交，随后下推形成演练计划草稿。'
        }"
        focusable
      />
      <EmergencyPlanDialog ref="dialogRef" @success="handleSaveSuccess" />
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
    deleteEmergencyRescuePlans,
    fetchEmergencyRescuePlanList,
    pushEmergencyRescuePlan,
    setEmergencyRescuePlanValidity,
    type SmisEmergencyPosition,
    type SmisEmergencyRescuePlan,
    type SmisEmergencyRescuePlanSearchParams,
    type SmisTreeOrganization
  } from '@smis/api'
  import EmergencyPlanDialog, {
    type EmergencyPlanDialogOpenData
  } from './modules/emergency-plan-dialog.vue'
  import EmergencyRecordDetailDialog, {
    type EmergencyRecordDetailOpenData
  } from '../shared/emergency-record-detail-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_emergency_rescue_plan',
    '应急预案'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisEmergencyRescuePlan' })
  type TableParams = SmisEmergencyRescuePlanSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: EmergencyPlanDialogOpenData) => Promise<void>
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
  const searchQuery = ref<SmisEmergencyRescuePlanSearchParams>({})
  const organizations = shallowRef<SmisTreeOrganization[]>([])
  const positions = shallowRef<SmisEmergencyPosition[]>([])
  const overview = reactive({ total: 0, valid: 0, warning: 0, submitted: 0 })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '预案总数',
      value: overview.total,
      description: '当前租户预案',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '有效预案',
      value: overview.valid,
      description: '下游业务可选择',
      icon: 'ri:shield-check-line',
      tone: 'success'
    },
    {
      label: '已提交',
      value: overview.submitted,
      description: '进入正式预案库',
      icon: 'ri:checkbox-circle-line'
    },
    {
      label: '预警中',
      value: overview.warning,
      description: '需及时关注',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '预案编码或名称' }
    },
    {
      label: '预案类别',
      key: 'planCategory',
      type: 'select',
      props: {
        options: dictOptions('smisEmergencyPlanCategory'),
        clearable: true,
        placeholder: '全部类别'
      }
    },
    {
      label: '是否有效',
      key: 'isValid',
      type: 'select',
      props: {
        options: dictOptions('commonBoolean').map((item) => ({
          ...item,
          value: item.value === 'true'
        })),
        clearable: true,
        placeholder: '全部状态'
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
  const openDialog = (row?: SmisEmergencyRescuePlan): void => {
    void dialogRef.value?.handleOpen({
      row,
      organizations: organizations.value,
      positions: positions.value
    })
  }
  const openDetail = (row: SmisEmergencyRescuePlan): void => {
    void detailDialogRef.value?.handleOpen({ kind: 'rescue', row })
  }
  const handleMoreAction = (item: ButtonMoreItem, row: SmisEmergencyRescuePlan): void => {
    if (item.key === 'push') void handlePush(row)
    if (item.key === 'void') void handleValidity([row.id ?? ''], false, row.planName)
    if (item.key === 'activate') void handleValidity([row.id ?? ''], true, row.planName)
    if (item.key === 'delete') void handleDelete(row)
  }
  const rowActions = (row: SmisEmergencyRescuePlan): ButtonMoreItem[] => [
    {
      auth: 'SmisEmergencyRescuePlan:Push',
      key: 'push',
      label: '下推演练计划',
      icon: 'ri:git-branch-line',
      disabled: row.recordStatus !== 'submitted' || !row.isValid
    },
    ...(row.isValid
      ? [
          {
            auth: 'SmisEmergencyRescuePlan:Void',
            key: 'void',
            label: '置废',
            icon: 'ri:forbid-2-line',
            color: 'var(--el-color-warning)'
          }
        ]
      : [
          {
            auth: 'SmisEmergencyRescuePlan:Activate',
            key: 'activate',
            label: '有效',
            icon: 'ri:checkbox-circle-line',
            color: 'var(--el-color-success)'
          }
        ]),
    {
      auth: 'SmisEmergencyRescuePlan:Delete',
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-line',
      color: 'var(--el-color-danger)',
      disabled: row.recordStatus !== 'draft'
    }
  ]
  const columnsFactory = (): ColumnOption<SmisEmergencyRescuePlan>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'planName',
      label: '应急救援预案',
      minWidth: 250,
      fixed: 'left',
      formatter: (row) => (
        <div class="emergency-plan-page__identity">
          <span>
            <ArtSvgIcon
              icon={
                row.warningStatus === 'warning' ? 'ri:alarm-warning-line' : 'ri:file-shield-2-line'
              }
            />
          </span>
          <BusinessRecordLink
            label={row.planName}
            meta={row.planNo}
            title={`查看应急救援预案：${row.planName}`}
            interactive
            compact
            onClick={() => openDetail(row)}
          />
        </div>
      )
    },
    {
      prop: 'planVersion',
      label: '版本号',
      width: 100,
      formatter: (row) => row.planVersion || '—'
    },
    {
      prop: 'planCategory',
      label: '预案类别',
      width: 138,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisEmergencyPlanCategory"
          value={row.planCategory}
          display="tag"
        />
      )
    },
    {
      prop: 'applicableOrganizationName',
      label: '适用单位',
      minWidth: 170,
      showOverflowTooltip: true
    },
    {
      prop: 'planLevel',
      label: '预案级别',
      width: 106,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEmergencyPlanLevel" value={row.planLevel} display="tag" />
      )
    },
    {
      prop: 'applicablePositionName',
      label: '适用岗位',
      minWidth: 140,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.applicablePositions.length
          ? row.applicablePositions.map((item) => item.positionName).join('、')
          : '全部岗位'
    },
    {
      prop: 'frequency',
      label: '周期频次',
      width: 114,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEmergencyPlanFrequency" value={row.frequency} />
      )
    },
    {
      prop: 'nextReviewDate',
      label: '下次评审',
      width: 112,
      formatter: (row) => row.nextReviewDate || '—'
    },
    {
      prop: 'isSpecialEquipmentDrill',
      label: '特种设备演练',
      width: 118,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.isSpecialEquipmentDrill ? 'warning' : 'info'} effect="plain">
          {row.isSpecialEquipmentDrill ? '是' : '否'}
        </ElTag>
      )
    },
    {
      prop: 'warningStatus',
      label: '预警状态',
      width: 102,
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonWarningStatus" value={row.warningStatus} display="tag" />
      )
    },
    {
      prop: 'isValid',
      label: '是否有效',
      width: 98,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.isValid ? 'success' : 'info'} effect="light">
          {row.isValid ? '有效' : '已置废'}
        </ElTag>
      )
    },
    {
      prop: 'recordStatus',
      label: '记录状态',
      width: 98,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="commonDraftSubmittedStatus"
          value={row.recordStatus}
          display="tag"
        />
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
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
            permission="SmisEmergencyRescuePlan:View"
            label="查看应急预案"
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            type="edit"
            permission="SmisEmergencyRescuePlan:Edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonMore
            list={rowActions(row)}
            onClick={(item: ButtonMoreItem) => handleMoreAction(item, row)}
          />
        </div>
      )
    }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisEmergencyRescuePlan:Add',
      type: 'add',
      label: '新增应急预案',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisEmergencyRescuePlan:Activate',
      key: 'activate',
      label: '有效',
      icon: 'ri:checkbox-circle-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }) => {
        await setEmergencyRescuePlanValidity(
          selectedRows.map((row) => row.id as string),
          true
        )
        await api.refreshUpdate()
      }
    },
    {
      permission: 'SmisEmergencyRescuePlan:Void',
      key: 'void',
      label: '置废',
      icon: 'ri:forbid-2-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }) => {
        await setEmergencyRescuePlanValidity(
          selectedRows.map((row) => row.id as string),
          false
        )
        await api.refreshUpdate()
      }
    },
    {
      permission: 'SmisEmergencyRescuePlan:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条草稿预案吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.planName ?? '应急预案')
          })),
          permission: 'SmisEmergencyRescuePlan:Delete',
          remove: async () => {
            await deleteEmergencyRescuePlans(selectedRows.map((row) => row.id as string))
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
    const response = await fetchEmergencyRescuePlanList({ ...params, from, to })
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    organizations.value = response.organizations
    positions.value = response.positions
    return response
  }
  const handleValidity = async (ids: string[], isValid: boolean, name: string): Promise<void> => {
    try {
      await confirm(
        isValid
          ? `确定将预案“${name}”恢复为有效吗？`
          : `确定置废预案“${name}”吗？置废后下游业务将无法选择。`
      )
      await setEmergencyRescuePlanValidity(ids, isValid)
      await tableRef.value?.refreshUpdate()
    } catch {
      /* 用户取消 */
    }
  }
  const handlePush = async (row: SmisEmergencyRescuePlan): Promise<void> => {
    try {
      await confirm(`确定将预案“${row.planName}”下推为演练计划草稿吗？`)
      await pushEmergencyRescuePlan(row.id)
      await tableRef.value?.refreshUpdate()
    } catch {
      /* 用户取消或业务校验失败 */
    }
  }
  const handleDelete = async (row: SmisEmergencyRescuePlan): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.planName ?? '应急预案')
        }
      ],
      permission: 'SmisEmergencyRescuePlan:Delete',
      confirmMessage: `确定删除草稿预案“${row.planName}”吗？`,
      remove: async () => {
        await deleteEmergencyRescuePlans([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add' ? tableRef.value?.refreshCreate() : tableRef.value?.refreshUpdate())
  }
  onMounted(async () => {
    await Promise.all(
      [
        'commonBoolean',
        'smisEmergencyPlanCategory',
        'smisEmergencyPlanFrequency',
        'smisEmergencyPlanLevel',
        'commonWarningStatus',
        'commonDraftSubmittedStatus'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
  })
</script>

<style scoped lang="scss">
  .emergency-plan-page {
    min-width: 0;
  }

  .emergency-plan-page__table {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  :deep(.emergency-plan-page__identity) {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  :deep(.emergency-plan-page__identity > span:first-child) {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
    border-radius: var(--el-border-radius-base);
  }
</style>
