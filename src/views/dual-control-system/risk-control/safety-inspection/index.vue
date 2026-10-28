<template>
  <ArtPermissionGuard permission="SmisDualControlSafetyInspection:View">
    <div class="safety-inspection-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="safety-inspection-page__overview"
        eyebrow="SAFETY INSPECTION LEDGER"
        title="安全检查"
        description="按排查类型与组织快速定位检查记录，集中完成台账维护、证据留痕和整改指令输出。"
        icon="ri:shield-check-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="safety-inspection-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="252px"
          primary-min="228px"
          primary-max="320px"
          :breakpoint="980"
          narrow-mode="stack"
          :stacked-primary-size="
            options.error || (!options.inspectionTypes.length && !options.organizations.length)
              ? 'auto'
              : '320px'
          "
          stacked-secondary-min-size="760px"
        >
          <template #primary>
            <SafetyInspectionNavigator
              v-model="navigation.value"
              :inspection-types="options.inspectionTypes"
              :organizations="options.organizations"
              :loading="options.loading"
              :error="options.error"
              @change="handleNavigationChange"
              @refresh="loadOptions"
            />
          </template>

          <ArtTableQuery
            ref="tableQueryRef"
            v-model="table.searchQuery"
            class="safety-inspection-page__table"
            :search-items="searchItems"
            :api-fn="fetchTableData"
            :response-adapter="adaptInspectionResponse"
            :columns-factory="columnsFactory"
            :header-actions="headerActions"
            header-actions-placement="workspace"
            :search-bar-props="{
              span: 6,
              labelWidth: 92,
              showExpand: true,
              defaultExpanded: true
            }"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: '暂无安全检查记录',
              emptyDescription: '调整查询条件，或新增一条安全检查记录。',
              showOverflowTooltip: true
            }"
            :on-success="handleTableSuccess"
            :on-cache-hit="handleTableSuccess"
            focusable
            focus-scope-selector=".safety-inspection-page__workspace"
          />
        </ArtWorkspaceSplitter>
      </div>

      <SafetyInspectionDialog ref="dialogRef" @success="handleDialogSuccess" />
      <MasterDataDeleteGuard ref="deleteGuardRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { useAuth } from '@/hooks/core/useAuth'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { uniqBy } from 'lodash-es'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import type { ApiResponse } from '@/utils/table/table-cache'
  import { defaultResponseAdapter } from '@/utils/table/table-utils'
  import dayjs from 'dayjs'
  import { ElMessage, ElTag } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtAttachmentLink from '@/components/core/media/art-file-viewer/attachment-link.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import {
    copySafetyInspection,
    deleteSafetyInspections,
    fetchSafetyInspectionList,
    fetchSafetyInspectionOptions,
    type SmisSafetyInspectionOrganization,
    type SmisSafetyInspectionOverview,
    type SmisSafetyInspectionRecord,
    type SmisSafetyInspectionSearchParams,
    type SmisSafetyInspectionTypeOption
  } from '@smis/api'
  import { toDualControlOrganizationTree } from '@smis/views/dual-control-system/shared/organization-tree'
  import SafetyInspectionNavigator from './modules/safety-inspection-navigator.vue'
  import SafetyInspectionDialog, {
    type SafetyInspectionDialogOpenData
  } from './modules/safety-inspection-dialog.vue'
  import { printHtmlDocument } from '@/utils/file/print-document'
  import { getAttachmentNameFromUrl } from '@/utils/file/attachment'
  import { buildRectificationNoticeHtml } from './modules/safety-inspection-document'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisDualControlSafetyInspection' })
  const { hasAnyAuth } = useAuth()
  const { deleteGuardRef, deleteRecords, deleteBusy } = useRecordDeleteGuard(
    'smis_safety_inspection',
    '安全检查'
  )

  type TableSearchModel = SmisSafetyInspectionSearchParams & { inspectionRange?: string[] }
  type TableParams = TableSearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: SafetyInspectionDialogOpenData) => Promise<void>
  }
  interface InspectionOptionsGroup {
    inspectionTypes: SmisSafetyInspectionTypeOption[]
    organizations: SmisSafetyInspectionOrganization[]
    loading: boolean
    error: string | null
  }
  interface InspectionTableGroup {
    searchQuery: TableSearchModel
    overview: SmisSafetyInspectionOverview | null
  }

  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const navigation = reactive({ value: '' })
  const options = reactive<InspectionOptionsGroup>({
    inspectionTypes: [],
    organizations: [],
    loading: false,
    error: null
  })
  const table = reactive<InspectionTableGroup>({
    searchQuery: {
      inspectionName: '',
      inspectionRange: [],
      inspectedOrganizationId: '',
      inspectorKeyword: ''
    },
    overview: null
  })
  const visibleOverview = computed(() =>
    tableQueryRef.value?.dataState &&
    !tableQueryRef.value.dataState.loading.value &&
    !tableQueryRef.value.dataState.error.value
      ? table.overview
      : null
  )

  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: '类型联动', type: 'primary', effect: 'plain' },
    { label: '组织导航', type: 'success', effect: 'light' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '检查记录',
      value: visibleOverview.value?.total ?? '—',
      description: '当前查询范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '本月检查',
      value: visibleOverview.value?.thisMonth ?? '—',
      description: '按检查时间统计',
      icon: 'ri:calendar-check-line',
      tone: 'success'
    },
    {
      label: '覆盖单位',
      value: visibleOverview.value?.organizationCount ?? '—',
      description: '去重被检查组织',
      icon: 'ri:building-4-line',
      tone: 'info'
    },
    {
      label: '参与检查人',
      value: visibleOverview.value?.inspectorCount ?? '—',
      description: '当前范围去重人数',
      icon: 'ri:team-line',
      tone: 'warning'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '检查名称',
      key: 'inspectionName',
      type: 'input',
      props: { clearable: true, placeholder: '输入检查名称' }
    },
    {
      label: '检查时间',
      key: 'inspectionRange',
      type: 'daterange',
      props: {
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        clearable: true
      }
    },
    {
      label: '被检查单位',
      key: 'inspectedOrganizationId',
      type: 'treeSelect',
      props: {
        data: options.organizations,
        props: { label: 'organizationName', value: 'id', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        defaultExpandAll: true,
        filterable: true,
        clearable: true,
        placeholder: '全部单位'
      }
    },
    {
      label: '检查人',
      key: 'inspectorKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名或工号' }
    }
  ])

  const columnsFactory = (): ColumnOption<SmisSafetyInspectionRecord>[] => {
    const columns: ColumnOption<SmisSafetyInspectionRecord>[] = [
      { type: 'selection', width: 48, reserveSelection: true },
      { type: 'globalIndex', label: '序号', width: 68 },
      {
        prop: 'inspectionTypeName',
        label: '检查类别',
        width: 132,
        formatter: (row) => <ElTag effect="plain">{row.inspectionTypeName}</ElTag>
      },
      {
        prop: 'inspectionName',
        label: '检查名称',
        minWidth: 210,
        showOverflowTooltip: true
      },
      {
        prop: 'inspectionOrganizationName',
        label: '检查单位',
        minWidth: 170,
        showOverflowTooltip: true
      },
      {
        prop: 'inspectionTime',
        label: '检查时间',
        width: 166,
        formatter: (row) => formatTableDateTime(row.inspectionTime)
      },
      {
        prop: 'planAttachmentUrls',
        label: '检查计划附件',
        minWidth: 180,
        formatter: (row) => {
          const url = row.planAttachmentUrls[0]
          return url ? (
            <div class="safety-inspection-page__attachment">
              <ArtAttachmentLink
                file={{ url, name: getAttachmentNameFromUrl(url, '检查计划附件') }}
              />
              {row.planAttachmentUrls.length > 1 ? (
                <span>+{row.planAttachmentUrls.length - 1}</span>
              ) : null}
            </div>
          ) : (
            <span class="safety-inspection-page__muted">未上传</span>
          )
        }
      },
      {
        prop: 'inspectorNames',
        label: '检查人',
        minWidth: 160,
        showOverflowTooltip: true
      },
      {
        prop: 'inspectedOrganizationName',
        label: '被检查单位',
        minWidth: 180,
        showOverflowTooltip: true
      },
      { prop: 'createBy', label: '创建人', minWidth: 126, showOverflowTooltip: true },
      {
        prop: 'createTime',
        label: '创建时间',
        width: 166,
        formatter: (row) => formatTableDateTime(row.createTime)
      },
      {
        prop: 'operation',
        label: '操作',
        width: 82,
        fixed: 'right',
        formatter: (row) => (
          <ArtButtonTable
            type="edit"
            permission="SmisDualControlSafetyInspection:Edit"
            label="编辑安全检查"
            onClick={() => openDialog(row)}
          />
        )
      }
    ]
    return columns.filter(
      (column) =>
        column.prop !== 'operation' || hasAnyAuth(['SmisDualControlSafetyInspection:Edit'])
    )
  }

  const exportColumns = [
    { key: 'inspectionTypeName', title: '检查类别', required: true },
    { key: 'inspectionName', title: '检查名称', required: true },
    { key: 'inspectionOrganizationName', title: '检查单位' },
    { key: 'inspectionTime', title: '检查时间' },
    { key: 'planAttachmentUrls', title: '检查计划附件' },
    { key: 'inspectorNames', title: '检查人' },
    { key: 'inspectedOrganizationName', title: '被检查单位' },
    { key: 'createBy', title: '创建人' },
    { key: 'createTime', title: '创建时间' }
  ]
  const requireSingleRow = (
    context: ArtTableQueryHeaderActionContext
  ): SmisSafetyInspectionRecord | null => {
    if (context.selectedRows.length !== 1) {
      ElMessage.warning('请选择一条安全检查记录')
      return null
    }
    return context.selectedRows[0] as SmisSafetyInspectionRecord
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'add',
      label: '新增安全检查',
      permission: 'SmisDualControlSafetyInspection:Add',
      onClick: () => openDialog()
    },
    {
      key: 'copy',
      label: '复制',
      icon: 'ri:file-copy-2-line',
      permission: 'SmisDualControlSafetyInspection:Copy',
      selectionRequired: true,
      onClick: async (context) => {
        const row = requireSingleRow(context)
        if (!row) return
        await copySafetyInspection(row.id)
        await context.api.refreshCreate()
      }
    },
    {
      key: 'notice',
      label: '安全检查整改指令书',
      icon: 'ri:file-warning-line',
      permission: 'SmisDualControlSafetyInspection:RectificationNotice',
      selectionRequired: true,
      onClick: (context) => {
        const row = requireSingleRow(context)
        if (row) printRectificationNotice(row)
      }
    },
    {
      type: 'export',
      label: '导出',
      permission: 'SmisDualControlSafetyInspection:Export',
      exportFilename: '安全检查记录',
      exportSheetName: '安全检查',
      exportColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const params = normalizeSearchParams(searchParams as TableSearchModel)
        const selected = new Set(selectedIds.map(String))
        const rows = await loadAllDocumentPages(
          (page) => fetchSafetyInspectionList(page, { showErrorMessage: false }),
          {
            ...params,
            ids: undefined
          }
        )
        return {
          data: rows.filter((row) => !selected.size || selected.has(row.id))
        }
      }
    },
    {
      type: 'delete',
      label: '删除',
      permission: 'SmisDualControlSafetyInspection:Delete',
      confirm: false,
      disabled: deleteBusy.value,
      onClick: async ({ selectedRows, api }) => {
        const rows = uniqBy(selectedRows as SmisSafetyInspectionRecord[], 'id')
        const ids = rows.map((row) => row.id)
        await deleteRecords({
          resources: rows.map((row) => ({ id: row.id, label: row.inspectionName })),
          permission: 'SmisDualControlSafetyInspection:Delete',
          remove: async () => {
            const result = await deleteSafetyInspections(ids, {
              showMessage: false,
              showErrorMessage: false
            })
            if (result.data !== ids.length)
              throw new Error('安全检查未全部删除，请刷新列表后核对并重试')
          },
          onDeleted: () => api.refreshRemove(),
          successMessage: '安全检查已删除'
        })
      }
    }
  ])

  const normalizeSearchParams = (params: TableSearchModel): SmisSafetyInspectionSearchParams => {
    const range = Array.isArray(params.inspectionRange) ? params.inspectionRange : []
    const inspectionTypeId = navigation.value.startsWith('type:')
      ? navigation.value.slice('type:'.length)
      : undefined
    const navigationOrganizationId = navigation.value.startsWith('organization:')
      ? navigation.value.slice('organization:'.length)
      : undefined
    return {
      inspectionName: params.inspectionName,
      inspectionFrom: range[0] ? dayjs(range[0]).startOf('day').toISOString() : undefined,
      inspectionTo: range[1] ? dayjs(range[1]).endOf('day').toISOString() : undefined,
      inspectedOrganizationId: navigationOrganizationId || params.inspectedOrganizationId,
      inspectionTypeId,
      inspectorKeyword: params.inspectorKeyword
    }
  }
  const fetchTableData = (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return fetchSafetyInspectionList(
      { ...normalizeSearchParams(params), from, to },
      { ...options, showErrorMessage: false }
    )
  }
  const adaptInspectionResponse = (
    response: Awaited<ReturnType<typeof fetchSafetyInspectionList>>
  ) => {
    if (response.error) throw response.error
    return {
      ...defaultResponseAdapter<SmisSafetyInspectionRecord>(response),
      overview: response.overview
    }
  }
  const handleTableSuccess = (
    _records: SmisSafetyInspectionRecord[],
    response: ApiResponse<SmisSafetyInspectionRecord> & {
      overview?: SmisSafetyInspectionOverview | null
    }
  ): void => {
    table.overview = response.overview ?? null
  }
  const handleNavigationChange = (): void => {
    if (navigation.value.startsWith('organization:')) {
      table.searchQuery.inspectedOrganizationId = ''
    }
    void tableQueryRef.value?.refreshContext()
  }
  let optionsController: AbortController | undefined
  onScopeDispose(() => optionsController?.abort())
  const loadOptions = async (): Promise<void> => {
    optionsController?.abort()
    const controller = new AbortController()
    optionsController = controller
    options.loading = true
    options.error = null
    try {
      const result = await fetchSafetyInspectionOptions({
        signal: controller.signal,
        showErrorMessage: false
      })
      if (controller.signal.aborted) return
      options.inspectionTypes = result.inspectionTypes
      options.organizations = toDualControlOrganizationTree(result.organizations)
    } catch {
      if (!controller.signal.aborted) options.error = '检查导航加载失败，请稍后重试'
    } finally {
      if (optionsController === controller) {
        if (!controller.signal.aborted) options.loading = false
        optionsController = undefined
      }
    }
  }
  const openDialog = (row?: SmisSafetyInspectionRecord): void => {
    if (options.loading || options.error) {
      ElMessage.warning('检查导航暂不可用，请先重新加载后重试')
      return
    }
    if (!options.inspectionTypes.length || !options.organizations.length) {
      ElMessage.warning('请先维护并启用排查类型和系统组织')
      return
    }
    void dialogRef.value?.handleOpen({
      row,
      inspectionTypes: options.inspectionTypes,
      organizations: options.organizations,
      presetInspectionTypeId: navigation.value.startsWith('type:')
        ? navigation.value.slice('type:'.length)
        : undefined,
      presetInspectedOrganizationId: navigation.value.startsWith('organization:')
        ? navigation.value.slice('organization:'.length)
        : undefined
    })
  }
  const handleDialogSuccess = (type: 'add' | 'edit'): void =>
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  const printRectificationNotice = (row: SmisSafetyInspectionRecord): void => {
    printHtmlDocument(buildRectificationNoticeHtml(row), 'width=980,height=820')
  }

  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .safety-inspection-page {
    gap: var(--art-space-3);
    min-width: 0;

    &__overview,
    &__workspace,
    &__table {
      min-width: 0;
      min-height: 0;
    }

    &__overview {
      overflow: hidden;
    }

    &__workspace {
      flex: 1 1 auto;
      width: 100%;
    }

    &__table {
      height: 100%;
    }

    :deep(.safety-inspection-page__attachment) {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      min-width: 0;

      .art-attachment-link {
        min-width: 0;
      }

      > span {
        flex: none;
        font-size: var(--art-font-size-caption);
        color: var(--theme-color);
      }
    }

    :deep(.safety-inspection-page__muted) {
      color: var(--el-text-color-secondary);
    }

    @media (width <= 980px) {
      &__workspace {
        flex: 0 0 auto;
        min-height: 1140px;
      }
    }
  }
</style>
