<template>
  <div class="document-register-workspace business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      :eyebrow="config.eyebrow"
      :title="config.title"
      :description="config.description"
      :icon="config.icon"
      :tags="config.tags"
      :metrics="workspaceMetrics"
    >
      <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
    </BusinessWorkspaceHeader>

    <div
      class="document-register-workspace__content"
      :class="{ 'has-category-panel': config.manageCategories }"
    >
      <DocumentCategoryNavigator
        v-if="config.manageCategories"
        :data="categories"
        :loading="categoryLoading"
        :error="categoryError"
        :selected-key="selectedCategoryKey"
        @select="handleCategorySelect"
        @refresh="loadCategories"
        @add="openCategoryDialog()"
        @edit="openCategoryDialog"
        @delete="handleCategoryDelete"
      />

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="document-register-workspace__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{
          span: 6,
          labelWidth: 88,
          showExpand: config.isLegal,
          defaultExpanded: true,
          showReset: false,
          showSearch: false,
          enableEnterSearch: false
        }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: `暂无${config.title}数据`,
          emptyDescription: config.emptyDescription
        }"
        :focus-scope-selector="
          config.manageCategories ? '.document-register-workspace__content' : undefined
        "
        focusable
      />
    </div>

    <DocumentRegisterDialog ref="dialogRef" @success="handleSaveSuccess" />
    <DocumentCategoryDialog
      v-if="config.manageCategories"
      ref="categoryDialogRef"
      @success="handleCategorySaved"
    />
    <MasterDataDeleteGuard ref="deleteDocumentGuardRef" />
    <MasterDataDeleteGuard ref="deleteCategoryGuardRef" />
  </div>
</template>

<script setup lang="tsx">
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { ElTag } from 'element-plus'
  import { watchDebounced } from '@vueuse/core'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
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
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtAttachmentLink from '@/components/core/media/art-file-viewer/attachment-link.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteDocumentCategories,
    deleteDocumentRegisters,
    fetchDocumentCategories,
    fetchDocumentRegisterList,
    type SmisDocumentCategory,
    type SmisDocumentRegister,
    type SmisDocumentRegisterKind,
    type SmisDocumentRegisterOverview,
    type SmisDocumentRegisterSearchParams
  } from '@smis/api'
  import DocumentCategoryDialog, {
    type DocumentCategoryDialogOpenData
  } from './document-category-dialog.vue'
  import DocumentCategoryNavigator from './document-category-navigator.vue'
  import DocumentRegisterDialog, {
    type DocumentRegisterDialogMode,
    type DocumentRegisterDialogOpenData
  } from './document-register-dialog.vue'

  const { deleteGuardRef: deleteDocumentGuardRef, deleteRecords: deleteDocumentRecords } =
    useRecordDeleteGuard('smis_document', '文档台账')
  const { deleteGuardRef: deleteCategoryGuardRef, deleteRecords: deleteCategoryRecords } =
    useRecordDeleteGuard('smis_document_category', '文档分类')

  interface Props {
    kind: SmisDocumentRegisterKind
  }
  interface DialogExpose {
    handleOpen: (data: DocumentRegisterDialogOpenData) => Promise<void>
  }
  interface CategoryDialogExpose {
    handleOpen: (data: DocumentCategoryDialogOpenData) => Promise<void>
  }
  interface WorkspaceConfig {
    title: string
    eyebrow: string
    description: string
    icon: string
    permissionPrefix: string
    manageCategories: boolean
    isLegal: boolean
    emptyDescription: string
    tags: Array<{
      label: string
      type: 'primary' | 'success' | 'warning' | 'danger' | 'info'
      effect: 'plain' | 'light'
    }>
  }

  type TableParams = SmisDocumentRegisterSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>

  const props = defineProps<Props>()
  const emit = defineEmits<{ compliance: [row: SmisDocumentRegister] }>()
  const userStore = useUserStore()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const categoryDialogRef = ref<CategoryDialogExpose>()
  const categories = shallowRef<SmisDocumentCategory[]>([])
  const categoryLoading = ref(false)
  const categoryError = ref<string | null>(null)
  const selectedCategoryKey = ref('all')
  const categoryProps = { label: 'categoryName', children: 'children' }
  const categoryTree = new TreeUtils({
    idKey: 'id',
    parentKey: 'parentId',
    childrenKey: 'children'
  })
  const searchQuery = ref<SmisDocumentRegisterSearchParams>({ kind: props.kind })
  const overview = reactive<SmisDocumentRegisterOverview>({
    total: 0,
    withAttachment: 0,
    specialEquipment: 0,
    evaluated: 0
  })

  const permissionMap = {
    required_knowledge: {
      view: 'SmisRequiredKnowledge:View',
      add: 'SmisRequiredKnowledge:Add',
      edit: 'SmisRequiredKnowledge:Edit',
      delete: 'SmisRequiredKnowledge:Delete',
      export: 'SmisRequiredKnowledge:Export'
    },
    safety_management_system: {
      view: 'SmisSafetyManagementSystem:View',
      add: 'SmisSafetyManagementSystem:Add',
      edit: 'SmisSafetyManagementSystem:Edit',
      delete: 'SmisSafetyManagementSystem:Delete',
      export: 'SmisSafetyManagementSystem:Export'
    },
    legal_regulation: {
      view: 'SmisLegalRegulation:View',
      add: 'SmisLegalRegulation:Add',
      copy: 'SmisLegalRegulation:Copy',
      edit: 'SmisLegalRegulation:Edit',
      delete: 'SmisLegalRegulation:Delete',
      export: 'SmisLegalRegulation:Export',
      complianceView: 'SmisLegalRegulation:ComplianceView'
    }
  } as const

  const configs: Record<SmisDocumentRegisterKind, WorkspaceConfig> = {
    required_knowledge: {
      title: '应知应会',
      eyebrow: 'REQUIRED KNOWLEDGE',
      description: '按自定义文档分类统一维护岗位应知应会文件，支持受控附件和生效日期追溯。',
      icon: 'ri:book-open-line',
      permissionPrefix: 'SmisRequiredKnowledge',
      manageCategories: true,
      isLegal: false,
      emptyDescription: '可先在左侧新增文档分类，再登记第一份应知应会文件。',
      tags: [
        { label: '自定义分类树', type: 'primary', effect: 'plain' },
        { label: '附件版本留痕', type: 'success', effect: 'plain' }
      ]
    },
    safety_management_system: {
      title: '安全管理制度',
      eyebrow: 'SAFETY MANAGEMENT SYSTEM',
      description: '集中维护安全管理制度文件、编号、分类和实施日期，保证制度口径统一可追溯。',
      icon: 'ri:shield-check-line',
      permissionPrefix: 'SmisSafetyManagementSystem',
      manageCategories: false,
      isLegal: false,
      emptyDescription: '新增制度文件后，可按名称、编号和分类快速检索。',
      tags: [
        { label: '统一制度台账', type: 'primary', effect: 'plain' },
        { label: '分类来源文档中心', type: 'info', effect: 'plain' }
      ]
    },
    legal_regulation: {
      title: '法律法规',
      eyebrow: 'LAWS & REGULATIONS',
      description: '维护适用法律法规、标准规范和获取部门，并持续记录逐次合规性评价。',
      icon: 'ri:scales-3-line',
      permissionPrefix: 'SmisLegalRegulation',
      manageCategories: false,
      isLegal: true,
      emptyDescription: '新增法律法规后，可继续维护该文件的合规性评价记录。',
      tags: [
        { label: '系统组织联动', type: 'primary', effect: 'plain' },
        { label: '合规评价留痕', type: 'success', effect: 'plain' },
        { label: '特种设备标识', type: 'warning', effect: 'light' }
      ]
    }
  }
  const config = computed(() => configs[props.kind])
  const permissions = computed(() => permissionMap[props.kind])
  const booleanOptions = computed(() =>
    (userStore.getDictMap.commonBoolean ?? []).map((item) => ({
      label: item.label || item.name,
      value: item.value === 'true'
    }))
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '文档总数',
      value: overview.total,
      description: '当前筛选范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '已有附件',
      value: overview.withAttachment,
      description: '具备受控文件',
      icon: 'ri:attachment-2',
      tone: 'success'
    },
    ...(config.value.isLegal
      ? [
          {
            label: '特种设备相关',
            value: overview.specialEquipment,
            description: '已标识法规',
            icon: 'ri:settings-3-line',
            tone: 'warning' as const
          },
          {
            label: '已完成评价',
            value: overview.evaluated,
            description: '至少一条评价',
            icon: 'ri:checkbox-circle-line',
            tone: 'success' as const
          }
        ]
      : [
          {
            label: '文档分类',
            value: categoryTree.treeToList(categories.value).length,
            description: '统一分类口径',
            icon: 'ri:folder-3-line'
          }
        ])
  ])

  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '文件名称',
      key: 'fileName',
      type: 'input',
      props: { clearable: true, placeholder: '输入文件名称' }
    },
    {
      label: '文件编号',
      key: 'documentCode',
      type: 'input',
      props: { clearable: true, placeholder: '输入文件编号' }
    },
    ...(!config.value.manageCategories
      ? [
          {
            label: '文档分类',
            key: 'categoryId',
            type: 'treeSelect' as const,
            props: {
              data: categories.value,
              props: categoryProps,
              nodeKey: 'id',
              valueKey: 'id',
              checkStrictly: true,
              defaultExpandAll: true,
              filterable: true,
              clearable: true,
              placeholder: '全部文档分类'
            }
          }
        ]
      : []),
    ...(config.value.isLegal
      ? [
          {
            label: '特种设备',
            key: 'isSpecialEquipment',
            type: 'select' as const,
            options: booleanOptions.value,
            props: { clearable: true, placeholder: '全部' }
          },
          {
            label: '获取日期',
            key: 'obtainedDateRange',
            type: 'date' as const,
            span: 12,
            props: {
              type: 'daterange',
              valueFormat: 'YYYY-MM-DD',
              startPlaceholder: '开始日期',
              endPlaceholder: '结束日期',
              rangeSeparator: '至',
              clearable: true,
              class: '!w-full'
            }
          },
          {
            label: '评价日期',
            key: 'evaluationDateRange',
            type: 'date' as const,
            span: 12,
            props: {
              type: 'daterange',
              valueFormat: 'YYYY-MM-DD',
              startPlaceholder: '开始日期',
              endPlaceholder: '结束日期',
              rangeSeparator: '至',
              clearable: true,
              class: '!w-full'
            }
          }
        ]
      : [])
  ])

  const excelColumns = computed<ArtTableQueryExcelColumn[]>(() => [
    { key: 'fileName', title: '文件名称' },
    { key: 'documentCode', title: '文件编号' },
    { key: 'categoryPath', title: '分类' },
    { key: 'effectiveDate', title: '生效日期' },
    { key: 'promulgationDate', title: '颁布日期' },
    ...(config.value.isLegal
      ? [
          { key: 'obtainedDate', title: '获取日期' },
          { key: 'obtainedOrganizationName', title: '获取部门' },
          { key: 'isSpecialEquipmentText', title: '是否特种设备' },
          { key: 'evaluationCount', title: '评价次数' },
          { key: 'lastEvaluationDate', title: '最近评价日期' }
        ]
      : []),
    { key: 'attachmentName', title: '附件' },
    { key: 'remark', title: '备注' }
  ])

  const openDialog = (mode: DocumentRegisterDialogMode, row?: SmisDocumentRegister): void => {
    void dialogRef.value?.handleOpen({ mode, kind: props.kind, categories: categories.value, row })
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => {
    const actions: ArtTableQueryHeaderAction[] = [
      {
        permission: permissions.value.add,
        type: 'add',
        label: '新增',
        onClick: () => openDialog('add')
      }
    ]
    if (config.value.isLegal) {
      actions.push({
        permission: permissionMap.legal_regulation.copy,
        key: 'copy',
        label: '复制并新增',
        icon: 'ri:file-copy-line',
        selectionRequired: true,
        disabled: ({ selectedRows }) => selectedRows.length !== 1,
        onClick: ({ selectedRows }) => openDialog('copy', selectedRows[0] as SmisDocumentRegister)
      })
    }
    actions.push(
      {
        permission: permissions.value.edit,
        key: 'edit',
        label: '编辑',
        icon: 'ri:edit-line',
        selectionRequired: true,
        disabled: ({ selectedRows }) => selectedRows.length !== 1,
        onClick: ({ selectedRows }) => openDialog('edit', selectedRows[0] as SmisDocumentRegister)
      },
      {
        permission: permissions.value.delete,
        type: 'delete',
        confirm: false,
        content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
          `确定删除选中的 ${selectedCount} 份文档吗？附件版本及关联评价将一并删除。`,
        onClick: async ({ selectedRows, api }) => {
          await deleteDocumentRecords({
            resources: selectedRows.map((row) => ({
              id: String(row.id ?? ''),
              label: String(row.fileName ?? '业务记录')
            })),
            permission: permissions.value.delete,
            remove: async () => {
              await deleteDocumentRegisters({
                kind: props.kind,
                ids: selectedRows.map((row) => String(row.id))
              })
            },
            onDeleted: async () => {
              await api.refreshRemove()
            }
          })
        }
      }
    )
    if (config.value.isLegal) {
      actions.push({
        permission: permissionMap.legal_regulation.complianceView,
        key: 'compliance',
        label: '合规性评价',
        icon: 'ri:survey-line',
        selectionRequired: true,
        disabled: ({ selectedRows }) => selectedRows.length !== 1,
        onClick: ({ selectedRows }) => emit('compliance', selectedRows[0] as SmisDocumentRegister)
      })
    }
    actions.push({
      permission: permissions.value.export,
      type: 'export',
      label: '导出',
      exportFilename: config.value.title,
      exportSheetName: config.value.title,
      exportColumns: excelColumns.value,
      exportApi: async ({ maxRows }) => ({
        data: (
          await fetchDocumentRegisterList({
            ...searchQuery.value,
            kind: props.kind,
            purpose: 'export',
            from: 0,
            to: maxRows - 1
          })
        ).data.map((row) => ({
          ...row,
          isSpecialEquipmentText: row.isSpecialEquipment ? '是' : '否'
        }))
      })
    })
    return actions
  })

  const baseColumns = (): ColumnOption<SmisDocumentRegister>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'fileName',
      label: '文件名称',
      minWidth: 230,
      fixed: 'left',
      showOverflowTooltip: true,
      link: {
        permission: permissionMap.legal_regulation.complianceView,
        disabled: () => !config.value.isLegal,
        onClick: (row) => emit('compliance', row)
      }
    },
    { prop: 'documentCode', label: '文件编号', width: 156, showOverflowTooltip: true },
    { prop: 'effectiveDate', label: '生效日期', width: 120 },
    { prop: 'categoryPath', label: '分类', minWidth: 170, showOverflowTooltip: true },
    { prop: 'promulgationDate', label: '颁布日期', width: 120 },
    {
      prop: 'attachmentName',
      label: '附件',
      minWidth: 170,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.attachmentUrl ? (
          <ArtAttachmentLink
            class="document-register-workspace__attachment"
            file={{
              name: row.attachmentName || row.fileName,
              url: row.attachmentUrl,
              fileType: row.attachmentType || undefined
            }}
          />
        ) : (
          '—'
        )
    },
    { prop: 'remark', label: '备注', minWidth: 200, showOverflowTooltip: true }
  ]
  const legalColumns = (): ColumnOption<SmisDocumentRegister>[] => [
    { prop: 'obtainedDate', label: '获取日期', width: 120 },
    {
      prop: 'obtainedOrganizationName',
      label: '获取部门',
      minWidth: 160,
      showOverflowTooltip: true
    },
    {
      prop: 'isSpecialEquipment',
      label: '特种设备',
      width: 104,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="commonBoolean"
          value={String(row.isSpecialEquipment ?? '')}
          display="tag"
        />
      )
    },
    {
      prop: 'evaluationCount',
      label: '合规评价',
      width: 116,
      align: 'center',
      formatter: (row) => (
        <ElTag effect="plain" type={row.evaluationCount ? 'success' : 'info'}>
          {row.evaluationCount} 次
        </ElTag>
      )
    },
    { prop: 'lastEvaluationDate', label: '最近评价', width: 120 }
  ]
  const columnsFactory = (): ColumnOption<SmisDocumentRegister>[] => {
    const columns = baseColumns()
    const operationIndex = columns.length
    if (config.value.isLegal) columns.splice(5, 0, ...legalColumns())
    columns.splice(
      config.value.isLegal ? operationIndex + legalColumns().length : operationIndex,
      0,
      {
        prop: 'operation',
        label: '操作',
        width: config.value.isLegal ? 156 : 116,
        fixed: 'right',
        formatter: (row) => (
          <div class="document-register-workspace__actions">
            <ArtButtonTable
              permission={permissions.value.edit}
              type="edit"
              onClick={() => openDialog('edit', row)}
            />
            {config.value.isLegal ? (
              <>
                <ArtButtonTable
                  permission={permissionMap.legal_regulation.complianceView}
                  type="view"
                  icon="ri:survey-line"
                  label="合规性评价"
                  onClick={() => emit('compliance', row)}
                />
                <ArtButtonMore
                  list={[
                    {
                      key: 'copy',
                      label: '复制并新增',
                      icon: 'ri:file-copy-line',
                      auth: permissionMap.legal_regulation.copy
                    },
                    {
                      key: 'delete',
                      label: '删除',
                      icon: 'ri:delete-bin-line',
                      color: 'var(--el-color-danger)',
                      auth: permissionMap.legal_regulation.delete
                    }
                  ]}
                  onClick={(item: ButtonMoreItem) => void handleMoreAction(item, row)}
                />
              </>
            ) : (
              <ArtButtonTable
                permission={permissions.value.delete}
                type="delete"
                onClick={() => void handleDelete(row)}
              />
            )}
          </div>
        )
      }
    )
    return columns
  }

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchDocumentRegisterList({
      ...params,
      ...searchQuery.value,
      ...buildSupabasePageRange(params),
      kind: props.kind
    })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }
  const reloadFromFilters = (): void => {
    void tableQueryRef.value?.getData()
  }

  watch(
    () => [searchQuery.value.fileName, searchQuery.value.documentCode],
    () => tableQueryRef.value?.cancelRequest(),
    { flush: 'sync' }
  )
  watchDebounced(
    () => [searchQuery.value.fileName, searchQuery.value.documentCode],
    reloadFromFilters,
    {
      debounce: 360
    }
  )
  watch(
    () => [
      searchQuery.value.categoryId,
      searchQuery.value.isSpecialEquipment,
      searchQuery.value.obtainedDateRange?.[0],
      searchQuery.value.obtainedDateRange?.[1],
      searchQuery.value.evaluationDateRange?.[0],
      searchQuery.value.evaluationDateRange?.[1]
    ],
    reloadFromFilters
  )

  const loadCategories = async (): Promise<void> => {
    categoryLoading.value = true
    categoryError.value = null
    try {
      categories.value = await fetchDocumentCategories()
    } catch {
      categoryError.value = '文档分类加载失败，请稍后重试。'
    } finally {
      categoryLoading.value = false
    }
  }
  const handleCategorySelect = (key: string): void => {
    selectedCategoryKey.value = key
    searchQuery.value.categoryId = key === 'all' ? undefined : key
  }
  const openCategoryDialog = (row?: SmisDocumentCategory): void => {
    void categoryDialogRef.value?.handleOpen({
      categories: categories.value,
      row,
      parentId: row
        ? undefined
        : selectedCategoryKey.value === 'all'
          ? undefined
          : selectedCategoryKey.value
    })
  }
  const handleCategoryDelete = async (row: SmisDocumentCategory): Promise<void> => {
    await deleteCategoryRecords({
      resources: [{ id: row.id, label: row.categoryName }],
      permission: 'SmisRequiredKnowledge:CategoryDelete',
      remove: () => deleteDocumentCategories([row.id ?? '']),
      onDeleted: async () => {
        selectedCategoryKey.value = 'all'
        searchQuery.value.categoryId = undefined
        await loadCategories()
        await tableQueryRef.value?.getData()
      }
    })
  }
  const handleCategorySaved = async (): Promise<void> => {
    await loadCategories()
    await tableQueryRef.value?.getData()
  }
  const handleDelete = async (row: SmisDocumentRegister): Promise<void> => {
    await deleteDocumentRecords({
      resources: [{ id: row.id, label: row.fileName }],
      permission: permissions.value.delete,
      remove: () => deleteDocumentRegisters({ kind: props.kind, ids: [row.id ?? ''] }),
      onDeleted: () => tableQueryRef.value?.refreshRemove() ?? Promise.resolve()
    })
  }
  const handleMoreAction = async (
    item: ButtonMoreItem,
    row: SmisDocumentRegister
  ): Promise<void> => {
    if (item.key === 'copy') {
      openDialog('copy', row)
      return
    }
    if (item.key === 'delete') await handleDelete(row)
  }
  const handleSaveSuccess = (): void => void tableQueryRef.value?.getData()

  onMounted(async () => {
    await Promise.all([loadCategories(), userStore.ensureDictLoaded('commonBoolean')])
  })
</script>

<style scoped lang="scss">
  .document-register-workspace {
    min-width: 0;

    &__content {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: hidden;

      &.has-category-panel {
        display: grid;
        grid-template-rows: minmax(0, 1fr);
        grid-template-columns: minmax(250px, 0.28fr) minmax(0, 1fr);
        gap: 12px;
      }
    }

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;

      :deep(.art-table-card) {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-height: 0;
      }
    }

    :deep(.document-register-workspace__attachment) {
      display: inline-flex;
      max-width: 100%;

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }
    }

    @media (width <= 1180px) {
      &__content.has-category-panel {
        grid-template-columns: minmax(220px, 0.34fr) minmax(0, 1fr);
      }
    }

    @media (width <= 900px) {
      &__content.has-category-panel {
        display: flex;
        flex-direction: column;
      }
    }
  }
</style>
