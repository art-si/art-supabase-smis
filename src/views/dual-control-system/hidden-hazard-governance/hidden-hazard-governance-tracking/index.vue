<template>
  <ArtPermissionGuard
    permission="SmisDualControlHiddenHazardGovernanceTracking:View"
    resource-name="隐患治理跟踪"
  >
    <div class="hazard-governance-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="HAZARD GOVERNANCE TRACKING"
        title="隐患治理跟踪"
        description="集中跟踪隐患核准、整改和验收闭环，自动归集排查异常并保留全过程证据。"
        icon="ri:shield-check-line"
        density="compact"
        :tags="[
          { label: '异常自动归集', type: 'danger', effect: 'plain' },
          { label: '状态闭环', type: 'success', effect: 'light' },
          { label: '证据留痕', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <HazardAiTrendPanel />

      <div class="hazard-governance-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="270px"
          primary-min="230px"
          primary-max="360px"
          :breakpoint="860"
          stacked-primary-size="260px"
        >
          <template #primary>
            <ArtSectionCard
              :show-scrollbar="false"
              class="hazard-governance-page__navigator-card"
              title="排查类型导航"
              subtitle="按隐患来源排查类型聚焦"
              :loading="optionsState.loading"
              :error="optionsState.error"
              :empty="!optionsState.loading && !optionsState.inspectionTypes.length"
              empty-title="暂无排查类型"
              empty-description="登记类隐患仍可在全部类型中查看。"
              @retry="loadOptions"
            >
              <template #actions>
                <ArtIconButton
                  icon="ri:refresh-line"
                  label="刷新排查类型"
                  :loading="optionsState.loading"
                  @click="loadOptions"
                />
              </template>
              <ElScrollbar class="hazard-governance-page__navigator-scrollbar">
                <nav class="hazard-governance-page__navigator" aria-label="排查类型">
                  <button
                    type="button"
                    :class="{ 'is-active': !searchQuery.inspectionTypeId }"
                    @click="selectType()"
                  >
                    <span class="hazard-governance-page__type-mark"
                      ><ArtSvgIcon icon="ri:apps-2-line"
                    /></span>
                    <span><strong>全部类型</strong><small>含登记及各来源隐患</small></span>
                  </button>
                  <button
                    v-for="item in optionsState.inspectionTypes"
                    :key="item.id"
                    type="button"
                    :class="{ 'is-active': searchQuery.inspectionTypeId === item.id }"
                    @click="selectType(item.id)"
                  >
                    <span
                      class="hazard-governance-page__type-mark"
                      :style="{ color: item.textColor || 'var(--theme-color)' }"
                    >
                      <ArtSvgIcon icon="ri:radar-line" />
                    </span>
                    <span
                      ><strong>{{ item.typeName }}</strong
                      ><small>{{ item.typeCode }}</small></span
                    >
                  </button>
                </nav>
              </ElScrollbar>
            </ArtSectionCard>
          </template>

          <main class="hazard-governance-page__main">
            <div class="hazard-governance-page__scope">
              <span><ArtSvgIcon icon="ri:focus-3-line" /></span>
              <div
                ><small>当前治理范围</small
                ><strong>{{ selectedType?.typeName || '全部隐患' }}</strong></div
              >
              <p>{{
                selectedType ? `类型编号 ${selectedType.typeCode}` : '展示登记与业务自动归集隐患'
              }}</p>
            </div>
            <ArtTableQuery
              ref="tableQueryRef"
              class="hazard-governance-page__table"
              v-model="searchQuery"
              :api-fn="fetchTableData"
              :search-items="searchItems"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :search-bar-props="{ span: 8, labelWidth: 84, showExpand: true }"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyText: '暂无隐患治理记录',
                emptyDescription: '可登记隐患，排查任务中的异常项也会自动进入这里。'
              }"
              focusable
              focus-scope-selector=".hazard-governance-page__workspace"
            />
          </main>
        </ArtWorkspaceSplitter>
      </div>

      <HazardRegistrationDialog ref="registrationRef" @success="handleCreated" />
      <HazardWorkflowDialog ref="workflowRef" @success="handleUpdated" />
      <HazardDetailDrawer ref="detailRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchHiddenHazardGovernanceList,
    fetchHiddenHazardPlanOptions,
    fetchSiteList,
    type SmisHiddenHazardGovernanceOverview,
    type SmisHiddenHazardGovernanceRecord,
    type SmisHiddenHazardGovernanceSearchParams,
    type SmisHiddenHazardPlanOptions,
    type SmisSite
  } from '@smis/api'
  import HazardDetailDrawer, {
    type HazardDetailDrawerOpenData
  } from './modules/hazard-detail-drawer.vue'
  import HazardRegistrationDialog from './modules/hazard-registration-dialog.vue'
  import HazardWorkflowDialog, {
    type HazardWorkflowDialogOpenData,
    type HazardWorkflowMode
  } from './modules/hazard-workflow-dialog.vue'
  import HazardAiTrendPanel from './modules/hazard-ai-trend-panel.vue'

  defineOptions({ name: 'SmisDualControlHiddenHazardGovernanceTracking' })

  interface GovernanceQuery extends SmisHiddenHazardGovernanceSearchParams {
    reportedRange?: [string, string]
  }
  type TableParams = GovernanceQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface RegistrationExpose {
    handleOpen: (data: { sites: SmisSite[] }) => Promise<void>
  }
  interface WorkflowExpose {
    handleOpen: (data: HazardWorkflowDialogOpenData) => Promise<void>
  }
  interface DetailExpose {
    handleOpen: (data: HazardDetailDrawerOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const registrationRef = ref<RegistrationExpose>()
  const workflowRef = ref<WorkflowExpose>()
  const detailRef = ref<DetailExpose>()
  const searchQuery = ref<GovernanceQuery>({})
  const siteTree = ref<SmisSite[]>([])
  const optionsState = reactive<{
    inspectionTypes: SmisHiddenHazardPlanOptions['inspectionTypes']
    loading: boolean
    error: string
  }>({ inspectionTypes: [], loading: false, error: '' })
  const overview = reactive<SmisHiddenHazardGovernanceOverview>({
    total: 0,
    pendingApproval: 0,
    rectifying: 0,
    pendingAcceptance: 0,
    completed: 0,
    closed: 0
  })

  const selectedType = computed(() =>
    optionsState.inspectionTypes.find((item) => item.id === searchQuery.value.inspectionTypeId)
  )
  const statusOptions = computed(() =>
    (getDictMap.value.smisHiddenHazardGovernanceStatus ?? []).map(toDictionaryOption)
  )
  const sourceLabels = computed(() =>
    Object.fromEntries(
      (getDictMap.value.smisHiddenHazardSourceType ?? []).map((item) => [
        item.value,
        item.label || item.name
      ])
    )
  )
  const hazardLevelLabels = computed(() =>
    Object.fromEntries(
      (getDictMap.value.smisHazardLevel ?? []).map((item) => [item.value, item.label || item.name])
    )
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '隐患总数',
      value: overview.total,
      description: '当前查询口径',
      icon: 'ri:alert-line'
    },
    {
      label: '待核准',
      value: overview.pendingApproval,
      description: '等待确认处置方案',
      icon: 'ri:file-search-line',
      tone: 'warning'
    },
    {
      label: '整改中',
      value: overview.rectifying,
      description: '责任人处理中',
      icon: 'ri:tools-line',
      tone: 'danger'
    },
    {
      label: '待验收',
      value: overview.pendingAcceptance,
      description: '等待闭环确认',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '隐患编号',
      key: 'hazardNo',
      type: 'input',
      props: { clearable: true, placeholder: '输入隐患编号' }
    },
    {
      label: '上报时间',
      key: 'reportedRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期'
      }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
    },
    {
      label: '整改人',
      key: 'rectifierKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名或工号' }
    },
    {
      label: '上报人',
      key: 'reporterKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名或工号' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'hazardNo', title: '所属隐患编号' },
    { key: 'status', title: '隐患状态' },
    { key: 'description', title: '隐患描述' },
    { key: 'location', title: '隐患位置' },
    { key: 'hazardLevel', title: '隐患级别' },
    { key: 'reporterEmployeeName', title: '上报人' },
    { key: 'reportedAt', title: '上报时间' },
    { key: 'rectificationDeadline', title: '整改时限' },
    { key: 'rectificationMeasures', title: '整改措施' },
    { key: 'rectificationResponsibleEmployeeName', title: '整改责任人' },
    { key: 'rectificationCompletedAt', title: '整改完成时间' },
    { key: 'acceptorEmployeeName', title: '验收人' },
    { key: 'acceptedAt', title: '验收时间' },
    { key: 'sourceType', title: '隐患来源' }
  ]

  const formatDateTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })
  const openDetail = (row: SmisHiddenHazardGovernanceRecord): void => {
    void detailRef.value?.handleOpen({ row })
  }
  const openWorkflow = (mode: HazardWorkflowMode, row: SmisHiddenHazardGovernanceRecord): void => {
    void workflowRef.value?.handleOpen({ mode, row })
  }
  const operationFor = (row: SmisHiddenHazardGovernanceRecord) => {
    if (row.status === 'pending_approval')
      return {
        permission: 'SmisDualControlHiddenHazardGovernanceTracking:Approve',
        mode: 'approve' as const,
        label: '核准',
        icon: 'ri:file-check-line'
      }
    if (row.status === 'rectifying')
      return {
        permission: 'SmisDualControlHiddenHazardGovernanceTracking:Rectify',
        mode: 'rectify' as const,
        label: '整改',
        icon: 'ri:tools-line'
      }
    if (row.status === 'pending_acceptance')
      return {
        permission: 'SmisDualControlHiddenHazardGovernanceTracking:Accept',
        mode: 'accept' as const,
        label: '验收',
        icon: 'ri:checkbox-circle-line'
      }
    return null
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlHiddenHazardGovernanceTracking:Register',
      type: 'add',
      label: '隐患登记',
      onClick: () => void registrationRef.value?.handleOpen({ sites: siteTree.value })
    },
    {
      permission: 'SmisDualControlHiddenHazardGovernanceTracking:Export',
      type: 'export',
      exportFilename: '隐患治理跟踪',
      exportSheetName: '隐患治理跟踪',
      exportColumns: excelColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const query = searchParams as GovernanceQuery
        const selected = new Set(selectedIds.map(String))
        const exportQuery: SmisHiddenHazardGovernanceSearchParams = {
          ...query,
          ids: undefined,
          reportedFrom: query.reportedRange?.[0],
          reportedTo: query.reportedRange?.[1] ? `${query.reportedRange[1]}T23:59:59` : undefined
        }
        const rows = await loadAllDocumentPages(fetchHiddenHazardGovernanceList, exportQuery)
        await Promise.all([
          userStore.ensureDictLoaded('smisHiddenHazardGovernanceStatus'),
          userStore.ensureDictLoaded('smisHiddenHazardSourceType'),
          userStore.ensureDictLoaded('smisHazardLevel')
        ])
        return {
          data: rows
            .filter((row) => !selected.size || selected.has(row.id))
            .map((row) => ({
              ...row,
              status:
                statusOptions.value.find((item) => item.value === row.status)?.label || row.status,
              hazardLevel: hazardLevelLabels.value[row.hazardLevel] || row.hazardLevel,
              sourceType: sourceLabels.value[row.sourceType] || row.sourceType,
              reportedAt: formatDateTime(row.reportedAt),
              rectificationDeadline: formatDateTime(row.rectificationDeadline),
              rectificationCompletedAt: formatDateTime(row.rectificationCompletedAt),
              acceptedAt: formatDateTime(row.acceptedAt)
            }))
        }
      }
    }
  ])
  const columnsFactory = (): ColumnOption<SmisHiddenHazardGovernanceRecord>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'hazardNo',
      label: '所属隐患编号',
      width: 154,
      fixed: 'left',
      formatter: (row) => (
        <button type="button" class="hazard-governance-page__link" onClick={() => openDetail(row)}>
          {row.hazardNo}
        </button>
      )
    },
    {
      prop: 'status',
      label: '隐患状态',
      width: 104,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisHiddenHazardGovernanceStatus"
          value={row.status}
          display="tag"
        />
      )
    },
    { prop: 'description', label: '隐患描述', minWidth: 220, showOverflowTooltip: true },
    { prop: 'location', label: '隐患位置', minWidth: 160, showOverflowTooltip: true },
    {
      prop: 'hazardLevel',
      label: '隐患级别',
      width: 112,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisHazardLevel" value={row.hazardLevel} display="tag" />
      )
    },
    {
      prop: 'reporterEmployeeName',
      label: '上报人',
      minWidth: 132,
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.reporterEmployeeName}
          secondary={row.reporterEmployeeNo}
        />
      )
    },
    {
      prop: 'reportedAt',
      label: '上报时间',
      width: 164,
      formatter: (row) => formatDateTime(row.reportedAt)
    },
    {
      prop: 'rectificationDeadline',
      label: '整改时限',
      width: 164,
      formatter: (row) => formatDateTime(row.rectificationDeadline)
    },
    { prop: 'rectificationMeasures', label: '整改措施', minWidth: 200, showOverflowTooltip: true },
    {
      prop: 'rectificationResponsibleEmployeeName',
      label: '整改责任人',
      minWidth: 132,
      formatter: (row) => row.rectificationResponsibleEmployeeName || '—'
    },
    {
      prop: 'rectificationCompletedAt',
      label: '整改完成时间',
      width: 164,
      formatter: (row) => formatDateTime(row.rectificationCompletedAt)
    },
    {
      prop: 'acceptorEmployeeName',
      label: '验收人',
      minWidth: 112,
      formatter: (row) => row.acceptorEmployeeName || '—'
    },
    {
      prop: 'acceptedAt',
      label: '验收时间',
      width: 164,
      formatter: (row) => formatDateTime(row.acceptedAt)
    },
    {
      prop: 'sourceType',
      label: '隐患来源',
      width: 132,
      formatter: (row) => sourceLabels.value[row.sourceType] || row.sourceType
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) => {
        const operation = operationFor(row)
        return (
          <div class="hazard-governance-page__actions">
            <ArtButtonTable type="view" label="详情" onClick={() => openDetail(row)} />
            {operation ? (
              <ArtButtonTable
                type="edit"
                icon={operation.icon}
                label={operation.label}
                permission={operation.permission}
                onClick={() => openWorkflow(operation.mode, row)}
              />
            ) : null}
          </div>
        )
      }
    }
  ]

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchHiddenHazardGovernanceList({
      ...params,
      reportedFrom: params.reportedRange?.[0],
      reportedTo: params.reportedRange?.[1] ? `${params.reportedRange[1]}T23:59:59` : undefined,
      from,
      to
    })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return result
  }
  const selectType = async (id?: string): Promise<void> => {
    searchQuery.value = { ...searchQuery.value, inspectionTypeId: id }
    await nextTick()
    await tableQueryRef.value?.getData()
  }
  const loadOptions = async (): Promise<void> => {
    optionsState.loading = true
    optionsState.error = ''
    try {
      const [planOptions, sites] = await Promise.all([
        fetchHiddenHazardPlanOptions(),
        fetchSiteList()
      ])
      optionsState.inspectionTypes = planOptions.inspectionTypes
      siteTree.value = sites.data ?? []
    } catch (error) {
      optionsState.error = getFriendlySupabaseErrorMessage(error, '基础选项加载失败')
    } finally {
      optionsState.loading = false
    }
  }
  const handleCreated = (): void => {
    void tableQueryRef.value?.refreshCreate()
  }
  const handleUpdated = (): void => {
    void tableQueryRef.value?.refreshUpdate()
  }

  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('smisHiddenHazardGovernanceStatus'),
      userStore.ensureDictLoaded('smisHiddenHazardSourceType'),
      userStore.ensureDictLoaded('smisHazardLevel'),
      loadOptions()
    ])
  })
</script>

<style scoped lang="scss">
  @use '../inspection-type-navigator' as navigator;

  .hazard-governance-page {
    gap: 12px;
    min-width: 0;
    overflow: hidden;

    &__workspace {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
    }

    &__navigator-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    &__navigator-card :deep(.art-section-card__header) {
      flex: none;
    }

    &__navigator-card :deep(.art-section-card__body) {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    &__navigator-scrollbar {
      height: 100%;
    }

    &__navigator {
      display: grid;
      gap: 6px;
      padding-right: 4px;
    }

    &__navigator button {
      @include navigator.button;
    }

    &__navigator button:focus-visible,
    :deep(.hazard-governance-page__link:focus-visible) {
      outline: 2px solid color-mix(in srgb, var(--theme-color) 65%, transparent);
      outline-offset: 2px;
    }

    &__navigator strong,
    &__navigator small {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__navigator small {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__type-mark {
      @include business-icon-box;
    }

    &__main {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
      min-height: 0;
    }

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    &__scope {
      display: grid;
      grid-template-columns: 36px max-content minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-height: 56px;
      padding: 8px 14px 8px 12px;
      background: var(--art-gray-100);
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);
    }

    &__scope > span {
      @include business-icon-box;
    }

    &__scope small,
    &__scope strong {
      display: block;
    }

    &__scope small {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__scope p {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      text-align: right;
    }

    :deep(.hazard-governance-page__link) {
      padding: 0;
      color: var(--theme-color);
      cursor: pointer;
      background: transparent;
      border: 0;
    }

    :deep(.hazard-governance-page__actions) {
      display: flex;
      align-items: center;
    }

    @media (width <= 700px) {
      &__scope p {
        display: none;
      }
    }
  }
</style>
