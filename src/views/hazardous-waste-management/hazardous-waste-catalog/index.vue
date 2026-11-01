<template>
  <ArtPermissionGuard permission="SmisHazardousWasteCatalog:View" resource-name="危废名录">
    <div class="business-workspace-page art-full-height flex min-h-0 min-w-0 flex-col gap-[14px]">
      <BusinessWorkspaceHeader
        eyebrow="HAZARDOUS WASTE CATALOG"
        title="危废名录"
        description="按分类维护危废编号、危险特性、安全措施和计量单位，为入出库明细建立统一识别标准。"
        icon="ri:flask-line"
        :tags="[
          { label: '树形分类', type: 'primary', effect: 'plain' },
          { label: '危险特性字典', type: 'warning', effect: 'light' },
          { label: '租户级隔离', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
        ><template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template
      ></BusinessWorkspaceHeader>
      <div class="hazardous-catalog-page__workspace min-h-0 flex-1"
        ><ArtWorkspaceSplitter
          primary-size="300px"
          primary-min="250px"
          primary-max="400px"
          :breakpoint="900"
          stacked-primary-size="36vh"
          ><template #primary
            ><CategoryNavigator
              :data="tree.data"
              :loading="tree.loading"
              :error="tree.error"
              :selected-key="tree.selectedKey"
              @select="handleSelect"
              @refresh="refresh"
              @add="handleAddCategory"
              @edit="openCategory"
              @delete="handleDeleteCategory" /></template
          ><div class="flex min-h-0 min-w-0 flex-1 flex-col gap-[14px]">
            <MasterDeleteProcessingNotice :table="tableQueryRef" />
            <ArtTableQuery
              ref="tableQueryRef"
              v-model="searchQuery"
              class="min-h-0 min-w-0"
              :api-fn="fetchData"
              :search-items="searchItems"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyText: '暂无危废名录',
                emptyDescription: '请选择或新增分类，再维护危废名录。'
              }"
              focusable
              focus-scope-selector=".hazardous-catalog-page__workspace" /></div></ArtWorkspaceSplitter
      ></div>
      <CategoryDialog ref="categoryDialogRef" @success="refresh" /><CatalogDialog
        ref="catalogDialogRef"
        @success="refresh"
      />
      <MasterDataDeleteGuard ref="deleteGuardRef" />
    </div>
  </ArtPermissionGuard>
</template>
<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import { useMasterDataDeleteProcessingContext } from '@/hooks/core/useMasterDataDeleteProcessing'
  import MasterDeleteProcessingNotice from '@/components/business/master-delete-processing-notice/index.vue'
  import MasterDataDeleteGuard, {
    type MasterDataDeleteDependencyMeta
  } from '@/components/business/master-data-delete-guard/index.vue'
  import {
    formatReferenceStatus,
    getRecordReferenceMeta
  } from '@/components/business/master-data-delete-guard/record-meta'
  import { DeleteReferenceBlockedError } from '@/utils/supabase/delete-reference'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteHazardousWasteCatalog,
    deleteHazardousWasteCategories,
    fetchHazardousWasteCatalogList,
    fetchHazardousWasteCatalogDeleteDependencies,
    type SmisHazardousWasteCatalogItem,
    type SmisHazardousWasteCatalogOverview,
    type SmisHazardousWasteCatalogSearchParams,
    type SmisHazardousWasteCategory
  } from '@smis/api'
  import CategoryNavigator from './modules/category-navigator.vue'
  import CategoryDialog, { type CategoryDialogOpenData } from './modules/category-dialog.vue'
  import CatalogDialog, { type CatalogDialogOpenData } from './modules/catalog-dialog.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisHazardousWasteCatalog' })
  const ALL_KEY = 'all'
  type TableParams = SmisHazardousWasteCatalogSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface CategoryExpose {
    handleOpen: (data: CategoryDialogOpenData) => Promise<void>
  }
  interface CatalogExpose {
    handleOpen: (data: CatalogDialogOpenData) => Promise<void>
  }
  const { confirmDelete } = useArtFeedback()
  const { hasAnyAuth } = useAuth()
  const { deleteGuardRef, inspectDeleteReferences: inspectCategoryReferences } =
    useRecordDeleteGuard('smis_hazardous_waste_category', '危废分类', {
      smis_hazardous_waste_category: {
        label: '下级危废分类',
        routeName: 'SmisHazardousWasteCatalog',
        canNavigate: () => hasAnyAuth(['SmisHazardousWasteCatalog:View'])
      },
      smis_hazardous_waste_catalog: {
        label: '危废名录',
        routeName: 'SmisHazardousWasteCatalog',
        canNavigate: () => hasAnyAuth(['SmisHazardousWasteCatalog:View'])
      }
    })
  const deleteBusy = ref(false)
  const deleteProcessing = useMasterDataDeleteProcessingContext()
  const route = useRoute()
  const userStore = useUserStore()
  const displayDictionaryCodes = [
    'commonEnabledDisabledStatus',
    'smisHazardousWasteCharacteristic',
    'smisHazardousWasteSafetyMeasure',
    'smisMaterialUnit'
  ]
  const { getDictMap } = storeToRefs(userStore)
  const utils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const categoryDialogRef = ref<CategoryExpose>()
  const catalogDialogRef = ref<CatalogExpose>()
  const searchQuery = ref<SmisHazardousWasteCatalogSearchParams>({})
  const tree = reactive<{
    data: SmisHazardousWasteCategory[]
    selectedKey: string
    loading: boolean
    error: string | null
  }>({ data: [], selectedKey: ALL_KEY, loading: false, error: null })
  const overview = reactive<SmisHazardousWasteCatalogOverview>({
    total: 0,
    enabled: 0,
    categoryCount: 0,
    characteristicCount: 0
  })
  const selectedCategory = computed(() =>
    tree.selectedKey === ALL_KEY ? null : utils.findNode(tree.data, tree.selectedKey)
  )
  const options = computed(() =>
    (getDictMap.value.commonEnabledDisabledStatus ?? []).map(toDictionaryOption)
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '名录总数',
      value: overview.total,
      description: '危废识别条目',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可用于新增单据',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '分类数量',
      value: overview.categoryCount,
      description: '当前分类节点',
      icon: 'ri:node-tree'
    },
    {
      label: '特性覆盖',
      value: overview.characteristicCount,
      description: '已配置危险特性',
      icon: 'ri:alert-line',
      tone: 'warning'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '危废编号、名称或类型' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'select',
      props: { options: options.value, clearable: true, placeholder: '全部状态' }
    }
  ])
  const openCategory = (row?: SmisHazardousWasteCategory, presetParentId?: string): void =>
    void categoryDialogRef.value?.handleOpen({
      row,
      tree: tree.data,
      presetParentId: row ? undefined : presetParentId
    })
  const handleAddCategory = (parentId?: string): void => openCategory(undefined, parentId)
  const openCatalog = (row?: SmisHazardousWasteCatalogItem): void =>
    void catalogDialogRef.value?.handleOpen({
      row,
      categories: tree.data,
      presetCategoryId: selectedCategory.value?.id
    })
  const exportColumns = [
    { key: 'wasteCode', title: '危废编号' },
    { key: 'wasteName', title: '危废名称' },
    { key: 'categoryName', title: '危废分类' },
    { key: 'wasteType', title: '废物类型' },
    { key: 'safetyMeasure', title: '安全措施' },
    { key: 'hazardCharacteristic', title: '危险特性' },
    { key: 'unit', title: '单位' },
    { key: 'statusLabel', title: '状态' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisHazardousWasteCatalog:Add',
      type: 'add',
      label: '新增危废名录',
      onClick: () => openCatalog()
    },
    {
      permission: 'SmisHazardousWasteCatalog:Export',
      type: 'export',
      exportFilename: '危废名录',
      exportSheetName: '危废名录',
      exportColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const exportQuery: SmisHazardousWasteCatalogSearchParams = {
          ...(searchParams as SmisHazardousWasteCatalogSearchParams),
          categoryId: tree.selectedKey === ALL_KEY ? undefined : tree.selectedKey,
          ids: selectedIds.map(String),
          purpose: 'export'
        }
        const rows = await loadAllDocumentPages(fetchHazardousWasteCatalogList, exportQuery)
        await Promise.all(displayDictionaryCodes.map((code) => userStore.ensureDictLoaded(code)))
        return {
          data: rows.map((row) => ({
            ...row,
            categoryName: row.category.categoryName,
            safetyMeasure: userStore.getDictLabelByValue(
              'smisHazardousWasteSafetyMeasure',
              row.safetyMeasure || ''
            ),
            hazardCharacteristic: userStore.getDictLabelByValue(
              'smisHazardousWasteCharacteristic',
              row.hazardCharacteristic || ''
            ),
            unit: userStore.getDictLabelByValue('smisMaterialUnit', row.unit),
            statusLabel: userStore.getDictLabelByValue('commonEnabledDisabledStatus', row.status)
          }))
        }
      }
    },
    {
      permission: 'SmisHazardousWasteCatalog:Delete',
      type: 'delete',
      confirm: false,
      disabled: deleteBusy.value,
      onClick: ({ selectedRows, api }) =>
        removeCatalog(selectedRows as SmisHazardousWasteCatalogItem[], () => api.refreshRemove())
    }
  ])
  const columnsFactory = (): ColumnOption<SmisHazardousWasteCatalogItem>[] => {
    const columns: ColumnOption<SmisHazardousWasteCatalogItem>[] = [
      { type: 'selection', width: 48 },
      { prop: 'sort', label: '排序', width: 76, align: 'center' },
      {
        prop: 'wasteName',
        label: '危废名录',
        minWidth: 220,
        fixed: 'left',
        formatter: (row) => (
          <BusinessTableIdentityCell
            primary={row.wasteName}
            secondary={row.wasteCode}
            icon="ri:flask-line"
          />
        )
      },
      {
        prop: 'category',
        label: '危废分类',
        minWidth: 150,
        formatter: (row) => (
          <ElTag type={row.tagStyle || 'info'}>
            <span style={{ color: row.textColor || undefined }}>{row.category.categoryName}</span>
          </ElTag>
        )
      },
      {
        prop: 'wasteType',
        label: '废物类型',
        minWidth: 130,
        showOverflowTooltip: true,
        formatter: (row) => row.wasteType || '—'
      },
      {
        prop: 'hazardCharacteristic',
        label: '危险特性',
        minWidth: 130,
        formatter: (row) => (
          <ArtDictDisplay
            dictCode="smisHazardousWasteCharacteristic"
            value={row.hazardCharacteristic}
            display="tag"
          />
        )
      },
      {
        prop: 'safetyMeasure',
        label: '安全措施',
        minWidth: 140,
        showOverflowTooltip: true,
        formatter: (row) => (
          <ArtDictDisplay dictCode="smisHazardousWasteSafetyMeasure" value={row.safetyMeasure} />
        )
      },
      {
        prop: 'unit',
        label: '单位',
        width: 90,
        align: 'center',
        formatter: (row) => <ArtDictDisplay dictCode="smisMaterialUnit" value={row.unit} />
      },
      {
        prop: 'status',
        label: '状态',
        width: 100,
        align: 'center',
        formatter: (row) => (
          <ArtDictDisplay dictCode="commonEnabledDisabledStatus" value={row.status} display="tag" />
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
        width: 112,
        fixed: 'right',
        formatter: (row) => (
          <BusinessTableRowActions>
            <ArtButtonTable
              type="edit"
              permission="SmisHazardousWasteCatalog:Edit"
              onClick={() => openCatalog(row)}
            />
            <ArtButtonTable
              type="delete"
              permission="SmisHazardousWasteCatalog:Delete"
              onClick={() => void deleteRow(row)}
            />
          </BusinessTableRowActions>
        )
      }
    ]
    return columns.filter(
      (column) =>
        column.prop !== 'operation' ||
        hasAnyAuth(['SmisHazardousWasteCatalog:Edit', 'SmisHazardousWasteCatalog:Delete'])
    )
  }
  const fetchData = async (params: TableParams, options?: TableRequestOptions) => {
    tree.loading = !tree.data.length
    tree.error = null
    try {
      const result = await fetchHazardousWasteCatalogList(
        {
          ...params,
          ...buildSupabasePageRange(params),
          categoryId: tree.selectedKey === ALL_KEY ? undefined : tree.selectedKey,
          ...(deleteProcessing.value.active && deleteProcessing.value.recordId
            ? route.query.dependencyCode === 'smis_hazardous_waste_category'
              ? { categoryId: deleteProcessing.value.recordId }
              : { ids: [deleteProcessing.value.recordId], categoryId: undefined }
            : {})
        },
        { showErrorMessage: false }
      )
      if (result.error) {
        throw new Error('危废名录加载失败，请重新加载', { cause: result.error })
      }
      if (!options?.signal?.aborted) {
        tree.data = result.categories
        if (
          deleteProcessing.value.active &&
          route.query.dependencyCode === 'smis_hazardous_waste_category'
        )
          tree.selectedKey = deleteProcessing.value.recordId
        Object.assign(overview, result.overview)
      }
      return { records: result.data, total: result.total }
    } catch (error) {
      if (!options?.signal?.aborted) tree.error = '危废分类加载失败，请稍后重试。'
      throw error
    } finally {
      if (!options?.signal?.aborted) tree.loading = false
    }
  }
  const handleSelect = (key: string): void => {
    tree.selectedKey = key
    void tableQueryRef.value?.getData()
  }
  const refresh = async (): Promise<void> => {
    await tableQueryRef.value?.getData()
  }
  watch(
    () => [
      deleteProcessing.value.active,
      deleteProcessing.value.recordId,
      route.query.dependencyCode
    ],
    () => {
      tree.selectedKey = ALL_KEY
      void tableQueryRef.value?.getData()
    }
  )
  const inspectCatalogReferences = async (rows: SmisHazardousWasteCatalogItem[]) => {
    if (!deleteGuardRef.value) {
      ElMessage.error('关联校验尚未就绪，请刷新页面后重试删除')
      return true
    }
    const dependencyMeta: Record<string, MasterDataDeleteDependencyMeta> = {}
    return deleteGuardRef.value.inspect({
      resourceLabel: '危废名录',
      resources: rows.map((row) => ({ id: row.id, label: `${row.wasteName} · ${row.wasteCode}` })),
      navigationResource: { type: 'smis_hazardous_waste_catalog', queryKey: 'referencedRecordId' },
      dependencyMeta,
      fetchDependencies: async (ids) => {
        const references = await fetchHazardousWasteCatalogDeleteDependencies(ids)
        return references.map((row) => {
          const dependencyCode = row.documentDirection
            ? `${row.sourceTable}_${row.documentDirection}`
            : row.sourceTable
          const routeName =
            row.documentDirection === 'inbound'
              ? 'SmisHazardousWasteInbound'
              : 'SmisHazardousWasteOutbound'
          dependencyMeta[dependencyCode] = {
            ...getRecordReferenceMeta(row.sourceTable),
            ...(row.documentDirection
              ? {
                  label: row.documentDirection === 'inbound' ? '危废入库单据' : '危废出库单据',
                  routeName,
                  canNavigate: () => hasAnyAuth([`${routeName}:View`])
                }
              : {}),
            unit: '条',
            order: 1,
            actionLabel: '查看关联',
            description: '请核对引用单据，保留业务历史；名录可改为停用。'
          }
          return {
            ...row,
            dependencyCode,
            createdAt: row.createdAt ?? '',
            recordStatus: formatReferenceStatus(row.recordStatus) || '状态待核对',
            cleanupAllowed: false
          }
        })
      }
    })
  }
  const removeCatalog = async (
    rows: SmisHazardousWasteCatalogItem[],
    refreshRows: () => unknown | Promise<unknown>
  ): Promise<void> => {
    if (deleteBusy.value || !rows.length) return
    if (!hasAnyAuth(['SmisHazardousWasteCatalog:Delete'])) return
    deleteBusy.value = true
    try {
      if (await inspectCatalogReferences(rows)) return
      await confirmDelete(
        rows.length === 1
          ? `确定删除危废名录“${rows[0].wasteName}”吗？`
          : `确定删除选中的 ${rows.length} 条危废名录吗？`
      )
      try {
        await deleteHazardousWasteCatalog(rows.map((row) => row.id))
      } catch (error) {
        if (error instanceof DeleteReferenceBlockedError) return
        if (await inspectCatalogReferences(rows)) return
        throw error
      }
      ElMessage.success('危废名录已删除')
      await refreshRows()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close')
        notifyFriendlyError(error, '危废名录删除失败，请重试')
    } finally {
      deleteBusy.value = false
    }
  }
  const deleteRow = (row: SmisHazardousWasteCatalogItem) =>
    removeCatalog([row], () => tableQueryRef.value?.refreshRemove())
  const handleDeleteCategory = async (row: SmisHazardousWasteCategory): Promise<void> => {
    if (deleteBusy.value || !hasAnyAuth(['SmisHazardousWasteCatalog:DeleteCategory'])) return
    deleteBusy.value = true
    const resources = [{ id: row.id, label: `${row.categoryName} · ${row.categoryCode}` }]
    try {
      if (await inspectCategoryReferences(resources)) return
      await confirmDelete(`确定删除危废分类“${row.categoryName}”吗？`)
      try {
        await deleteHazardousWasteCategories([row.id])
      } catch (error) {
        if (error instanceof DeleteReferenceBlockedError) return
        if (await inspectCategoryReferences(resources)) return
        throw error
      }
      ElMessage.success('危废分类已删除')
      tree.selectedKey = ALL_KEY
      await refresh()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close')
        notifyFriendlyError(error, '危废分类删除失败，请重试')
    } finally {
      deleteBusy.value = false
    }
  }
  onMounted(
    () => void Promise.all(displayDictionaryCodes.map((code) => userStore.ensureDictLoaded(code)))
  )
</script>
