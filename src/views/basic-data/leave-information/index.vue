<template>
  <ArtPermissionGuard permission="SmisLeaveInformation:View">
    <div class="leave-information-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="leave-information-page__overview"
        eyebrow="LEAVE INFORMATION"
        title="请假信息维护"
        description="按组织统一维护员工请假、代理安排和身份审计快照，人员信息与 HR 员工花名册保持联动。"
        icon="ri:calendar-event-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="leave-information-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="288px"
          primary-min="244px"
          primary-max="380px"
          :breakpoint="820"
          stacked-primary-size="320px"
        >
          <template #primary>
            <aside class="leave-information-page__tree-panel">
              <OrganizationNavigator
                :data="organizationState.tree"
                :loading="organizationState.loading"
                :error="organizationState.error"
                :selected-key="organizationState.selectedKey"
                @select="handleOrganizationSelect"
                @refresh="loadOrganizations"
              />
            </aside>
          </template>

          <main class="leave-information-page__main">
            <ArtTableQuery
              ref="tableQueryRef"
              v-model="tableState.searchQuery"
              class="leave-information-page__table"
              :search-items="searchItems"
              :api-fn="fetchTableData"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyText: '暂无请假信息',
                emptyDescription: '可新增请假信息，申请人与代理人均从员工花名册选择。',
                showOverflowTooltip: true
              }"
              :on-success="handleTableSuccess"
              focusable
              focus-scope-selector=".leave-information-page__workspace"
            />
          </main>
        </ArtWorkspaceSplitter>
      </div>

      <LeaveInformationDialog ref="dialogRef" @success="handleSaveSuccess" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import dayjs from 'dayjs'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { storeToRefs } from 'pinia'
  import { ElTag } from 'element-plus'
  import ArtTooltip from '@/components/core/feedback/art-tooltip/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { useUserStore } from '@/store/modules/user'
  import { fetchOrganizationOptionsTree } from '@/api/system-manage'
  import { exportExcel } from '@/utils/file'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import TreeUtils from '@/utils/tree'
  import {
    deleteLeaveInformation,
    fetchLeaveInformationList,
    fetchLeaveInformationOverview,
    type LeaveInformation,
    type LeaveInformationOverview,
    type LeaveInformationSearchParams
  } from '@smis/api'
  import OrganizationNavigator from './modules/organization-navigator.vue'
  import LeaveInformationDialog, {
    type LeaveInformationDialogOpenData
  } from './modules/leave-information-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('hr_leave_request', '请假信息')

  defineOptions({ name: 'SmisLeaveInformation' })

  type Organization = Api.SystemManage.OrganizationListItem
  interface SearchModel {
    companyKeyword: string
    applicantKeyword: string
    leaveDates: string[]
  }
  type TableParams = SearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: LeaveInformationDialogOpenData) => Promise<void>
  }

  const ALL_KEY = 'all'

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const organizationTreeUtils = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const organizationState = reactive({
    tree: [] as Organization[],
    loading: false,
    error: null as string | null,
    selectedKey: ALL_KEY
  })
  const tableState = reactive({
    searchQuery: {
      companyKeyword: '',
      applicantKeyword: '',
      leaveDates: []
    } as SearchModel,
    total: 0,
    rows: [] as LeaveInformation[]
  })
  const overview = reactive<LeaveInformationOverview>({
    total: 0,
    currentMonth: 0,
    proxyCount: 0,
    organizationCount: 0,
    latestUpdateTime: null
  })

  const selectedOrganization = computed(() =>
    organizationState.selectedKey === ALL_KEY
      ? undefined
      : organizationTreeUtils.findNode(organizationState.tree, organizationState.selectedKey)
  )
  const selectedOrganizationLabel = computed(
    () => selectedOrganization.value?.organizationName || '全部组织'
  )
  const selectedOrganizationIcon = computed(() =>
    selectedOrganization.value?.organizationType === 'company'
      ? 'ri:building-4-line'
      : selectedOrganization.value
        ? 'ri:team-line'
        : 'ri:organization-chart'
  )
  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '组织树导航', type: 'primary', effect: 'plain' },
    { label: '员工花名册联动', type: 'success', effect: 'light' },
    { label: '身份快照留痕', type: 'info', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前范围',
      value: selectedOrganizationLabel.value,
      description: selectedOrganization.value?.organizationCode || '全部组织部门',
      icon: selectedOrganizationIcon.value
    },
    {
      label: '请假记录',
      value: overview.total,
      description: '当前租户累计维护记录',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '本月涉及',
      value: overview.currentMonth,
      description: '请假区间与本月有交集',
      icon: 'ri:calendar-check-line'
    },
    {
      label: '代理安排',
      value: overview.proxyCount,
      description: `${overview.organizationCount} 个组织已有记录`,
      icon: 'ri:user-shared-line'
    }
  ])

  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '公司/组织',
      key: 'companyKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '搜索公司或组织名称' }
    },
    {
      label: '申请人',
      key: 'applicantKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '搜索姓名或员工工号' }
    },
    {
      label: '请假时间',
      key: 'leaveDates',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        unlinkPanels: true,
        clearable: true,
        class: '!w-full'
      }
    }
  ])

  const formatDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const getLeaveTypeLabel = (row: LeaveInformation): string =>
    row.leaveTypeName || row.leaveTypeCode || '—'

  const columnsFactory = (): ColumnOption<LeaveInformation>[] => [
    { type: 'selection', width: 48 },
    { prop: 'requestNo', label: '申请单号', width: 188, showOverflowTooltip: true },
    {
      prop: 'applicant',
      label: '申请人',
      minWidth: 168,
      formatter: (row) => (
        <div class="leave-information-page__identity">
          <span aria-hidden="true">
            <ArtSvgIcon icon="ri:user-3-line" />
          </span>
          <span>
            <strong title={row.applicant.employeeName}>{row.applicant.employeeName}</strong>
            <small title={row.applicant.employeeNo}>{row.applicant.employeeNo}</small>
          </span>
        </div>
      )
    },
    {
      prop: 'organization',
      label: '组织名称',
      minWidth: 190,
      formatter: (row) => (
        <div class="leave-information-page__organization">
          <strong>{row.organization?.organizationName || '未分配组织'}</strong>
          <small>{row.organization?.organizationCode || '—'}</small>
        </div>
      )
    },
    {
      prop: 'leaveTypeCode',
      label: '请假类型',
      width: 112,
      formatter: (row) =>
        getDictMap.value.smisLeaveType?.some((item) => item.value === row.leaveTypeCode) ? (
          <ArtDictDisplay dictCode="smisLeaveType" value={row.leaveTypeCode} display="tag" />
        ) : (
          <ElTag type="info" effect="plain">
            {getLeaveTypeLabel(row)}
          </ElTag>
        )
    },
    {
      prop: 'startDate',
      label: '请假时间',
      minWidth: 210,
      formatter: (row) => (
        <div class="leave-information-page__period">
          <strong>
            {row.startDate} 至 {row.endDate}
          </strong>
          <small>{Number(row.requestedAmount || 0)} 天</small>
        </div>
      )
    },
    {
      prop: 'isProxy',
      label: '代理安排',
      minWidth: 148,
      formatter: (row) =>
        row.isProxy ? (
          <div class="leave-information-page__proxy">
            <ElTag type="success" effect="light" size="small">
              已安排
            </ElTag>
            <span>{row.proxyEmployee?.employeeName || '代理人待确认'}</span>
          </div>
        ) : (
          <span class="leave-information-page__muted">无需代理</span>
        )
    },
    {
      prop: 'reason',
      label: '请假事由',
      minWidth: 220,
      showOverflowTooltip: true
    },
    {
      prop: 'status',
      label: '状态',
      width: 96,
      formatter: (row) => (
        <ArtDictDisplay dictCode="hrLeaveRequestStatus" value={row.status} display="tag" />
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 150,
      formatter: (row) => formatDateTime(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 106,
      fixed: 'right',
      formatter: (row) => (
        <>
          {row.status === 'draft' ? (
            <>
              <ArtButtonTable
                type="edit"
                permission="SmisLeaveInformation:Edit"
                onClick={() => openDialog(row)}
              />
              <ArtButtonTable
                type="delete"
                permission="SmisLeaveInformation:Delete"
                onClick={() => handleDeleteRows([row])}
              />
            </>
          ) : (
            <ArtTooltip content="已进入 HR 假勤流程，仅支持查看">
              <span class="leave-information-page__locked" aria-label="已锁定">
                <ArtSvgIcon icon="ri:lock-line" />
              </span>
            </ArtTooltip>
          )}
        </>
      )
    }
  ]

  const exportCurrentResults = async (): Promise<void> => {
    const rows = await loadAllDocumentPages<LeaveInformation, LeaveInformationSearchParams>(
      fetchLeaveInformationList,
      buildSearchParams({})
    )
    await exportExcel({
      filename: `请假信息_${dayjs().format('YYYYMMDD_HHmm')}`,
      sheetName: '请假信息',
      columns: [
        { key: 'requestNo', title: '申请单号', width: 22 },
        { key: 'applicantName', title: '申请人', width: 14 },
        { key: 'employeeNo', title: '员工工号', width: 16 },
        { key: 'organizationName', title: '组织名称', width: 22 },
        { key: 'leaveType', title: '请假类型', width: 12 },
        { key: 'startDate', title: '开始日期', width: 14 },
        { key: 'endDate', title: '结束日期', width: 14 },
        { key: 'requestedAmount', title: '请假天数', width: 12 },
        { key: 'isProxy', title: '是否代理', width: 12 },
        { key: 'proxyName', title: '代理人', width: 14 },
        { key: 'reason', title: '请假事由', width: 34 },
        { key: 'status', title: '状态', width: 12 }
      ],
      data: rows.map((row) => ({
        requestNo: row.requestNo || '',
        applicantName: row.applicant.employeeName,
        employeeNo: row.applicant.employeeNo,
        organizationName: row.organization?.organizationName || '',
        leaveType:
          userStore.getDictItemByValue('smisLeaveType', row.leaveTypeCode)?.label ||
          row.leaveTypeCode ||
          getLeaveTypeLabel(row),
        startDate: row.startDate,
        endDate: row.endDate,
        requestedAmount: row.requestedAmount || 0,
        isProxy: row.isProxy ? '是' : '否',
        proxyName: row.proxyEmployee?.employeeName || '',
        reason: row.reason,
        status:
          userStore.getDictItemByValue('hrLeaveRequestStatus', row.status)?.label || row.status
      }))
    })
  }

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'add',
      label: '新增请假信息',
      permission: 'SmisLeaveInformation:Add',
      onClick: () => openDialog()
    },
    {
      type: 'delete',
      confirm: false,
      label: '删除',
      permission: 'SmisLeaveInformation:Delete',
      disabled: (context) =>
        !(context.selectedRows as LeaveInformation[]).some((row) => row.status === 'draft'),
      content: (context: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${context.selectedCount} 条草稿请假信息吗？`,
      onClick: async ({ selectedRows, api }) => {
        const rows = (selectedRows as LeaveInformation[]).filter((row) => row.status === 'draft')
        const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id))
        if (!ids.length) return
        await deleteRecords({
          resources: rows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.requestNo ?? '请假信息')
          })),
          permission: 'SmisLeaveInformation:Delete',
          remove: async () => {
            await deleteLeaveInformation(ids)
          },
          onDeleted: async () => {
            await api.refreshRemove()
            await refreshOverview()
          }
        })
      }
    },
    {
      key: 'export',
      type: 'export',
      label: '导出',
      permission: 'SmisLeaveInformation:Export',
      onClick: exportCurrentResults
    }
  ])

  const buildSearchParams = (
    pagination: Pick<LeaveInformationSearchParams, 'from' | 'to'>
  ): LeaveInformationSearchParams => ({
    ...pagination,
    organizationId: selectedOrganization.value?.id,
    companyKeyword: tableState.searchQuery.companyKeyword,
    applicantKeyword: tableState.searchQuery.applicantKeyword,
    startDate: tableState.searchQuery.leaveDates?.[0],
    endDate: tableState.searchQuery.leaveDates?.[1]
  })
  const fetchTableData = (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return fetchLeaveInformationList(buildSearchParams({ from, to }))
  }
  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    tableState.rows = rows as LeaveInformation[]
    tableState.total = response.total ?? 0
  }
  const refreshOverview = async (): Promise<void> => {
    const response = await fetchLeaveInformationOverview()
    if (response.data) Object.assign(overview, response.data)
  }
  const loadOrganizations = async (): Promise<void> => {
    organizationState.loading = true
    organizationState.error = null
    try {
      const response = await fetchOrganizationOptionsTree({ status: '1' })
      organizationState.tree = response.data ?? []
      if (
        organizationState.selectedKey !== ALL_KEY &&
        !organizationTreeUtils.findNode(organizationState.tree, organizationState.selectedKey)
      ) {
        organizationState.selectedKey = ALL_KEY
      }
    } catch (error) {
      organizationState.error = getFriendlySupabaseErrorMessage(
        error,
        '组织结构加载失败，请稍后重试'
      )
    } finally {
      organizationState.loading = false
    }
  }
  const handleOrganizationSelect = async (key: string): Promise<void> => {
    if (organizationState.selectedKey === key) return
    organizationState.selectedKey = key
    tableState.total = 0
    await tableQueryRef.value?.getData()
  }
  const openDialog = (row?: LeaveInformation): void => {
    void dialogRef.value?.handleOpen({ organizations: organizationState.tree, row })
  }
  const isOrganizationInCurrentScope = (organizationId: string): boolean => {
    if (organizationState.selectedKey === ALL_KEY) return true
    return organizationTreeUtils
      .getDescendants(organizationState.tree, organizationState.selectedKey, true)
      .some((organization) => organization.id === organizationId)
  }
  const handleSaveSuccess = async (type: 'add' | 'edit', organizationId: string): Promise<void> => {
    if (!isOrganizationInCurrentScope(organizationId)) {
      organizationState.selectedKey = organizationTreeUtils.findNode(
        organizationState.tree,
        organizationId
      )
        ? organizationId
        : ALL_KEY
    }
    await (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
    await refreshOverview()
  }
  const handleDeleteRows = async (rows: LeaveInformation[]): Promise<void> => {
    const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id))
    if (!ids.length) return

    await deleteRecords({
      resources: rows.map((row) => ({
        id: String(row.id ?? ''),
        label: String(row.requestNo ?? '请假信息')
      })),
      permission: 'SmisLeaveInformation:Delete',
      confirmMessage: '确定删除这条草稿请假信息吗？删除后无法恢复。',
      remove: async () => {
        await deleteLeaveInformation(ids)
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
        await refreshOverview()
      }
    })
  }

  onMounted(async () => {
    await Promise.all([
      loadOrganizations(),
      refreshOverview(),
      userStore.ensureDictLoaded('smisLeaveType'),
      userStore.ensureDictLoaded('commonBoolean'),
      userStore.ensureDictLoaded('hrLeaveRequestStatus')
    ])
  })
</script>

<style scoped lang="scss">
  .leave-information-page {
    min-width: 0;

    &__overview {
      min-width: 0;
      overflow: hidden;
    }

    &__workspace {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
    }

    &__tree-panel,
    &__main,
    &__table {
      min-width: 0;
      min-height: 0;
    }

    &__tree-panel {
      overflow: hidden;
    }

    &__main {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    &__table {
      flex: 1 1 auto;
    }

    :deep(.leave-information-page__identity) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;
    }

    :deep(.leave-information-page__identity > span:first-child) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);
    }

    :deep(.leave-information-page__identity > span:last-child),
    :deep(.leave-information-page__organization),
    :deep(.leave-information-page__period) {
      display: grid;
      align-content: center;
      min-width: 0;
    }

    :deep(.leave-information-page__identity strong),
    :deep(.leave-information-page__identity small),
    :deep(.leave-information-page__organization strong),
    :deep(.leave-information-page__organization small),
    :deep(.leave-information-page__period strong),
    :deep(.leave-information-page__period small) {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.leave-information-page__identity strong),
    :deep(.leave-information-page__organization strong),
    :deep(.leave-information-page__period strong) {
      line-height: 20px;
    }

    :deep(.leave-information-page__identity small),
    :deep(.leave-information-page__organization small),
    :deep(.leave-information-page__period small) {
      margin-top: 2px;
      font-size: 11px;
      line-height: 16px;
      color: var(--el-text-color-secondary);
    }

    :deep(.leave-information-page__proxy) {
      display: flex;
      gap: 7px;
      align-items: center;
      min-width: 0;
    }

    :deep(.leave-information-page__proxy span:last-child) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.leave-information-page__muted),
    :deep(.leave-information-page__locked) {
      color: var(--el-text-color-secondary);
    }

    :deep(.leave-information-page__locked) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
    }

    @media (width <= 820px) {
      &__main {
        flex: 0 0 760px;
      }
    }
  }
</style>
