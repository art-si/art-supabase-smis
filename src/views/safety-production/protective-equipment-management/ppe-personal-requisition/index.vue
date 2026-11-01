<template>
  <ArtPermissionGuard permission="SmisPpePersonalRequisition:View">
    <div class="ppe-requisition-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="PERSONAL PROTECTIVE EQUIPMENT"
        title="防护用品个人领用"
        description="按个人发放标准生成待领用明细，下推仓库发放后由领用人确认；超时未操作时按租户规则自动确认。"
        icon="ri:user-received-2-line"
        :tags="[
          { label: '标准到期自动生成', type: 'primary', effect: 'plain' },
          { label: '同一领用人多选发放', type: 'success', effect: 'light' },
          { label: `超时 ${autoConfirmDays} 天自动确认`, type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions>
          <BusinessTableWorkspaceActions :table="tableQueryRef" />
        </template>
      </BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 76 }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无个人领用明细',
          emptyDescription: '先维护个人防护用品标准和领用计划，再生成到期领用单。'
        }"
        focusable
      />

      <RequisitionPushDialog ref="pushDialogRef" @success="refreshData" />
      <AutoConfirmSettingDialog ref="settingDialogRef" @success="autoConfirmDays = $event" />
      <IssuanceStatisticsDialog ref="statisticsDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { withSupabaseTableRange } from '@/utils/supabase/pagination'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { ElImage, ElTag } from 'element-plus'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import type { BusinessWorkspaceMetric } from '@/components/business/business-workspace-header/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import type { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import type { ColumnOption } from '@/types/component'
  import {
    confirmPpeRequisitionItems,
    fetchPpePersonalRequisitionList,
    fetchPpeScopeOptions,
    fetchPpeSetting,
    generateDuePpeRequisitions,
    type SmisPpePersonalRequisitionItem,
    type SmisPpePersonalRequisitionOverview,
    type SmisPpePersonalRequisitionSearchParams,
    type SmisPpeScopeOption
  } from '@smis/api'
  import IssuanceStatisticsDialog from '../ppe-issuance-record/modules/issuance-statistics-dialog.vue'
  import AutoConfirmSettingDialog from './modules/auto-confirm-setting-dialog.vue'
  import RequisitionPushDialog from './modules/requisition-push-dialog.vue'

  defineOptions({ name: 'SmisPpePersonalRequisition' })

  type TableParams = SmisPpePersonalRequisitionSearchParams & {
    current?: number
    size?: number
    page?: number
    pageSize?: number
  }

  interface PushDialogExpose {
    handleOpen: (rows: SmisPpePersonalRequisitionItem[]) => Promise<void>
  }

  interface SimpleDialogExpose {
    handleOpen: () => Promise<void>
  }

  const tableQueryRef = ref<ArtTableQueryExpose>()
  const { confirmAction, promptReason } = useArtFeedback()
  const pushDialogRef = ref<PushDialogExpose>()
  const settingDialogRef = ref<SimpleDialogExpose>()
  const statisticsDialogRef = ref<SimpleDialogExpose>()
  const userStore = useUserStore()
  const { getUserInfo } = storeToRefs(userStore)
  const searchQuery = ref<SmisPpePersonalRequisitionSearchParams>({})
  const organizationOptions = ref<SmisPpeScopeOption[]>([])
  const autoConfirmDays = ref(3)
  const overview = reactive<SmisPpePersonalRequisitionOverview>({
    total: 0,
    pending: 0,
    waitingConfirmation: 0,
    confirmed: 0,
    overdue: 0
  })

  const statusOptions = useDictionaryOptions('commonRequisitionStatus')
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '领用明细',
      value: overview.total,
      description: '当前查询范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '待发放',
      value: overview.pending,
      description: '可下推仓库发放',
      icon: 'ri:inbox-unarchive-line',
      tone: 'warning'
    },
    {
      label: '待本人确认',
      value: overview.waitingConfirmation,
      description: '已领料待签收',
      icon: 'ri:user-follow-line'
    },
    {
      label: '逾期待领',
      value: overview.overdue,
      description: '计划日期已到',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '领用时间',
      key: 'dateRange',
      type: 'daterange',
      props: { valueFormat: 'YYYY-MM-DD', startPlaceholder: '开始日期', endPlaceholder: '结束日期' }
    },
    {
      label: '组织名称',
      key: 'organizationId',
      type: 'treeSelect',
      props: {
        data: organizationOptions.value,
        clearable: true,
        checkStrictly: true,
        nodeKey: 'id',
        props: { label: 'name', value: 'id', children: 'children' },
        placeholder: '全部公司或部门'
      }
    },
    {
      label: '领用信息',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '领用单号、领用人或物料' }
    },
    {
      label: '领用状态',
      key: 'status',
      type: 'select',
      options: statusOptions,
      props: { clearable: true, placeholder: '全部状态' }
    }
  ])

  const refreshData = async (): Promise<void> => {
    await tableQueryRef.value?.getData()
  }

  const validateSameEmployee = (rows: SmisPpePersonalRequisitionItem[]): boolean => {
    const employees = new Set(rows.map((row) => row.employeeId))
    if (employees.size === 1) return true
    ElMessage.warning('请只选择同一领用人的多条领用明细')
    return false
  }

  const openPushDialog = (rows: SmisPpePersonalRequisitionItem[]): void => {
    if (!rows.length || !validateSameEmployee(rows)) return
    if (rows.some((row) => row.status !== 'pending_issue')) {
      ElMessage.warning('只能下推状态为“待发放”的领用明细')
      return
    }
    void pushDialogRef.value?.handleOpen(rows)
  }

  const confirmRows = async (
    rows: SmisPpePersonalRequisitionItem[],
    confirmed: boolean
  ): Promise<void> => {
    if (!rows.length || !validateSameEmployee(rows)) return
    if (rows.some((row) => row.status !== 'issued_pending_confirmation')) {
      ElMessage.warning('请选择已发放且待本人确认的领用明细')
      return
    }
    if (rows.some((row) => row.employeeId !== getUserInfo.value.hrEmployeeId)) {
      ElMessage.warning('领用确认仅限领用人本人操作')
      return
    }
    let reason: string | undefined
    if (!confirmed) {
      reason = await promptReason('请说明未实际领用、数量不符或物品不符等原因', '否认领用', {
        confirmButtonText: '提交否认',
        placeholder: '请输入否认原因'
      })
    } else {
      await confirmAction(`确认已领取选中的 ${rows.length} 项防护用品？`, {
        title: '领用确认',
        confirmButtonText: '确认已领用'
      })
    }
    await confirmPpeRequisitionItems(
      rows.map((row) => row.id),
      confirmed,
      reason
    )
    await refreshData()
  }

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisPpePersonalRequisition:Generate',
      key: 'generate',
      label: '生成到期领用单',
      icon: 'ri:calendar-todo-line',
      confirm: true,
      content: '按个人标准与领用计划生成截至今日已到期的待领用明细？',
      onClick: async () => {
        await generateDuePpeRequisitions(dayjs().format('YYYY-MM-DD'))
        await refreshData()
      }
    },
    {
      permission: 'SmisPpePersonalRequisition:Push',
      key: 'push',
      label: '下推发放',
      icon: 'ri:send-plane-line',
      selectionRequired: true,
      onClick: ({ selectedRows }) =>
        openPushDialog(selectedRows as SmisPpePersonalRequisitionItem[])
    },
    {
      permission: 'SmisPpePersonalRequisition:Confirm',
      key: 'confirm',
      label: '确认领用',
      icon: 'ri:checkbox-circle-line',
      selectionRequired: true,
      onClick: ({ selectedRows }) =>
        confirmRows(selectedRows as SmisPpePersonalRequisitionItem[], true)
    },
    {
      permission: 'SmisPpePersonalRequisition:Confirm',
      key: 'deny',
      label: '否认领用',
      icon: 'ri:close-circle-line',
      selectionRequired: true,
      onClick: ({ selectedRows }) =>
        confirmRows(selectedRows as SmisPpePersonalRequisitionItem[], false)
    },
    {
      permission: 'SmisPpePersonalRequisition:Export',
      type: 'export',
      label: '导出',
      exportFilename: '防护用品个人领用',
      exportSheetName: '个人领用',
      exportColumns: [
        { key: 'requisitionNo', title: '个人领用单号' },
        { key: 'reminder', title: '领用提醒' },
        { key: 'employeeNo', title: '领用人工号' },
        { key: 'employeeName', title: '领用人' },
        { key: 'positionName', title: '领用人岗位' },
        { key: 'operationDepartment', title: '作业部' },
        { key: 'operationArea', title: '作业区' },
        { key: 'team', title: '班组' },
        { key: 'materialCategory', title: '物料类别' },
        { key: 'materialName', title: '物料名称' },
        { key: 'specificationModel', title: '规格型号' },
        { key: 'quotaQuantity', title: '定额数量' },
        { key: 'requestedQuantity', title: '领用数量' },
        { key: 'unit', title: '计量单位' },
        { key: 'plannedIssueDate', title: '领用日期' },
        { key: 'organizationName', title: '所属部门' },
        { key: 'quotaCycleMonths', title: '定额期限/月' },
        { key: 'status', title: '领用确认' },
        { key: 'denialReason', title: '领用否认原因' },
        { key: 'remark', title: '备注' }
      ],
      exportApi: async ({ maxRows }) => ({
        data: (
          await fetchPpePersonalRequisitionList({
            ...searchQuery.value,
            purpose: 'export',
            from: 0,
            to: maxRows - 1
          })
        ).data
      })
    },
    {
      permission: 'SmisPpePersonalRequisition:Statistics',
      key: 'statistics',
      label: '统计分析',
      icon: 'ri:bar-chart-box-line',
      onClick: () => statisticsDialogRef.value?.handleOpen()
    },
    {
      permission: 'SmisPpePersonalRequisition:Configure',
      key: 'configure',
      label: '自动确认设置',
      icon: 'ri:settings-3-line',
      onClick: () => settingDialogRef.value?.handleOpen()
    }
  ])

  const columnsFactory = (): ColumnOption<SmisPpePersonalRequisitionItem>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'reminder',
      label: '领用提醒',
      width: 118,
      fixed: 'left',
      formatter: (row) => {
        const overdue =
          row.status === 'pending_issue' && dayjs(row.plannedIssueDate).isBefore(dayjs(), 'day')
        return (
          <ElTag
            type={overdue ? 'danger' : row.status === 'pending_issue' ? 'warning' : 'info'}
            effect="light"
          >
            {overdue ? '已逾期' : row.reminder || '正常'}
          </ElTag>
        )
      }
    },
    { prop: 'requisitionNo', label: '个人领用单号', width: 158, fixed: 'left' },
    { prop: 'employeeName', label: '领用人', width: 112, showOverflowTooltip: true },
    { prop: 'positionName', label: '领用人岗位', minWidth: 150, showOverflowTooltip: true },
    { prop: 'operationDepartment', label: '作业部', minWidth: 140, showOverflowTooltip: true },
    { prop: 'operationArea', label: '作业区', minWidth: 140, showOverflowTooltip: true },
    { prop: 'team', label: '班组', minWidth: 120, showOverflowTooltip: true },
    { prop: 'materialCategory', label: '物料类别', minWidth: 130, showOverflowTooltip: true },
    { prop: 'materialName', label: '物料名称', minWidth: 160, showOverflowTooltip: true },
    { prop: 'specificationModel', label: '规格型号', minWidth: 130, showOverflowTooltip: true },
    { prop: 'quotaQuantity', label: '定额数量', width: 100, align: 'right' },
    { prop: 'requestedQuantity', label: '领用数量', width: 100, align: 'right' },
    {
      prop: 'unit',
      label: '计量单位',
      width: 96,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisMaterialUnit" value={row.unit} display="text" />
      )
    },
    { prop: 'plannedIssueDate', label: '领用日期', width: 116, align: 'center' },
    { prop: 'organizationName', label: '所属部门', minWidth: 170, showOverflowTooltip: true },
    { prop: 'quotaCycleMonths', label: '定额期限/月', width: 116, align: 'right' },
    {
      prop: 'status',
      label: '领用确认',
      width: 126,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonRequisitionStatus" value={row.status} display="tag" />
      )
    },
    { prop: 'denialReason', label: '领用否认原因', minWidth: 180, showOverflowTooltip: true },
    {
      prop: 'imageUrls',
      label: '图片',
      width: 86,
      align: 'center',
      formatter: (row) =>
        row.imageUrls?.length ? (
          <ElImage
            src={row.imageUrls[0]}
            previewSrcList={row.imageUrls}
            previewTeleported
            fit="cover"
            style="width:40px;height:40px"
          />
        ) : (
          '暂无'
        )
    },
    { prop: 'remark', label: '备注', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 160,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            permission="SmisPpePersonalRequisition:Push"
            type="sign"
            icon="ri:send-plane-line"
            label="下推发放"
            disabled={row.status !== 'pending_issue'}
            onClick={() => openPushDialog([row])}
          />
          <ArtButtonMore
            list={[
              {
                key: 'confirm',
                label: '确认领用',
                icon: 'ri:checkbox-circle-line',
                auth: 'SmisPpePersonalRequisition:Confirm',
                disabled:
                  row.status !== 'issued_pending_confirmation' ||
                  row.employeeId !== getUserInfo.value.hrEmployeeId
              },
              {
                key: 'deny',
                label: '否认领用',
                icon: 'ri:close-circle-line',
                auth: 'SmisPpePersonalRequisition:Confirm',
                disabled:
                  row.status !== 'issued_pending_confirmation' ||
                  row.employeeId !== getUserInfo.value.hrEmployeeId
              }
            ]}
            onClick={(item: ButtonMoreItem) => {
              if (item.key === 'confirm') confirmRows([row], true)
              if (item.key === 'deny') confirmRows([row], false)
            }}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchPpePersonalRequisitionList(withSupabaseTableRange(params))
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }

  onMounted(async () => {
    const [organizations, setting] = await Promise.all([
      fetchPpeScopeOptions('organization'),
      fetchPpeSetting(),
      userStore.ensureDictLoaded('smisMaterialUnit'),
      userStore.ensureDictLoaded('commonRequisitionStatus')
    ])
    organizationOptions.value = organizations.data
    autoConfirmDays.value = setting.data?.autoConfirmDays ?? 3
  })
</script>

<style scoped lang="scss">
  .ppe-requisition-page {
    min-width: 0;

    :deep(.el-image) {
      border-radius: var(--el-border-radius-small);
    }
  }
</style>
