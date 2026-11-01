<template>
  <ArtPermissionGuard permission="SmisMaterialInformation:View">
    <div class="material-information-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="PROTECTIVE EQUIPMENT MASTER DATA"
        title="物料信息"
        description="集中维护防护用品、工器具与办公用品的编码、分类、规格和计量口径，快速检索并导出台账。"
        icon="ri:archive-stack-line"
        :tags="[
          { label: '分类联动', type: 'primary', effect: 'plain' },
          { label: '统一计量单位', type: 'success', effect: 'light' },
          { label: '台账可导出', type: 'info', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="material-information-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="300px"
          primary-min="260px"
          primary-max="420px"
          :breakpoint="900"
          stacked-primary-size="36vh"
        >
          <template #primary>
            <MaterialCategoryNavigator
              :data="tree.data"
              :loading="tree.loading"
              :error="tree.error"
              :selected-key="tree.selectedKey"
              @select="handleTreeSelect"
              @refresh="handleTreeRefresh"
            />
          </template>
          <ArtTableQuery
            ref="tableQueryRef"
            v-model="table.searchQuery"
            class="material-information-page__table"
            :api-fn="fetchTableData"
            :search-items="table.searchItems"
            :columns-factory="columnsFactory"
            :header-actions="table.headerActions"
            header-actions-placement="workspace"
            :search-bar-props="{ span: 6, labelWidth: 76, showExpand: false }"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: tree.selectedKey === ALL_KEY ? '暂无物料信息' : '当前类别下暂无物料',
              emptyDescription:
                tree.selectedKey === ALL_KEY
                  ? '点击新增，建立第一条物料主数据。'
                  : '可在当前类别新增物料，或切换左侧类别查看。'
            }"
            focusable
            focus-scope-selector=".material-information-page__workspace"
          />
        </ArtWorkspaceSplitter>
      </div>
      <MaterialDialog ref="dialogRef" @success="handleSaveSuccess" />
      <MaterialDetailDrawer ref="detailRef" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import dayjs from 'dayjs'
  import { ElImage } from 'element-plus'
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
  import TreeUtils from '@/utils/tree'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import {
    deleteMaterials,
    fetchMaterialList,
    type SmisMaterial,
    type SmisMaterialCategory,
    type SmisMaterialOverview,
    type SmisMaterialSearchParams,
    type SmisMaterialTypeOption,
    type SmisMaterialUnitOption
  } from '@smis/api'
  import MaterialCategoryNavigator from '../shared/material-category-navigator.vue'
  import MaterialDialog, { type MaterialDialogOpenData } from './modules/material-dialog.vue'
  import MaterialDetailDrawer from './modules/material-detail-drawer.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('mdm_material', '物料')

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisMaterialInformation' })
  const ALL_KEY = 'all'
  type TableParams = SmisMaterialSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: MaterialDialogOpenData) => Promise<void>
  }
  interface DetailExpose {
    handleOpen: (row: SmisMaterial) => Promise<void>
  }
  interface TableGroup {
    searchQuery: SmisMaterialSearchParams
    searchItems: SearchFormItem[]
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
  }
  interface TreeGroup {
    data: SmisMaterialCategory[]
    selectedKey: string
    loading: boolean
    error: string | null
  }
  const userStore = useUserStore()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const detailRef = ref<DetailExpose>()
  const overview = reactive<SmisMaterialOverview>({
    total: 0,
    enabled: 0,
    protectiveEquipment: 0,
    pictured: 0
  })
  const tree = reactive<TreeGroup>({ data: [], selectedKey: ALL_KEY, loading: false, error: null })
  const materialTypes = ref<SmisMaterialTypeOption[]>([])
  const units = ref<SmisMaterialUnitOption[]>([])
  const searchQuery = reactive<SmisMaterialSearchParams>({})
  const selectedCategory = computed(() =>
    tree.selectedKey === ALL_KEY ? null : treeUtils.findNode(tree.data, tree.selectedKey)
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '物料总数',
      value: overview.total,
      description: '当前租户主数据',
      icon: 'ri:archive-stack-line'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可用于业务引用',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '防护用品',
      value: overview.protectiveEquipment,
      description: '核心防护物料',
      icon: 'ri:shield-check-line'
    },
    {
      label: '已配置图片',
      value: overview.pictured,
      description: '便于快速识别',
      icon: 'ri:image-line',
      tone: 'warning'
    }
  ])
  const materialTypeLabel = (row: SmisMaterial): string =>
    row.materialTypeName ||
    materialTypes.value.find(
      (item) => item.id === row.materialTypeId || item.typeCode === row.materialType
    )?.typeName ||
    row.materialType
  const unitLabel = (row: SmisMaterial): string =>
    row.baseUnitName ||
    units.value.find((item) => item.id === row.baseUnitId || item.unitCode === row.basicUnit)
      ?.unitName ||
    row.basicUnit
  const openDialog = (row?: SmisMaterial): void => {
    void dialogRef.value?.handleOpen({
      row,
      categoryTree: tree.data,
      materialTypes: materialTypes.value,
      units: units.value,
      presetCategoryId: !row ? selectedCategory.value?.id : undefined
    })
  }
  const openDetail = (row: SmisMaterial): void => {
    void detailRef.value?.handleOpen(row)
  }
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'materialCode', title: '物料编码' },
    { key: 'materialName', title: '物料名称' },
    { key: 'categoryName', title: '物料类别' },
    { key: 'specificationModel', title: '规格型号' },
    { key: 'drawingNo', title: '图号' },
    { key: 'basicUnit', title: '基本单位' },
    { key: 'materialType', title: '物料类型' },
    { key: 'materialSource', title: '物料来源' },
    { key: 'brand', title: '品牌' },
    { key: 'materialComposition', title: '材质' },
    { key: 'placeOfOrigin', title: '产地' },
    { key: 'status', title: '启用状态' },
    { key: 'description', title: '说明' },
    { key: 'updateTime', title: '更新时间' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisMaterialInformation:Add',
      type: 'add',
      label: selectedCategory.value ? '在当前类别新增' : '新增物料',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisMaterialInformation:Edit',
      label: '编辑',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedCount }) => selectedCount !== 1,
      onClick: ({ selectedRows }) => openDialog(selectedRows[0] as SmisMaterial)
    },
    {
      permission: 'SmisMaterialInformation:Export',
      type: 'export',
      label: '导出',
      exportFilename: '物料信息台账',
      exportSheetName: '物料信息',
      exportColumns: excelColumns,
      exportApi: async ({ selectedIds, maxRows }) => {
        const rows = (
          await fetchMaterialList({
            ...searchQuery,
            categoryId: tree.selectedKey === ALL_KEY ? undefined : tree.selectedKey,
            ids: selectedIds?.map(String),
            purpose: 'export',
            from: 0,
            to: maxRows - 1
          })
        ).data
        return {
          data: rows.map((row) => ({
            materialCode: row.materialCode,
            materialName: row.materialName,
            categoryName: row.category.categoryName,
            specificationModel: row.specificationModel || '',
            drawingNo: row.drawingNo || '',
            basicUnit: unitLabel(row),
            materialType: materialTypeLabel(row),
            materialSource: userStore.getDictDisplayLabelByValue(
              'mdmMaterialSource',
              row.materialSource
            ),
            brand: row.brand || '',
            materialComposition: row.materialComposition || '',
            placeOfOrigin: row.placeOfOrigin || '',
            status: userStore.getDictDisplayLabelByValue('commonEnabledStatus', row.status),
            description: row.description || '',
            updateTime: row.updateTime ? dayjs(row.updateTime).format('YYYY-MM-DD HH:mm:ss') : ''
          }))
        }
      }
    },
    {
      permission: 'SmisMaterialInformation:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条物料信息吗？删除后无法恢复。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.materialName ?? '物料')
          })),
          permission: 'SmisMaterialInformation:Delete',
          remove: async () => {
            await deleteMaterials(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const table = reactive<TableGroup>({
    searchQuery,
    searchItems: [
      {
        label: '物料名称',
        key: 'materialName',
        type: 'input',
        props: { clearable: true, placeholder: '输入物料名称' }
      },
      {
        label: '物料编码',
        key: 'materialCode',
        type: 'input',
        props: { clearable: true, placeholder: '输入物料编码' }
      },
      {
        label: '规格型号',
        key: 'specificationModel',
        type: 'input',
        props: { clearable: true, placeholder: '输入规格型号' }
      },
      {
        label: '图号',
        key: 'drawingNo',
        type: 'input',
        props: { clearable: true, placeholder: '输入图号' }
      }
    ],
    headerActions
  })
  const columnsFactory = (): ColumnOption<SmisMaterial>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'imageUrls',
      label: '图片',
      width: 70,
      align: 'center',
      formatter: (row) =>
        row.imageUrls?.[0] ? (
          <ElImage
            class="material-information-page__thumb"
            src={row.imageUrls[0]}
            previewSrcList={row.imageUrls}
            fit="cover"
            previewTeleported
          />
        ) : (
          <span class="material-information-page__thumb material-information-page__thumb--empty">
            <ArtSvgIcon icon="ri:image-line" />
          </span>
        )
    },
    {
      prop: 'materialName',
      label: '物料信息',
      minWidth: 220,
      fixed: 'left',
      formatter: (row) => (
        <button
          type="button"
          class="material-information-page__identity"
          onClick={() => openDetail(row)}
        >
          <strong title={row.materialName}>{row.materialName}</strong>
          <small title={row.materialCode}>{row.materialCode}</small>
        </button>
      )
    },
    {
      prop: 'category',
      label: '物料类别',
      minWidth: 160,
      showOverflowTooltip: true,
      formatter: (row) => row.category.categoryName
    },
    {
      prop: 'specificationModel',
      label: '规格型号',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.specificationModel || '—'
    },
    {
      prop: 'drawingNo',
      label: '图号',
      minWidth: 130,
      showOverflowTooltip: true,
      formatter: (row) => row.drawingNo || '—'
    },
    {
      prop: 'basicUnit',
      label: '基本单位',
      width: 100,
      align: 'center',
      formatter: unitLabel
    },
    {
      prop: 'materialType',
      label: '物料类型',
      width: 120,
      align: 'center',
      formatter: materialTypeLabel
    },
    {
      prop: 'materialSource',
      label: '物料来源',
      width: 110,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="mdmMaterialSource" value={row.materialSource} display="tag" />
      )
    },
    {
      prop: 'status',
      label: '启用状态',
      width: 110,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonEnabledStatus" value={row.status} display="tag" />
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 168,
      formatter: (row) => formatTableDateTime(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 190,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex items-center gap-1">
          <ArtButtonTable
            type="view"
            icon="ri:file-list-3-line"
            label="详情"
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            permission="SmisMaterialInformation:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            permission="SmisMaterialInformation:Delete"
            type="delete"
            onClick={async () => {
              await deleteRecords({
                resources: [
                  {
                    id: String(row.id ?? ''),
                    label: String(row.materialName ?? '物料')
                  }
                ],
                permission: 'SmisMaterialInformation:Delete',
                confirmMessage: `确定删除物料“${row.materialName}”吗？`,
                remove: async () => {
                  await deleteMaterials([row.id ?? ''])
                },
                onDeleted: async () => {
                  await tableQueryRef.value?.getData()
                }
              })
            }}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    tree.loading = !tree.data.length
    tree.error = null
    try {
      const result = await fetchMaterialList({
        ...buildSupabasePageRange(params),
        ...params,
        categoryId: tree.selectedKey === ALL_KEY ? undefined : tree.selectedKey
      })
      tree.data = result.categoryTree
      materialTypes.value = result.materialTypes
      units.value = result.units
      if (!options?.signal?.aborted) Object.assign(overview, result.overview)
      tree.error = result.error ? '物料分类结构加载失败，请重试。' : null
      return { records: result.data, total: result.total }
    } finally {
      tree.loading = false
    }
  }
  const handleTreeSelect = (key: string): void => {
    tree.selectedKey = key
    void tableQueryRef.value?.getData()
  }
  const handleTreeRefresh = (): void => {
    void tableQueryRef.value?.getData()
  }
  const handleSaveSuccess = async (): Promise<void> => {
    await tableQueryRef.value?.getData()
  }
  onMounted(
    () =>
      void Promise.all(
        ['commonEnabledStatus', 'mdmMaterialSource'].map((code) => userStore.ensureDictLoaded(code))
      )
  )
</script>

<style scoped lang="scss">
  .material-information-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
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

    :deep(.material-information-page__thumb) {
      width: 42px;
      height: 42px;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    :deep(.material-information-page__thumb--empty) {
      display: inline-grid;
      place-items: center;
      color: var(--el-text-color-placeholder);
      background: var(--art-gray-100);
    }

    :deep(.material-information-page__identity) {
      display: grid;
      width: 100%;
      padding: 0;
      font: inherit;
      text-align: left;
      cursor: pointer;
      background: none;
      border: 0;
    }

    :deep(.material-information-page__identity strong),
    :deep(.material-information-page__identity small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.material-information-page__identity strong) {
      color: var(--theme-color);
    }

    :deep(.material-information-page__identity small) {
      margin-top: 3px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.material-information-page__identity:focus-visible) {
      outline: 2px solid var(--theme-color);
      outline-offset: 2px;
      border-radius: var(--el-border-radius-small);
    }
  }
</style>
