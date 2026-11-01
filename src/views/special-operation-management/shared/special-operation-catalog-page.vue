<template>
  <ArtPermissionGuard :permission="viewPermission" :resource-name="title">
    <div class="special-operation-catalog-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="SPECIAL OPERATION CONFIGURATION"
        :title="title"
        :description="description"
        :icon="pageIcon"
        :tags="[
          { label: '租户级配置', type: 'primary', effect: 'plain' },
          { label: '按作业类型归集', type: 'warning', effect: 'light' },
          { label: '支持作废留痕', type: 'success', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions>
          <BusinessTableWorkspaceActions :table="tableQueryRef" />
        </template>
      </BusinessWorkspaceHeader>

      <div class="special-operation-catalog-page__workspace">
        <aside class="special-operation-catalog-page__navigator" aria-label="作业类型导航">
          <OperationTypeNavigator
            :data="navigation.data"
            :loading="navigation.loading"
            :error="navigation.error"
            :selected-id="navigation.selectedId"
            @select="handleTypeSelect"
            @refresh="loadOperationTypes"
          />
        </aside>

        <main class="special-operation-catalog-page__table">
          <ArtTableQuery
            ref="tableQueryRef"
            v-model="table.searchQuery"
            :api-fn="fetchTableData"
            :search-items="table.searchItems"
            :columns-factory="columnsFactory"
            :header-actions="table.headerActions"
            :search-bar-props="{
              span: catalogKind === 'site_analysis' ? 6 : 8,
              labelWidth: 76,
              showExpand: false
            }"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: `暂无${title}配置`,
              emptyDescription: navigation.selectedId
                ? `可为当前作业类型新增${singular}。`
                : `可先从左侧选择作业类型，再新增${singular}。`
            }"
            focusable
            focus-scope-selector=".special-operation-catalog-page__workspace"
          />
        </main>
      </div>

      <SpecialOperationCatalogDialog
        ref="dialogRef"
        :catalog-kind="catalogKind"
        :title="title"
        :singular="singular"
        :item-label="itemLabel"
        @success="handleSaveSuccess"
      />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import { ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteSpecialOperationCatalogItems,
    fetchSpecialOperationCatalogList,
    fetchSpecialOperationTypeList,
    voidSpecialOperationCatalogItems,
    type SmisSpecialOperationCatalogItem,
    type SmisSpecialOperationCatalogKind,
    type SmisSpecialOperationCatalogOverview,
    type SmisSpecialOperationCatalogSearchParams,
    type SmisSpecialOperationRecordType,
    type SmisSpecialOperationType,
    type SmisSpecialOperationTypeSearchParams
  } from '@smis/api'
  import OperationTypeNavigator from './operation-type-navigator.vue'
  import SpecialOperationCatalogDialog, {
    type SpecialOperationCatalogDialogOpenData
  } from './special-operation-catalog-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_special_operation_catalog_item',
    '作业配置'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  const props = defineProps<{
    catalogKind: SmisSpecialOperationCatalogKind
    title: string
    singular: string
    itemLabel: string
    description: string
    pageIcon: string
    viewPermission: string
    addPermission: string
    editPermission: string
    deletePermission: string
    exportPermission: string
    voidPermission: string
  }>()

  type TableParams = Omit<SmisSpecialOperationCatalogSearchParams, 'catalogKind'> &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface DialogExpose {
    handleOpen: (data: SpecialOperationCatalogDialogOpenData) => Promise<void>
  }

  interface NavigationGroup {
    data: SmisSpecialOperationType[]
    loading: boolean
    error: string | null
    selectedId: string | null
  }

  interface TableGroup {
    searchQuery: Omit<SmisSpecialOperationCatalogSearchParams, 'catalogKind'>
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
  }

  const { confirm } = useArtFeedback()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { getDictMap, getUserInfo } = storeToRefs(userStore)
  const { effectiveTenantId, selectedTenant, revision, scopeLabel, isPlatformScope } =
    storeToRefs(tenantScopeStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const navigation = reactive<NavigationGroup>({
    data: [],
    loading: false,
    error: null,
    selectedId: null
  })
  const overview = reactive<SmisSpecialOperationCatalogOverview>({
    total: 0,
    enabled: 0,
    disabled: 0,
    voided: 0
  })

  const statusOptions = computed(() =>
    (getDictMap.value.commonEnabledDisabledVoidedStatus ?? []).map(toDictionaryOption)
  )
  const recordTypeOptions = computed(() =>
    (getDictMap.value.smisSpecialOperationRecordType ?? []).map((item) => ({
      label: item.label || item.name,
      value: item.value as SmisSpecialOperationRecordType
    }))
  )
  const tagStyleOptions = computed(() =>
    (getDictMap.value.smisTagStyle ?? []).map(toDictionaryOption)
  )
  const selectedOperationType = computed(() =>
    navigation.data.find((item) => item.id === navigation.selectedId)
  )
  const canAdd = computed(
    () =>
      navigation.data.some((item) => item.status === 'enabled') &&
      (!selectedOperationType.value || selectedOperationType.value.status === 'enabled')
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: `${props.singular}总数`,
      value: overview.total,
      description: isPlatformScope.value ? `${scopeLabel.value}配置` : '当前租户配置',
      icon: 'ri:list-check-3'
    },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可用于新建作业票',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '已禁用',
      value: overview.disabled,
      description: '保留历史引用',
      icon: 'ri:forbid-2-line',
      tone: 'warning'
    },
    {
      label: '已作废',
      value: overview.voided,
      description: '不可恢复使用',
      icon: 'ri:archive-line'
    }
  ])

  const exportColumns = computed<ArtTableQueryExcelColumn[]>(() => [
    { key: 'operationTypeName', title: '作业类型', required: true },
    { key: 'itemName', title: props.itemLabel, required: true },
    ...(props.catalogKind === 'site_analysis'
      ? [
          { key: 'recordType', title: '记录类型' },
          { key: 'normalValue', title: '正常值' },
          { key: 'abnormalValue', title: '异常值' }
        ]
      : []),
    { key: 'sort', title: '排序' },
    { key: 'textColor', title: '文字颜色' },
    { key: 'tagStyle', title: '标签样式' },
    { key: 'status', title: '状态' },
    { key: 'createTime', title: '创建时间' },
    { key: 'createBy', title: '创建人' }
  ])

  const openDialog = (row?: SmisSpecialOperationCatalogItem): void => {
    const tenantId = row?.tenantId || effectiveTenantId.value
    void dialogRef.value?.handleOpen({
      row,
      operationTypes: navigation.data,
      presetOperationTypeId: navigation.selectedId,
      tenantId,
      tenantName:
        row?.tenantName ||
        selectedTenant.value?.tenantName ||
        getUserInfo.value.tenant?.tenantName ||
        '当前租户'
    })
  }

  const groupIdsByTenant = (rows: SmisSpecialOperationCatalogItem[]): Map<string, string[]> => {
    const result = new Map<string, string[]>()
    rows.forEach((row) => {
      if (!row.id || !row.tenantId) return
      const ids = result.get(row.tenantId) ?? []
      ids.push(row.id)
      result.set(row.tenantId, ids)
    })
    return result
  }

  const deleteRows = async (rows: SmisSpecialOperationCatalogItem[]): Promise<void> => {
    await Promise.all(
      [...groupIdsByTenant(rows).entries()].map(([tenantId, ids]) =>
        deleteSpecialOperationCatalogItems(props.catalogKind, ids, tenantId)
      )
    )
  }

  const voidRows = async (rows: SmisSpecialOperationCatalogItem[]): Promise<void> => {
    await Promise.all(
      [...groupIdsByTenant(rows).entries()].map(([tenantId, ids]) =>
        voidSpecialOperationCatalogItems(props.catalogKind, ids, tenantId)
      )
    )
  }

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: props.addPermission,
      type: 'add',
      label: `新增${props.singular}`,
      disabled: !canAdd.value,
      onClick: () => openDialog()
    },
    {
      permission: props.exportPermission,
      type: 'export',
      exportFilename: `${props.title}配置`,
      exportSheetName: props.title,
      exportColumns: exportColumns.value,
      exportApi: async ({ selectedIds, searchParams }) => {
        const query: SmisSpecialOperationCatalogSearchParams = {
          ...searchParams,
          catalogKind: props.catalogKind,
          operationTypeId: navigation.selectedId,
          tenantId: effectiveTenantId.value
        }
        const selected = new Set(selectedIds.map(String))
        const rows = await loadAllDocumentPages(fetchSpecialOperationCatalogList, query)
        await Promise.all([
          userStore.ensureDictLoaded('commonEnabledDisabledVoidedStatus'),
          userStore.ensureDictLoaded('smisSpecialOperationRecordType')
        ])
        return {
          data: rows
            .filter((row) => !selected.size || selected.has(row.id))
            .map((row) => ({
              ...row,
              recordType: row.recordType
                ? recordTypeOptions.value.find((item) => item.value === row.recordType)?.label ||
                  row.recordType
                : '',
              status:
                statusOptions.value.find((item) => item.value === row.status)?.label || row.status
            }))
        }
      }
    },
    {
      key: 'void',
      permission: props.voidPermission,
      label: '作废',
      icon: 'ri:forbid-line',
      selectionRequired: true,
      confirm: true,
      confirmTitle: '作废确认',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定作废选中的 ${selectedCount} 个${props.singular}吗？作废后不可恢复使用。`,
      disabled: ({ selectedRows }) =>
        selectedRows.every((row) => (row as SmisSpecialOperationCatalogItem).status === 'voided'),
      onClick: async ({ selectedRows, api }) => {
        await voidRows(
          (selectedRows as SmisSpecialOperationCatalogItem[]).filter(
            (row) => row.status !== 'voided'
          )
        )
        await api.refreshUpdate()
      }
    },
    {
      permission: props.deletePermission,
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个${props.singular}吗？删除后无法恢复。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.itemName ?? '作业配置')
          })),
          permission: props.deletePermission,
          remove: async () => {
            await deleteRows(selectedRows as SmisSpecialOperationCatalogItem[])
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])

  const table = reactive<TableGroup>({
    searchQuery: {},
    searchItems: computed(() => [
      {
        label: '关键字',
        key: 'keyword',
        type: 'input',
        props: { clearable: true, placeholder: `${props.itemLabel}或作业类型` }
      },
      ...(props.catalogKind === 'site_analysis'
        ? [
            {
              label: '记录类型',
              key: 'recordType',
              type: 'select' as const,
              props: { options: recordTypeOptions.value, clearable: true, placeholder: '全部类型' }
            }
          ]
        : []),
      {
        label: '状态',
        key: 'status',
        type: 'select',
        props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
      },
      {
        label: '标签样式',
        key: 'tagStyle',
        type: 'tagStyleSelect',
        props: { options: tagStyleOptions.value, clearable: true, placeholder: '全部样式' }
      }
    ]),
    headerActions
  })

  const renderItemPreview = (row: SmisSpecialOperationCatalogItem) =>
    row.tagStyle ? (
      <ElTag type={row.tagStyle}>{row.itemName}</ElTag>
    ) : (
      <span
        class="special-operation-catalog-page__plain-preview"
        style={{ color: row.textColor || undefined }}
        title={row.itemName}
      >
        <i style={{ backgroundColor: row.textColor || 'var(--theme-color)' }} aria-hidden="true" />
        {row.itemName}
      </span>
    )

  const columnsFactory = (): ColumnOption<SmisSpecialOperationCatalogItem>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'operationTypeName',
      label: '作业类型',
      minWidth: 176,
      formatter: (row) => (
        <div class="special-operation-catalog-page__type-cell">
          <ArtSvgIcon icon="ri:tools-line" />
          <span>
            <strong title={row.operationTypeName}>{row.operationTypeName}</strong>
            <small>{row.operationTypeCode}</small>
          </span>
        </div>
      )
    },
    {
      prop: 'itemName',
      label: props.itemLabel,
      minWidth: 240,
      fixed: 'left',
      formatter: renderItemPreview
    },
    ...(props.catalogKind === 'site_analysis'
      ? [
          {
            prop: 'recordType',
            label: '记录类型',
            width: 106,
            align: 'center' as const,
            formatter: (row: SmisSpecialOperationCatalogItem) => (
              <ArtDictDisplay
                dictCode="smisSpecialOperationRecordType"
                value={row.recordType || ''}
                display="tag"
              />
            )
          },
          { prop: 'normalValue', label: '正常值', minWidth: 150, showOverflowTooltip: true },
          { prop: 'abnormalValue', label: '异常值', minWidth: 150, showOverflowTooltip: true }
        ]
      : []),
    { prop: 'sort', label: '排序', width: 76, align: 'center' },
    {
      prop: 'textColor',
      label: '文字颜色',
      width: 132,
      formatter: (row) =>
        row.textColor ? (
          <span class="special-operation-catalog-page__color-value">
            <i style={{ backgroundColor: row.textColor }} aria-hidden="true" />
            {row.textColor.toUpperCase()}
          </span>
        ) : (
          <span class="special-operation-catalog-page__unset">未设置</span>
        )
    },
    {
      prop: 'tagStyle',
      label: '标签样式',
      width: 108,
      align: 'center',
      formatter: (row) =>
        row.tagStyle ? (
          <ElTag type={row.tagStyle} effect="plain">
            {tagStyleOptions.value.find((item) => item.value === row.tagStyle)?.label}
          </ElTag>
        ) : (
          <span class="special-operation-catalog-page__unset">未设置</span>
        )
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
    { prop: 'createBy', label: '创建人', width: 138, showOverflowTooltip: true },
    {
      prop: 'createTime',
      label: '创建时间',
      width: 164,
      formatter: (row) => formatTableDateTime(row.createTime)
    },
    ...(isPlatformScope.value
      ? [
          {
            prop: 'tenantName',
            label: '所属租户',
            minWidth: 180,
            formatter: (row: SmisSpecialOperationCatalogItem) =>
              row.tenantName ? (
                <BusinessTableIdentityCell primary={row.tenantName} secondary={row.tenantCode} />
              ) : (
                '—'
              )
          }
        ]
      : []),
    {
      prop: 'operation',
      label: '操作',
      width: 160,
      fixed: 'right',
      formatter: (row) => (
        <div class="special-operation-catalog-page__actions">
          <ArtButtonTable
            type="edit"
            permission={props.editPermission}
            label={`编辑${props.singular}`}
            disabled={row.status === 'voided'}
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="edit"
            icon="ri:forbid-line"
            iconColor="var(--el-color-warning)"
            permission={props.voidPermission}
            label={`作废${props.singular}`}
            disabled={row.status === 'voided'}
            onClick={() => void handleVoid(row)}
          />
          <ArtButtonTable
            type="delete"
            permission={props.deletePermission}
            label={`删除${props.singular}`}
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const response = await fetchSpecialOperationCatalogList({
      catalogKind: props.catalogKind,
      keyword: params.keyword,
      operationTypeId: navigation.selectedId,
      recordType: params.recordType,
      status: params.status,
      tagStyle: params.tagStyle,
      tenantId: effectiveTenantId.value,
      ...buildSupabasePageRange({ current: params.current, size: params.size })
    })
    if (!options?.signal?.aborted) Object.assign(overview, response.overview)
    return response
  }

  const loadOperationTypes = async (): Promise<void> => {
    navigation.loading = true
    navigation.error = null
    try {
      navigation.data = await loadAllDocumentPages<
        SmisSpecialOperationType,
        SmisSpecialOperationTypeSearchParams
      >(fetchSpecialOperationTypeList, { tenantId: effectiveTenantId.value })
      if (
        navigation.selectedId &&
        !navigation.data.some(
          (item) => item.id === navigation.selectedId && item.status !== 'voided'
        )
      ) {
        navigation.selectedId = null
      }
    } catch {
      navigation.error = '作业类型加载失败，请重试。'
    } finally {
      navigation.loading = false
    }
  }

  const handleTypeSelect = (id: string | null): void => {
    navigation.selectedId = id
    tableQueryRef.value?.clearSelection()
    void tableQueryRef.value?.getData()
  }

  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }

  const handleVoid = async (row: SmisSpecialOperationCatalogItem): Promise<void> => {
    if (row.status === 'voided') return
    try {
      await confirm(`确定作废${props.singular}“${row.itemName}”吗？作废后不可恢复使用。`, {
        title: '作废确认',
        confirmButtonText: '作废',
        confirmButtonType: 'warning'
      })
      await voidSpecialOperationCatalogItems(props.catalogKind, [row.id ?? ''], row.tenantId)
      await tableQueryRef.value?.refreshUpdate()
    } catch {
      /* 用户取消 */
    }
  }

  const handleDelete = async (row: SmisSpecialOperationCatalogItem): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.itemName ?? '作业配置')
        }
      ],
      permission: props.deletePermission,
      confirmMessage: `确定删除${props.singular}“${row.itemName}”吗？删除后无法恢复。`,
      remove: async () => {
        await deleteSpecialOperationCatalogItems(props.catalogKind, [row.id ?? ''], row.tenantId)
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }

  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('commonEnabledDisabledVoidedStatus'),
      userStore.ensureDictLoaded('smisSpecialOperationRecordType'),
      userStore.ensureDictLoaded('smisTagStyle'),
      tenantScopeStore.loadTenantOptions(),
      loadOperationTypes()
    ])
  })

  watch(revision, async () => {
    navigation.selectedId = null
    await loadOperationTypes()
    const tableQuery = tableQueryRef.value
    tableQuery?.clearSelection()
    void tableQuery?.refreshContext()
  })
</script>

<style scoped lang="scss">
  .special-operation-catalog-page {
    gap: 12px;
    min-width: 0;

    &__workspace {
      display: grid;
      flex: 1;
      grid-template-columns: minmax(260px, 292px) minmax(0, 1fr);
      gap: 12px;
      min-width: 0;
      min-height: 0;
    }

    &__navigator,
    &__table {
      min-width: 0;
      min-height: 0;
    }

    &__table {
      display: flex;

      > :deep(.art-table-query) {
        width: 100%;
        min-width: 0;
      }
    }

    :deep(.special-operation-catalog-page__type-cell) {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      gap: 9px;
      align-items: center;
      min-width: 0;

      > svg {
        width: 32px;
        height: 32px;
        padding: 7px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
        border-radius: var(--el-border-radius-base);
      }

      > span,
      strong,
      small {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.special-operation-catalog-page__plain-preview),
    :deep(.special-operation-catalog-page__color-value) {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      max-width: 100%;

      i {
        flex: 0 0 auto;
        width: 10px;
        height: 10px;
        border: 1px solid color-mix(in srgb, currentcolor 18%, transparent);
        border-radius: 50%;
      }
    }

    :deep(.special-operation-catalog-page__plain-preview) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.special-operation-catalog-page__color-value) {
      font-size: 12px;
      color: var(--el-text-color-regular);
    }

    :deep(.special-operation-catalog-page__unset) {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }

    :deep(.special-operation-catalog-page__actions) {
      display: flex;
      align-items: center;
    }

    @media (width <= 1100px) {
      &__workspace {
        grid-template-columns: minmax(224px, 248px) minmax(0, 1fr);
      }
    }

    @media (width <= 820px) {
      &__workspace {
        grid-template-rows: auto minmax(520px, 1fr);
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }
</style>
