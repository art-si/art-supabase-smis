<template>
  <div
    class="inspection-page business-workspace-page art-full-height flex min-h-0 flex-col gap-[14px]"
  >
    <BusinessWorkspaceHeader
      eyebrow="INSPECTION DECLARATION & EVIDENCE"
      title="检验申报"
      description="统一申报设备检验，自动生成报告编号，并沉淀结论、延期、提醒与图片证据到设备全生命周期。"
      icon="ri:file-shield-2-line"
      :tags="[
        { label: '租户编号规则', type: 'primary', effect: 'plain' },
        { label: '检验类别联动', type: 'success', effect: 'light' },
        { label: '图片证据可追溯', type: 'info', effect: 'plain' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
    </BusinessWorkspaceHeader>

    <ArtAsyncState
      v-if="categoryLoadError"
      size="compact"
      :error="'检验类别加载失败，请重新加载'"
      :loading="categoriesLoading"
      @retry="loadCategories"
    />
    <ArtTableQuery
      ref="tableQueryRef"
      v-model="table.searchQuery"
      class="min-h-0 flex-1"
      :api-fn="fetchTableData"
      :search-items="table.searchItems"
      :columns-factory="columnsFactory"
      :header-actions="table.headerActions"
      header-actions-placement="workspace"
      :search-bar-props="{ span: 6, labelWidth: 82 }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无检验申报',
        emptyDescription: '从设备台账选择设备，创建第一份检验申报。'
      }"
      focusable
    />

    <InspectionDeclarationDialog ref="dialogRef" @success="refreshTable" />
  </div>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { fetchOrganizationOptionsTree } from '@/api/system-manage'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useImageViewer } from '@/hooks/core/useImageViewer'
  import { useUserStore } from '@/store/modules/user'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteEquipmentInspections,
    fetchEquipmentInspectionList,
    fetchInspectionCategoryList,
    type SmisEquipmentInspection,
    type SmisEquipmentInspectionOverview,
    type SmisEquipmentInspectionSearchParams,
    type SmisInspectionCategory,
    type SmisInspectionCategorySearchParams
  } from '@smis/api'
  import InspectionDeclarationDialog, {
    type InspectionDeclarationDialogOpenData
  } from './modules/inspection-declaration-dialog.vue'

  const formatTableDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD',
    emptyText: '--',
    invalidText: '--'
  })
  const formatTableDate3 = createDateTimeFormatter({
    format: 'YYYY-MM-DD',
    emptyText: '未计划',
    invalidText: '未计划'
  })

  defineOptions({ name: 'SmisInspectionDeclaration' })
  type TableParams = SmisEquipmentInspectionSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: InspectionDeclarationDialogOpenData) => Promise<void>
  }

  const { confirmDelete } = useArtFeedback()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const organizationTree = ref<Api.SystemManage.OrganizationListItem[]>([])
  const categoriesLoading = ref(false)
  const categoryLoadError = shallowRef<unknown>(null)
  const inspectionCategoryOptions = ref<Array<{ label: string; value: string }>>([])
  const overview = reactive<SmisEquipmentInspectionOverview>({
    total: 0,
    completed: 0,
    dueSoon: 0,
    imageCount: 0
  })

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '检验申报',
      value: overview.total,
      description: '当前租户全部记录',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '已完成',
      value: overview.completed,
      description: '已形成检验结论',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '90 天内到期',
      value: overview.dueSoon,
      description: '需关注下次检验',
      icon: 'ri:alarm-warning-line',
      tone: overview.dueSoon ? 'warning' : undefined
    },
    {
      label: '图片证据',
      value: overview.imageCount,
      description: '已关联检验图片',
      icon: 'ri:image-2-line',
      tone: 'primary'
    }
  ])
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const openDialog = (row?: SmisEquipmentInspection): void => {
    void dialogRef.value?.handleOpen({ row })
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisInspectionDeclaration:Add',
      type: 'add',
      label: '新增检验申报',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisInspectionDeclaration:Delete',
      type: 'delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 份检验申报吗？相关生命周期记录与图片关联将一并移除。`,
      onClick: async ({ selectedRows, api }) => {
        const ids = selectedRows
          .map((row) => row.id)
          .filter((id): id is string => typeof id === 'string')
        await deleteEquipmentInspections(ids)
        await api.refreshRemove()
      }
    }
  ])
  const table = reactive<{
    searchQuery: SmisEquipmentInspectionSearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
  }>({
    searchQuery: {},
    searchItems: computed(() => [
      {
        label: '关键字',
        key: 'keyword',
        type: 'input',
        props: { clearable: true, placeholder: '报告编号、设备编码或名称' }
      },
      {
        label: '使用部门',
        key: 'organizationId',
        type: 'treeSelect',
        props: {
          data: organizationTree.value,
          nodeKey: 'id',
          props: { label: 'organizationName', value: 'id', children: 'children' },
          checkStrictly: true,
          clearable: true,
          placeholder: '全部部门'
        }
      },
      {
        label: '检验类别',
        key: 'inspectionCategoryId',
        type: 'selectV2',
        props: {
          options: inspectionCategoryOptions.value,
          loading: categoriesLoading.value,
          disabled: categoriesLoading.value || !!categoryLoadError.value,
          filterable: true,
          clearable: true,
          placeholder: '全部类别'
        }
      },
      {
        label: '检验状态',
        key: 'status',
        type: 'select',
        props: {
          options: dictOptions('smisEquipmentInspectionStatus'),
          clearable: true,
          placeholder: '全部状态'
        }
      }
    ]),
    headerActions
  })

  const columnsFactory = (): ColumnOption<SmisEquipmentInspection>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 70 },
    {
      prop: 'inspectionNo',
      label: '检验报告编号',
      width: 172,
      fixed: 'left',
      formatter: (row) => <span class="inspection-page__code">{row.inspectionNo}</span>
    },
    {
      prop: 'equipment',
      label: '设备信息',
      minWidth: 225,
      formatter: (row) => (
        <div class="inspection-page__equipment">
          <span aria-hidden="true">
            <ArtSvgIcon icon="ri:archive-line" />
          </span>
          <span>
            <strong title={row.equipment.equipmentName}>{row.equipment.equipmentName}</strong>
            <small title={row.equipment.equipmentCode}>{row.equipment.equipmentCode}</small>
          </span>
        </div>
      )
    },
    {
      prop: 'inspectionCategory',
      label: '检验类别',
      minWidth: 125,
      formatter: (row) => row.inspectionCategory.categoryName
    },
    {
      prop: 'inspectionDate',
      label: '检验日期',
      width: 118,
      formatter: (row) => formatTableDate(row.inspectionDate)
    },
    {
      prop: 'conclusion',
      label: '检验结论',
      width: 125,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEquipmentInspectionConclusion" value={row.conclusion} />
      )
    },
    {
      prop: 'inspectionInstitution',
      label: '检验机构',
      minWidth: 170,
      showOverflowTooltip: true,
      formatter: (row) => row.inspectionInstitution?.supplierName || '未设置'
    },
    {
      prop: 'organization',
      label: '使用部门',
      minWidth: 145,
      showOverflowTooltip: true,
      formatter: (row) => row.equipment.organizationName
    },
    {
      prop: 'nextDueDate',
      label: '下次检验',
      width: 118,
      formatter: (row) => formatTableDate3(row.nextDueDate)
    },
    {
      prop: 'extensionDate',
      label: '延期安排',
      width: 126,
      formatter: (row) =>
        row.needsExtension && row.extensionDate ? formatTableDate(row.extensionDate) : '无需延期'
    },
    {
      prop: 'images',
      label: '检验图片',
      width: 108,
      formatter: (row) =>
        row.images.length ? (
          <button
            type="button"
            class="inspection-page__preview"
            aria-label={`预览 ${row.images.length} 张检验图片`}
            onClick={() => useImageViewer(row.images.map((image) => image.url))}
          >
            <img
              src={row.images[0].url}
              alt={`${row.equipment.equipmentName}检验图片`}
              width="44"
              height="32"
            />
            <span>{row.images.length} 张</span>
          </button>
        ) : (
          '—'
        )
    },
    {
      prop: 'status',
      label: '状态',
      width: 100,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEquipmentInspectionStatus" value={row.status} />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex gap-1">
          <ArtButtonTable
            permission="SmisInspectionDeclaration:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            permission="SmisInspectionDeclaration:Delete"
            type="delete"
            onClick={async () => {
              await confirmDelete(`确定删除检验申报“${row.inspectionNo}”吗？`)
              await deleteEquipmentInspections([row.id])
              await refreshTable()
            }}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchEquipmentInspectionList({
      ...buildSupabasePageRange(params),
      ...params
    })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }
  const refreshTable = async (): Promise<void> => {
    await tableQueryRef.value?.getData()
  }

  const loadCategories = async (): Promise<void> => {
    categoriesLoading.value = true
    categoryLoadError.value = null
    inspectionCategoryOptions.value = []
    try {
      const categories = await loadAllDocumentPages<
        SmisInspectionCategory,
        SmisInspectionCategorySearchParams
      >((params) => fetchInspectionCategoryList(params, { showErrorMessage: false }), {
        status: 'enabled'
      })
      inspectionCategoryOptions.value = categories
        .filter((item) => item.id)
        .map((item) => ({ label: item.categoryName, value: item.id || '' }))
    } catch (error) {
      categoryLoadError.value = error
    } finally {
      categoriesLoading.value = false
    }
  }
  onMounted(async () => {
    const [organizations] = await Promise.all([
      fetchOrganizationOptionsTree({ status: '1' }),
      loadCategories(),
      ...[
        'smisEquipmentInspectionConclusion',
        'smisEquipmentInspectionReminderMonths',
        'smisEquipmentInspectionStatus'
      ].map((code) => userStore.ensureDictLoaded(code))
    ])
    organizationTree.value = organizations.data ?? []
  })
</script>

<style scoped lang="scss">
  .inspection-page {
    &__code {
      font-weight: 600;
      color: var(--theme-color);
    }

    :deep(.inspection-page__equipment) {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;

      > span:first-child {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
        border-radius: var(--el-border-radius-base);
      }

      > span:last-child {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.inspection-page__preview) {
      display: inline-flex;
      gap: 7px;
      align-items: center;
      justify-content: center;
      min-width: 82px;
      height: 38px;
      padding: 2px 8px 2px 2px;
      overflow: hidden;
      font-size: 12px;
      font-weight: 500;
      line-height: 18px;
      color: var(--theme-color);
      cursor: pointer;
      background: color-mix(in srgb, var(--theme-color) 4%, var(--el-bg-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--el-border-color));
      border-radius: var(--el-border-radius-small);
      transition:
        color var(--el-transition-duration-fast),
        background-color var(--el-transition-duration-fast),
        border-color var(--el-transition-duration-fast);

      &:hover {
        background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
        border-color: color-mix(in srgb, var(--theme-color) 34%, var(--el-border-color));
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }
    }

    :deep(.inspection-page__preview img) {
      display: block;
      width: 44px;
      height: 32px;
      object-fit: cover;
      border-radius: var(--art-surface-radius);
    }
  }
</style>
