<template>
  <ArtPermissionGuard
    permission="SmisAntiViolationStandardLibrary:View"
    resource-name="反违章标准库"
  >
    <div class="anti-violation-standard-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="ANTI-VIOLATION STANDARD LIBRARY"
        title="反违章标准库"
        description="沉淀可检索、可复用的违章认定与处置口径，统一分类、扣分、教育要求和制度依据。"
        icon="ri:shield-check-line"
        :tags="[
          { label: '统一认定口径', type: 'primary', effect: 'plain' },
          { label: '分类联动', type: 'success', effect: 'light' },
          { label: '导入导出', type: 'info', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="anti-violation-standard-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="304px"
          primary-min="264px"
          primary-max="430px"
          :breakpoint="920"
          stacked-primary-size="36vh"
        >
          <template #primary>
            <ViolationCategoryNavigator
              :data="tree.data"
              :loading="tree.loading"
              :error="tree.error"
              :selected-key="tree.selectedKey"
              target-label="反违章标准"
              @select="handleTreeSelect"
              @refresh="handleTreeRefresh"
            />
          </template>

          <ArtTableQuery
            ref="tableQueryRef"
            v-model="table.searchQuery"
            class="anti-violation-standard-page__table"
            :api-fn="fetchTableData"
            :search-items="table.searchItems"
            :columns-factory="columnsFactory"
            :header-actions="table.headerActions"
            header-actions-placement="workspace"
            :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: tree.selectedKey === ALL_KEY ? '暂无反违章标准' : '当前分类暂无标准',
              emptyDescription:
                tree.selectedKey === ALL_KEY
                  ? '可新增标准，或按模板导入已确认的企业违章口径。'
                  : '可直接在当前分类下新增标准，或切换左侧分类。'
            }"
            focusable
            focus-scope-selector=".anti-violation-standard-page__workspace"
          />
        </ArtWorkspaceSplitter>
      </div>

      <AntiViolationStandardDialog ref="dialogRef" @success="handleSaveSuccess" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter, formatNumberValue } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import TreeUtils from '@/utils/tree'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'

  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteAntiViolationStandards,
    fetchAntiViolationStandardList,
    fetchViolationCategoryList,
    saveAntiViolationStandard,
    type SmisAntiViolationStandard,
    type SmisAntiViolationStandardOverview,
    type SmisAntiViolationStandardSearchParams,
    type SmisViolationCategory
  } from '@smis/api'
  import ViolationCategoryNavigator from '../shared/violation-category-navigator.vue'
  import AntiViolationStandardDialog, {
    type AntiViolationStandardDialogOpenData
  } from './modules/anti-violation-standard-dialog.vue'
  import { prepareAntiViolationStandardImport } from './anti-violation-standard-import'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_anti_violation_standard',
    '反违章标准'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisAntiViolationStandardLibrary' })

  const ALL_KEY = 'all'
  type TableParams = SmisAntiViolationStandardSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: AntiViolationStandardDialogOpenData) => Promise<void>
  }
  interface TableGroup {
    searchQuery: SmisAntiViolationStandardSearchParams
    searchItems: SearchFormItem[]
    headerActions: ArtTableQueryHeaderAction[]
  }
  interface TreeGroup {
    data: SmisViolationCategory[]
    selectedKey: string
    loading: boolean
    error: string | null
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const overview = reactive<SmisAntiViolationStandardOverview>({
    total: 0,
    enabled: 0,
    disabled: 0,
    totalPoints: 0
  })
  const tree = reactive<TreeGroup>({ data: [], selectedKey: ALL_KEY, loading: false, error: null })
  const tableSearchQuery = reactive<SmisAntiViolationStandardSearchParams>({})
  const statusOptions = computed(() =>
    (getDictMap.value.commonEnabledStatus ?? []).map(toDictionaryOption)
  )
  const selectedCategory = computed(() =>
    tree.selectedKey === ALL_KEY ? null : treeUtils.findNode(tree.data, tree.selectedKey)
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '标准总数',
      value: overview.total,
      description: '当前分类与筛选范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可用于三违认定',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '已停用',
      value: overview.disabled,
      description: '仅保留历史引用',
      icon: 'ri:pause-circle-line',
      tone: 'warning'
    },
    {
      label: '扣分值合计',
      value: overview.totalPoints,
      description: '当前结果集口径',
      icon: 'ri:subtract-line'
    }
  ])

  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'standardCode', title: '违章编号', required: true },
    { key: 'standardName', title: '违章名称', required: true },
    { key: 'categoryCode', title: '分类编码', required: true },
    { key: 'deductionPoints', title: '扣减分值', required: true },
    { key: 'handlingRequirements', title: '处理要求' },
    { key: 'legalBasis', title: '制度依据' },
    { key: 'status', title: '启用状态' },
    { key: 'description', title: '补充说明' }
  ]

  const openDialog = (row?: SmisAntiViolationStandard): void => {
    void dialogRef.value?.handleOpen({
      row,
      categoryTree: tree.data,
      presetCategoryId: !row ? selectedCategory.value?.id : undefined
    })
  }

  const importRows = async (rows: unknown[]): Promise<void> => {
    if (!tree.data.length) {
      const categoryResult = await fetchViolationCategoryList({ from: 0, to: 9999 })
      tree.data = categoryResult.tree
    }
    const categories = treeUtils.treeToList(tree.data)
    const preparedRows = prepareAntiViolationStandardImport(rows, categories)
    for (const payload of preparedRows) await saveAntiViolationStandard(payload)
    await tableQueryRef.value?.getData()
  }

  const headerActions: ComputedRef<ArtTableQueryHeaderAction[]> = computed(() => [
    {
      permission: 'SmisAntiViolationStandardLibrary:Add',
      type: 'add',
      label: '新增标准',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisAntiViolationStandardLibrary:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条反违章标准吗？已被教育记录引用的标准无法删除。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.standardName ?? '反违章标准')
          })),
          permission: 'SmisAntiViolationStandardLibrary:Delete',
          remove: async () => {
            await deleteAntiViolationStandards(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    },
    {
      permission: 'SmisAntiViolationStandardLibrary:Import',
      type: 'import',
      label: '导入',
      importColumns: excelColumns,
      importApi: importRows,
      onImportError: () => {
        ElMessage.error('导入失败，请检查分类编码和模板内容后重试')
      }
    },
    {
      permission: 'SmisAntiViolationStandardLibrary:Export',
      type: 'export',
      label: '导出',
      exportFilename: '反违章标准库',
      exportSheetName: '反违章标准',
      exportColumns: excelColumns,
      exportApi: async ({ maxRows }) => ({
        data: (
          await fetchAntiViolationStandardList({
            ...tableSearchQuery,
            categoryId: tree.selectedKey === ALL_KEY ? undefined : tree.selectedKey,
            purpose: 'export',
            from: 0,
            to: maxRows - 1
          })
        ).data
      })
    }
  ])

  const table: TableGroup = reactive({
    searchQuery: tableSearchQuery,
    searchItems: computed(() => [
      {
        label: '关键字',
        key: 'keyword',
        type: 'input',
        props: { clearable: true, placeholder: '违章编号、名称、分类或处理要求' }
      },
      {
        label: '启用状态',
        key: 'status',
        type: 'select',
        props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
      }
    ]),
    headerActions
  })

  const columnsFactory = (): ColumnOption<SmisAntiViolationStandard>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'standardCode',
      label: '违章编号',
      width: 138,
      fixed: 'left',
      formatter: (row) => (
        <strong class="anti-violation-standard-page__code">{row.standardCode}</strong>
      )
    },
    { prop: 'standardName', label: '违章名称', minWidth: 300, showOverflowTooltip: true },
    { prop: 'categoryName', label: '所属违章分类', minWidth: 170, showOverflowTooltip: true },
    {
      prop: 'deductionPoints',
      label: '扣减分值',
      width: 112,
      align: 'right',
      sortable: true,
      formatter: (row) => `${formatNumberValue(Number(row.deductionPoints))} 分`
    },
    { prop: 'handlingRequirements', label: '处理要求', minWidth: 240, showOverflowTooltip: true },
    { prop: 'legalBasis', label: '制度依据', minWidth: 200, showOverflowTooltip: true },
    {
      prop: 'status',
      label: '启用状态',
      width: 108,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonEnabledStatus" value={row.status} display="tag" />
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
      width: 120,
      fixed: 'right',
      formatter: (row) => (
        <div class="anti-violation-standard-page__actions">
          <ArtButtonTable
            permission="SmisAntiViolationStandardLibrary:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            permission="SmisAntiViolationStandardLibrary:Delete"
            type="delete"
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]

  const fetchTableData = async (params: TableParams) => {
    tree.loading = !tree.data.length
    tree.error = null
    try {
      const [standardResult, categoryResult] = await Promise.all([
        fetchAntiViolationStandardList({
          ...params,
          ...buildSupabasePageRange(params),
          categoryId: tree.selectedKey === ALL_KEY ? undefined : tree.selectedKey
        }),
        fetchViolationCategoryList({ from: 0, to: 9999 })
      ])
      tree.data = categoryResult.tree
      tree.error = categoryResult.error ? '违章分类结构加载失败，请重试。' : null
      Object.assign(overview, standardResult.overview)
      return { records: standardResult.data, total: standardResult.total }
    } finally {
      tree.loading = false
    }
  }

  const handleTreeSelect = (key: string): void => {
    tree.selectedKey = key
    void tableQueryRef.value?.getData()
  }
  const handleTreeRefresh = (): void => void tableQueryRef.value?.getData()
  const handleSaveSuccess = (): void => void tableQueryRef.value?.getData()
  const handleDelete = async (row: SmisAntiViolationStandard): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.standardName ?? '反违章标准')
        }
      ],
      permission: 'SmisAntiViolationStandardLibrary:Delete',
      confirmMessage: `确定删除反违章标准“${row.standardCode}”吗？`,
      remove: async () => {
        await deleteAntiViolationStandards([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }

  onMounted(() => void userStore.ensureDictLoaded('commonEnabledStatus'))
</script>

<style scoped lang="scss">
  .anti-violation-standard-page {
    display: flex;
    flex-direction: column;
    min-height: 0;

    &__workspace {
      flex: 1;
      width: 100%;
      min-height: 0;
    }

    &__table {
      min-width: 0;
      min-height: 0;
    }

    :deep(.anti-violation-standard-page__code) {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding-inline: 9px;
      font-size: 12px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-small);
    }
  }
</style>
