<template>
  <ArtPermissionGuard
    permission="SmisDualControlHiddenHazardInspectionPlan:View"
    resource-name="隐患排查计划"
  >
    <div class="hidden-hazard-plan-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="hidden-hazard-plan-page__overview"
        eyebrow="HAZARD INSPECTION PLANNING"
        title="隐患排查计划"
        description="按排查类型、组织、周期与标准编排任务，计划生效后自动生成月度四位流水任务并保留来源快照。"
        icon="ri:calendar-check-line"
        density="compact"
        :tags="[
          { label: '标准驱动', type: 'primary', effect: 'plain' },
          { label: '周期派发', type: 'success', effect: 'light' },
          { label: '来源追溯', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="hidden-hazard-plan-page__workspace">
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
              class="hidden-hazard-plan-page__navigator-card"
              title="排查类型导航"
              subtitle="选择类型后聚焦对应计划"
              :loading="optionsState.loading"
              :error="optionsState.error"
              :empty="!optionsState.loading && !optionsState.data.inspectionTypes.length"
              empty-title="暂无排查类型"
              empty-description="请先在排查类型中维护并启用类型。"
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
              <ElScrollbar class="hidden-hazard-plan-page__navigator-scrollbar">
                <nav class="hidden-hazard-plan-page__navigator" aria-label="排查类型">
                  <button
                    type="button"
                    :class="{ 'is-active': !searchQuery.inspectionTypeId }"
                    @click="selectType()"
                  >
                    <span class="hidden-hazard-plan-page__type-mark"
                      ><ArtSvgIcon icon="ri:apps-2-line"
                    /></span>
                    <span><strong>全部类型</strong><small>查看所有排查计划</small></span>
                  </button>
                  <button
                    v-for="item in optionsState.data.inspectionTypes"
                    :key="item.id"
                    type="button"
                    :class="{ 'is-active': searchQuery.inspectionTypeId === item.id }"
                    @click="selectType(item.id)"
                  >
                    <span
                      class="hidden-hazard-plan-page__type-mark"
                      :style="{ color: item.textColor || 'var(--theme-color)' }"
                      ><ArtSvgIcon icon="ri:radar-line"
                    /></span>
                    <span
                      ><strong>{{ item.typeName }}</strong
                      ><small>{{ item.typeCode }}</small></span
                    >
                  </button>
                </nav>
              </ElScrollbar>
            </ArtSectionCard>
          </template>

          <main class="hidden-hazard-plan-page__main">
            <div class="hidden-hazard-plan-page__scope">
              <span><ArtSvgIcon icon="ri:focus-3-line" /></span>
              <div
                ><small>当前计划范围</small
                ><strong>{{ selectedType?.typeName || '全部排查类型' }}</strong></div
              >
              <p>{{
                selectedType ? `类型编号 ${selectedType.typeCode}` : '可通过左侧导航快速聚焦计划'
              }}</p>
            </div>
            <ArtTableQuery
              ref="tableQueryRef"
              class="hidden-hazard-plan-page__table"
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
                emptyText: '暂无隐患排查计划',
                emptyDescription: '点击新增建立第一条可自动派发的排查计划。'
              }"
              focusable
              focus-scope-selector=".hidden-hazard-plan-page__workspace"
            />
          </main>
        </ArtWorkspaceSplitter>
      </div>

      <PlanDialog ref="dialogRef" @success="handleSaved" />
      <PlanDetailDrawer ref="detailRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import dayjs from 'dayjs'
  import { ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteHiddenHazardInspectionPlans,
    fetchHiddenHazardInspectionPlanList,
    fetchHiddenHazardPlanOptions,
    voidHiddenHazardInspectionPlans,
    type SmisHiddenHazardInspectionPlan,
    type SmisHiddenHazardPlanOptions,
    type SmisHiddenHazardPlanOverview,
    type SmisHiddenHazardPlanSearchParams
  } from '@smis/api'
  import PlanDialog, { type HiddenHazardPlanDialogOpenData } from './modules/plan-dialog.vue'
  import PlanDetailDrawer, {
    type HiddenHazardPlanDetailOpenData
  } from './modules/plan-detail-drawer.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisDualControlHiddenHazardInspectionPlan' })
  interface PlanQuery extends SmisHiddenHazardPlanSearchParams {
    plannedRange?: [string, string]
  }
  type TableParams = PlanQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: HiddenHazardPlanDialogOpenData) => Promise<void>
  }
  interface DetailExpose {
    handleOpen: (data: HiddenHazardPlanDetailOpenData) => Promise<void>
  }

  const { confirmAction } = useArtFeedback()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const detailRef = ref<DetailExpose>()
  const searchQuery = ref<PlanQuery>({})
  const overview = reactive<SmisHiddenHazardPlanOverview>({
    total: 0,
    enabled: 0,
    disabled: 0,
    voided: 0
  })
  const optionsState = reactive<{
    data: SmisHiddenHazardPlanOptions
    loading: boolean
    error: string
  }>({
    data: { inspectionTypes: [], organizations: [] },
    loading: false,
    error: ''
  })
  const selectedType = computed(() =>
    optionsState.data.inspectionTypes.find((item) => item.id === searchQuery.value.inspectionTypeId)
  )
  const statusOptions = computed(() =>
    (getDictMap.value.commonEnabledDisabledVoidedStatus ?? []).map(toDictionaryOption)
  )
  const deadlineLabels = computed(() =>
    Object.fromEntries(
      (getDictMap.value.commonDeadlineUnit ?? []).map((item) => [
        item.value,
        item.label || item.name
      ])
    )
  )
  const cycleLabels = computed(() =>
    Object.fromEntries(
      (getDictMap.value.commonPlanCycle ?? []).map((item) => [item.value, item.label || item.name])
    )
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '计划总数',
      value: overview.total,
      description: '当前查询口径',
      icon: 'ri:calendar-line'
    },
    {
      label: '启用计划',
      value: overview.enabled,
      description: '等待周期派发',
      icon: 'ri:play-circle-line',
      tone: 'success'
    },
    {
      label: '禁用计划',
      value: overview.disabled,
      description: '暂停生成任务',
      icon: 'ri:pause-circle-line',
      tone: 'warning'
    },
    {
      label: '已作废',
      value: overview.voided,
      description: '仅保留历史追溯',
      icon: 'ri:forbid-2-line'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '计划编号',
      key: 'planNo',
      type: 'input',
      props: { clearable: true, placeholder: '输入计划编号' }
    },
    {
      label: '计划名称',
      key: 'planName',
      type: 'input',
      props: { clearable: true, placeholder: '输入计划名称' }
    },
    {
      label: '计划时间',
      key: 'plannedRange',
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
      label: '执行人',
      key: 'executorKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名或工号' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'planNo', title: '计划编号' },
    { key: 'planName', title: '排查名称' },
    { key: 'inspectionTypeName', title: '排查类型' },
    { key: 'inspectionOrganizationName', title: '检查单位' },
    { key: 'plannedStartAt', title: '计划开始时间' },
    { key: 'plannedEndAt', title: '计划结束时间' },
    { key: 'taskDeadline', title: '任务时限' },
    { key: 'cycle', title: '循环周期' },
    { key: 'attachmentCount', title: '检查计划附件数' },
    { key: 'executorEmployeeName', title: '检查人' },
    { key: 'inspectedOrganizationName', title: '被检查单位' },
    { key: 'createBy', title: '创建人' },
    { key: 'createTime', title: '创建时间' },
    { key: 'status', title: '状态' }
  ]
  const openDialog = (row?: SmisHiddenHazardInspectionPlan): void => {
    void dialogRef.value?.handleOpen({
      row,
      options: optionsState.data,
      presetInspectionTypeId: searchQuery.value.inspectionTypeId
    })
  }
  const openDetail = (row: SmisHiddenHazardInspectionPlan): void => {
    void detailRef.value?.handleOpen({ row })
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlHiddenHazardInspectionPlan:Add',
      type: 'add',
      label: '新增计划',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisDualControlHiddenHazardInspectionPlan:Export',
      type: 'export',
      exportFilename: '隐患排查计划',
      exportSheetName: '排查计划',
      exportColumns: excelColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const query = searchParams as PlanQuery
        const selected = new Set(selectedIds.map(String))
        const exportQuery: SmisHiddenHazardPlanSearchParams = {
          ...query,
          ids: undefined,
          plannedFrom: query.plannedRange?.[0],
          plannedTo: query.plannedRange?.[1] ? `${query.plannedRange[1]}T23:59:59` : undefined
        }
        const rows = await loadAllDocumentPages(fetchHiddenHazardInspectionPlanList, exportQuery)
        await Promise.all([
          userStore.ensureDictLoaded('commonEnabledDisabledVoidedStatus'),
          userStore.ensureDictLoaded('commonDeadlineUnit'),
          userStore.ensureDictLoaded('commonPlanCycle')
        ])
        return {
          data: rows
            .filter((row) => !selected.size || selected.has(row.id))
            .map((row) => ({
              ...row,
              plannedStartAt: dayjs(row.plannedStartAt).format('YYYY-MM-DD HH:mm'),
              plannedEndAt: dayjs(row.plannedEndAt).format('YYYY-MM-DD HH:mm'),
              taskDeadline: `${row.taskDeadlineValue}${deadlineLabels.value[row.taskDeadlineUnit] || row.taskDeadlineUnit}`,
              cycle:
                row.cycleType === 'once'
                  ? '不循环'
                  : `每${row.cycleInterval}${cycleLabels.value[row.cycleType] || row.cycleType}`,
              attachmentCount: row.attachmentUrls.length,
              status:
                statusOptions.value.find((item) => item.value === row.status)?.label || row.status
            }))
        }
      }
    },
    {
      permission: 'SmisDualControlHiddenHazardInspectionPlan:Void',
      key: 'void',
      label: '作废',
      icon: 'ri:forbid-2-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }) => {
        await confirmAction(
          '确定作废选中的计划吗？计划将停止生成新任务，历史任务仍保留。',
          '作废排查计划'
        )
        await voidHiddenHazardInspectionPlans(selectedRows.map((row) => String(row.id)))
        await api.refreshUpdate()
      }
    },
    {
      permission: 'SmisDualControlHiddenHazardInspectionPlan:Delete',
      type: 'delete',
      content: ({ selectedCount }: { selectedCount: number }) =>
        `确定删除选中的 ${selectedCount} 条未派发计划吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteHiddenHazardInspectionPlans(selectedRows.map((row) => String(row.id)))
        await api.refreshRemove()
      }
    }
  ])
  const columnsFactory = (): ColumnOption<SmisHiddenHazardInspectionPlan>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'planNo',
      label: '计划编号',
      width: 150,
      fixed: 'left',
      formatter: (row) => (
        <button type="button" class="hidden-hazard-plan-page__link" onClick={() => openDetail(row)}>
          {row.planNo}
        </button>
      )
    },
    {
      prop: 'planName',
      label: '排查名称',
      minWidth: 220,
      fixed: 'left',
      showOverflowTooltip: true
    },
    {
      prop: 'inspectionTypeName',
      label: '排查类型',
      width: 128,
      formatter: (row) => (
        <ElTag type={row.inspectionTypeTagStyle || 'info'} effect="light">
          <span style={{ color: row.inspectionTypeTextColor || undefined }}>
            {row.inspectionTypeName}
          </span>
        </ElTag>
      )
    },
    {
      prop: 'inspectionOrganizationName',
      label: '检查单位',
      minWidth: 160,
      showOverflowTooltip: true
    },
    {
      prop: 'plannedStartAt',
      label: '计划开始时间',
      width: 164,
      formatter: (row) => formatTableDateTime(row.plannedStartAt)
    },
    {
      prop: 'plannedEndAt',
      label: '计划结束时间',
      width: 164,
      formatter: (row) => formatTableDateTime(row.plannedEndAt)
    },
    {
      prop: 'taskDeadlineValue',
      label: '任务时限',
      width: 104,
      formatter: (row) =>
        `${row.taskDeadlineValue} ${deadlineLabels.value[row.taskDeadlineUnit] || row.taskDeadlineUnit}`
    },
    {
      prop: 'cycleType',
      label: '循环周期',
      width: 112,
      formatter: (row) =>
        row.cycleType === 'once'
          ? '不循环'
          : `每 ${row.cycleInterval} ${cycleLabels.value[row.cycleType] || row.cycleType}`
    },
    {
      prop: 'attachmentUrls',
      label: '计划附件',
      width: 96,
      align: 'center',
      formatter: (row) => `${row.attachmentUrls.length} 个`
    },
    {
      prop: 'executorEmployeeName',
      label: '检查人',
      minWidth: 140,
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.executorEmployeeName}
          secondary={row.executorEmployeeNo}
        />
      )
    },
    {
      prop: 'inspectedOrganizationName',
      label: '被检查单位',
      minWidth: 160,
      showOverflowTooltip: true
    },
    {
      prop: 'itemCount',
      label: '排查内容',
      width: 90,
      align: 'right',
      formatter: (row) => `${row.itemCount} 项`
    },
    {
      prop: 'status',
      label: '状态',
      width: 96,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="commonEnabledDisabledVoidedStatus"
          value={row.status}
          display="tag"
        />
      )
    },
    { prop: 'createBy', label: '创建人', minWidth: 120, showOverflowTooltip: true },
    {
      prop: 'createTime',
      label: '创建时间',
      width: 164,
      formatter: (row) => formatTableDateTime(row.createTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 142,
      fixed: 'right',
      formatter: (row) => (
        <div class="hidden-hazard-plan-page__actions">
          <ArtButtonTable type="view" label="详情" onClick={() => openDetail(row)} />
          <ArtButtonTable
            type="edit"
            permission="SmisDualControlHiddenHazardInspectionPlan:Edit"
            label="编辑"
            disabled={row.status === 'voided' || row.taskCount > 0}
            onClick={() => openDialog(row)}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchHiddenHazardInspectionPlanList({
      ...params,
      plannedFrom: params.plannedRange?.[0],
      plannedTo: params.plannedRange?.[1] ? `${params.plannedRange[1]}T23:59:59` : undefined,
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
      optionsState.data = await fetchHiddenHazardPlanOptions()
    } catch (error) {
      optionsState.error = getFriendlySupabaseErrorMessage(error, '排查类型加载失败')
    } finally {
      optionsState.loading = false
    }
  }
  const handleSaved = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }
  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('commonEnabledDisabledVoidedStatus'),
      userStore.ensureDictLoaded('commonDeadlineUnit'),
      userStore.ensureDictLoaded('commonPlanCycle'),
      loadOptions()
    ])
  })
</script>

<style scoped lang="scss">
  @use '../inspection-type-navigator' as navigator;

  .hidden-hazard-plan-page {
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

    &__navigator button:focus-visible {
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

    :deep(.hidden-hazard-plan-page__link) {
      padding: 0;
      color: var(--theme-color);
      cursor: pointer;
      background: transparent;
      border: 0;
    }

    :deep(.hidden-hazard-plan-page__link:focus-visible) {
      outline: 2px solid color-mix(in srgb, var(--theme-color) 60%, transparent);
      outline-offset: 3px;
    }

    :deep(.hidden-hazard-plan-page__actions) {
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
