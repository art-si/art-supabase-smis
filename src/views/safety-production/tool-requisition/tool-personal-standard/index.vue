<template>
  <ArtPermissionGuard permission="SmisToolPersonalStandard:View">
    <div class="smis-personal-standard business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="EMPLOYEE TOOL ENTITLEMENT"
        title="工器具个人标准"
        description="从启用的发放标准按员工岗位和所属组织生成个人定额，清晰追溯每项物料的来源标准。"
        icon="ri:user-settings-line"
        :tags="[
          { label: '组织岗位联动', type: 'primary', effect: 'plain' },
          { label: '批量生成', type: 'success', effect: 'light' },
          { label: '来源可追溯', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="smis-personal-standard__workspace">
        <ArtWorkspaceSplitter
          primary-size="296px"
          primary-min="264px"
          primary-max="400px"
          :breakpoint="1200"
          narrow-mode="hide"
        >
          <template #primary>
            <aside
              v-if="isDesktopOrganizationLayout"
              class="smis-personal-standard__organization-panel"
            >
              <ToolOrganizationNavigator
                :data="organizations"
                :loading="organizationLoading"
                :error="organizationError"
                :selected-key="selectedOrganizationId"
                :employee-count="overview.employeeTotal"
                @select="selectOrganization"
                @refresh="loadOrganizations"
              />
            </aside>
          </template>

          <main class="smis-personal-standard__main">
            <section
              v-if="!isDesktopOrganizationLayout"
              class="smis-personal-standard__mobile-scope art-card-xs"
            >
              <span aria-hidden="true"><ArtSvgIcon icon="ri:node-tree" /></span>
              <div
                ><small>当前组织范围</small><strong>{{ selectedOrganizationLabel }}</strong></div
              >
              <ElButton type="primary" plain @click="openOrganizationDrawer">
                <ArtSvgIcon icon="ri:filter-3-line" />选择组织
              </ElButton>
            </section>

            <section class="smis-personal-standard__scope-bar" aria-live="polite">
              <div class="smis-personal-standard__scope-identity">
                <span aria-hidden="true"><ArtSvgIcon icon="ri:group-line" /></span>
                <span
                  ><small>当前员工范围</small><strong>{{ selectedOrganizationLabel }}</strong></span
                >
              </div>
              <div class="smis-personal-standard__scope-summary">
                <span>{{ overview.employeeTotal }} 名员工</span>
                <span>{{ overview.generatedTotal }} 名已生成</span>
                <span>{{ overview.itemTotal }} 项工器具明细</span>
              </div>
            </section>

            <ArtTableQuery
              ref="tableQueryRef"
              v-model="searchQuery"
              class="smis-personal-standard__table"
              :api-fn="fetchTableData"
              :search-items="searchItems"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :search-bar-props="{ span: 8, labelWidth: 72, showExpand: false }"
              :table-props="{
                rowKey: 'employeeId',
                tableLayout: 'fixed',
                emptyText: '当前范围暂无员工',
                emptyDescription: '请切换组织范围，或检查 HR 员工花名册与岗位配置。'
              }"
              focusable
              focus-scope-selector=".smis-personal-standard__workspace"
            />
          </main>
        </ArtWorkspaceSplitter>
      </div>

      <ArtDrawer
        ref="organizationDrawerRef"
        size="sm"
        :show-footer="false"
        content-height="calc(100vh - 126px)"
      >
        <ToolOrganizationNavigator
          class="smis-personal-standard__drawer-navigator"
          :data="organizations"
          :loading="organizationLoading"
          :error="organizationError"
          :selected-key="selectedOrganizationId"
          :employee-count="overview.employeeTotal"
          @select="selectOrganization"
          @refresh="loadOrganizations"
        />
      </ArtDrawer>
      <PersonalStandardDetailDrawer ref="detailDrawerRef" />
      <PersonalIssuePlanDialog ref="planDialogRef" @success="refreshPlanData" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toNameCodeOption } from '@/utils/form/option'

  import '../../../components/personal-standard-workspace.scss'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { useMediaQuery } from '@vueuse/core'
  import { ElAvatar, ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { useUserStore } from '@/store/modules/user'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import TreeUtils from '@/utils/tree'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import PersonalIssuePlanDialog from './modules/personal-issue-plan-dialog.vue'
  import PersonalStandardDetailDrawer from './modules/personal-standard-detail-drawer.vue'
  import ToolOrganizationNavigator from './modules/tool-organization-navigator.vue'
  import {
    fetchToolPersonalStandardList,
    fetchToolScopeOptions,
    generateToolPersonalStandards,
    type SmisToolPersonalStandard,
    type SmisToolPersonalStandardOverview,
    type SmisToolPersonalStandardSearchParams,
    type SmisToolScopeOption
  } from '@smis/api'

  const formatTableDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD',
    emptyText: '--',
    invalidText: '--'
  })
  const formatTableDateTime = createDateTimeFormatter({
    format: 'HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisToolPersonalStandard' })

  const ALL_KEY = 'all'
  type TableParams = SmisToolPersonalStandardSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>

  const userStore = useUserStore()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const isDesktopOrganizationLayout = useMediaQuery('(min-width: 1201px)')
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const organizationDrawerRef = ref<ArtDrawerExpose<Record<string, never>>>()
  const detailDrawerRef = ref<{ handleOpen: (row: SmisToolPersonalStandard) => Promise<void> }>()
  const planDialogRef = ref<{ handleOpen: (row: SmisToolPersonalStandard) => Promise<void> }>()
  const organizations = ref<SmisToolScopeOption[]>([])
  const organizationLoading = ref(false)
  const organizationError = ref<string | null>(null)
  const selectedOrganizationId = ref(ALL_KEY)
  const positionOptions = ref<SmisToolScopeOption[]>([])
  const searchQuery = ref<SmisToolPersonalStandardSearchParams>({ onlyMissing: false })
  const overview = reactive<SmisToolPersonalStandardOverview>({
    employeeTotal: 0,
    generatedTotal: 0,
    missingTotal: 0,
    itemTotal: 0
  })

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '范围内员工',
      value: overview.employeeTotal,
      description: '当前组织筛选结果',
      icon: 'ri:team-line'
    },
    {
      label: '已生成',
      value: overview.generatedTotal,
      description: '拥有工器具个人标准',
      icon: 'ri:user-follow-line',
      tone: 'success'
    },
    {
      label: '待生成',
      value: overview.missingTotal,
      description: '尚无个人标准',
      icon: 'ri:user-unfollow-line',
      tone: 'warning'
    },
    {
      label: '工器具明细',
      value: overview.itemTotal,
      description: '全部员工工器具项',
      icon: 'ri:archive-stack-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '员工信息',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名、工号或岗位' }
    },
    {
      label: '岗位',
      key: 'positionId',
      type: 'select',
      options: positionOptions.value.map(toNameCodeOption),
      props: { clearable: true, filterable: true, placeholder: '全部岗位' }
    },
    {
      label: '生成状态',
      key: 'onlyMissing',
      type: 'switch',
      props: { activeText: '仅待生成', inactiveText: '全部员工', inlinePrompt: false }
    }
  ])
  const flatOrganizations = computed(() => treeUtils.treeToList(organizations.value))
  const selectedOrganization = computed(() =>
    selectedOrganizationId.value === ALL_KEY
      ? null
      : flatOrganizations.value.find((item) => item.id === selectedOrganizationId.value)
  )
  const selectedOrganizationLabel = computed(() => selectedOrganization.value?.name || '全部员工')
  const descendantIds = computed(() => {
    if (selectedOrganizationId.value === ALL_KEY) return undefined
    const node = treeUtils.findNode(
      organizations.value,
      selectedOrganizationId.value
    ) as SmisToolScopeOption | null
    return node
      ? treeUtils.treeToList([node]).map((item) => String(item.id))
      : [selectedOrganizationId.value]
  })

  const selectOrganization = async (id: string): Promise<void> => {
    if (selectedOrganizationId.value !== id) {
      selectedOrganizationId.value = id
      await tableQueryRef.value?.getData()
    }
    if (!isDesktopOrganizationLayout.value) organizationDrawerRef.value?.handleClose()
  }
  const loadOrganizations = async (): Promise<void> => {
    organizationLoading.value = true
    organizationError.value = null
    try {
      const result = await fetchToolScopeOptions('organization')
      if (result.error) throw result.error
      organizations.value = result.data ?? []
      if (
        selectedOrganizationId.value !== ALL_KEY &&
        !treeUtils.findNode(organizations.value, selectedOrganizationId.value)
      )
        selectedOrganizationId.value = ALL_KEY
    } catch (error) {
      organizations.value = []
      organizationError.value = getFriendlySupabaseErrorMessage(
        error,
        '组织结构加载失败，请稍后重试'
      )
    } finally {
      organizationLoading.value = false
    }
  }
  const openOrganizationDrawer = (): void => {
    organizationDrawerRef.value?.handleOpen(
      {},
      {
        title: '选择组织范围',
        subtitle: '按组织结构筛选员工花名册',
        showFooter: false
      }
    )
  }
  const openDetails = (row: SmisToolPersonalStandard): void => {
    void detailDrawerRef.value?.handleOpen(row)
  }
  const generate = async (rows: SmisToolPersonalStandard[]): Promise<void> => {
    const result = await generateToolPersonalStandards(rows.map((row) => row.employeeId))
    if (result.data?.unmatchedCount)
      ElMessage.warning(`${result.data.unmatchedCount} 名员工未匹配到启用的发放标准`)
    await tableQueryRef.value?.getData()
  }
  const openPlan = (row: SmisToolPersonalStandard): void => {
    if (!row.personalStandardId) {
      ElMessage.warning('请先为该员工生成工器具个人标准')
      return
    }
    void planDialogRef.value?.handleOpen(row)
  }
  const refreshPlanData = async (): Promise<void> => {
    await tableQueryRef.value?.getData()
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisToolPersonalStandard:Generate',
      label: '生成个人标准',
      icon: 'ri:magic-line',
      type: 'add',
      selectionRequired: true,
      onClick: ({ selectedRows }) => generate(selectedRows as SmisToolPersonalStandard[])
    },
    {
      permission: 'SmisToolPersonalStandard:Schedule',
      key: 'schedule',
      label: '设置领用计划',
      icon: 'ri:calendar-schedule-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) =>
        selectedRows.length !== 1 ||
        !(selectedRows[0] as SmisToolPersonalStandard).personalStandardId,
      onClick: ({ selectedRows }) => openPlan(selectedRows[0] as SmisToolPersonalStandard)
    },
    {
      permission: 'SmisToolPersonalStandard:Export',
      type: 'export',
      label: '导出',
      exportFilename: '工器具个人标准',
      exportSheetName: '个人标准',
      exportColumns: [
        { key: 'employeeNo', title: '员工工号' },
        { key: 'employeeName', title: '员工姓名' },
        { key: 'organizationName', title: '所属部门' },
        { key: 'positionName', title: '岗位' },
        { key: 'itemCount', title: '工器具项数' },
        { key: 'generatedAt', title: '生成时间' }
      ],
      exportApi: async ({ maxRows }) => {
        const result = await fetchToolPersonalStandardList({
          ...searchQuery.value,
          organizationIds: descendantIds.value,
          purpose: 'export',
          from: 0,
          to: maxRows - 1
        })
        return { data: result.data }
      }
    }
  ])
  const columnsFactory = (): ColumnOption<SmisToolPersonalStandard>[] => [
    { type: 'selection', width: 48, reserveSelection: true },
    {
      prop: 'employeeName',
      label: '员工身份',
      minWidth: 220,
      fixed: 'left',
      formatter: (row) => (
        <button
          class="smis-personal-standard__employee"
          type="button"
          title={`查看 ${row.employeeName} 的工器具个人标准明细`}
          onClick={() => openDetails(row)}
        >
          <ElAvatar size={38} src={row.avatarUrl || undefined} alt={`${row.employeeName}的头像`}>
            {row.employeeName.trim().slice(0, 1) || '员'}
          </ElAvatar>
          <span>
            <strong>{row.employeeName}</strong>
            <small translate="no">{row.employeeNo}</small>
          </span>
        </button>
      )
    },
    {
      prop: 'organizationName',
      label: '组织与岗位',
      minWidth: 240,
      formatter: (row) => (
        <div class="smis-personal-standard__assignment">
          <strong title={row.organizationName || undefined}>
            {row.organizationName || '未分配组织'}
          </strong>
          <small title={row.positionName || undefined}>{row.positionName || '未配置岗位'}</small>
        </div>
      )
    },
    {
      prop: 'personalStandardId',
      label: '个人标准',
      minWidth: 176,
      formatter: (row) => (
        <div class="smis-personal-standard__standard-status">
          <ElTag type={row.personalStandardId ? 'success' : 'warning'} effect="light">
            {row.personalStandardId ? '已生成' : '待生成'}
          </ElTag>
          <small>{row.itemCount ? `${row.itemCount} 项工器具定额` : '尚无工器具明细'}</small>
        </div>
      )
    },
    {
      prop: 'generatedAt',
      label: '最近生成',
      width: 172,
      formatter: (row) =>
        row.generatedAt ? (
          <div class="smis-personal-standard__generated-time">
            <strong>{formatTableDate(row.generatedAt)}</strong>
            <small>{formatTableDateTime(row.generatedAt)}</small>
          </div>
        ) : (
          <span class="smis-personal-standard__muted">尚未生成</span>
        )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 160,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="view"
            icon="ri:file-list-3-line"
            label="查看明细"
            onClick={() => openDetails(row)}
          />
          <ArtButtonTable
            permission="SmisToolPersonalStandard:Generate"
            type="add"
            icon="ri:magic-line"
            label={row.personalStandardId ? '重新生成' : '生成个人标准'}
            onClick={() => generate([row])}
          />
          <ArtButtonTable
            permission="SmisToolPersonalStandard:Schedule"
            type="edit"
            icon="ri:calendar-schedule-line"
            label="设置领用计划"
            disabled={!row.personalStandardId}
            onClick={() => openPlan(row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchToolPersonalStandardList({
      ...buildSupabasePageRange(params),
      ...params,
      organizationIds: descendantIds.value
    })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }

  onMounted(async () => {
    await Promise.all([
      loadOrganizations(),
      fetchToolScopeOptions('position').then((result) => {
        positionOptions.value = result.data ?? []
      }),
      ...['commonIssuanceCycle', 'commonEnabledStatus', 'smisMaterialUnit'].map((code) =>
        userStore.ensureDictLoaded(code)
      )
    ])
  })
</script>
