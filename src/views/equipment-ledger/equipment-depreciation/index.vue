<template>
  <div class="equipment-depreciation-page business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      eyebrow="DEPRECIATION METHODS"
      title="折旧方法"
      description="统一维护折旧名称、折旧年限与逐年折旧率，折旧期限由系统按年限自动换算。"
      icon="ri:percent-line"
      :tags="[
        { label: '折旧期限自动计算', type: 'primary', effect: 'plain' },
        { label: '年度折旧率', type: 'success', effect: 'light' },
        { label: '租户数据隔离', type: 'info', effect: 'plain' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
    </BusinessWorkspaceHeader>

    <ArtTableQuery
      ref="tableQueryRef"
      v-model="table.searchQuery"
      class="equipment-depreciation-page__table"
      :api-fn="fetchTableData"
      :search-items="table.searchItems"
      :columns-factory="columnsFactory"
      :header-actions="table.headerActions"
      header-actions-placement="workspace"
      :search-bar-props="{ span: 8, labelWidth: 72, showExpand: false }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无折旧方法',
        emptyDescription: '新增折旧方法后，可按折旧年限维护每一年的折旧率。'
      }"
      focusable
    />

    <EquipmentDepreciationDialog ref="dialogRef" @success="refreshTable" />
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </div>
</template>

<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'

  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteEquipmentDepreciations,
    fetchEquipmentDepreciationList,
    type SmisEquipmentDepreciation,
    type SmisEquipmentDepreciationOverview,
    type SmisEquipmentDepreciationSearchParams
  } from '@smis/api'
  import EquipmentDepreciationDialog, {
    type EquipmentDepreciationDialogOpenData
  } from './modules/equipment-depreciation-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_equipment_depreciation',
    '折旧方案'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisEquipmentDepreciation' })

  type TableParams = SmisEquipmentDepreciationSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface DialogExpose {
    handleOpen: (data: EquipmentDepreciationDialogOpenData) => Promise<void>
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const overview = reactive<SmisEquipmentDepreciationOverview>({
    total: 0,
    active: 0,
    averageYears: 0,
    configuredRateCount: 0
  })

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '折旧方法',
      value: overview.total,
      description: '当前租户全部方法',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '启用中',
      value: overview.active,
      description: '当前可用方法',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '平均年限',
      value: `${Number(overview.averageYears || 0)} 年`,
      description: '全部方法平均折旧年限',
      icon: 'ri:calendar-2-line'
    },
    {
      label: '年度配置',
      value: overview.configuredRateCount,
      description: '已维护的年度折旧率',
      icon: 'ri:bar-chart-box-line',
      tone: 'primary'
    }
  ])

  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)

  const openDialog = (row?: SmisEquipmentDepreciation): void => {
    void dialogRef.value?.handleOpen({ row })
  }

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisEquipmentDepreciation:Add',
      type: 'add',
      label: '新增折旧方法',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisEquipmentDepreciation:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个折旧方法吗？`,
      onClick: async ({ selectedRows, api }) => {
        const ids = selectedRows
          .map((row) => row.id)
          .filter((id): id is string => typeof id === 'string')
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.depreciationName ?? '折旧方案')
          })),
          permission: 'SmisEquipmentDepreciation:Delete',
          remove: async () => {
            await deleteEquipmentDepreciations(ids)
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])

  const table = reactive<{
    searchQuery: SmisEquipmentDepreciationSearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
  }>({
    searchQuery: {},
    searchItems: computed(() => [
      {
        label: '关键字',
        key: 'keyword',
        type: 'input',
        props: { clearable: true, placeholder: '折旧编码或折旧名称' }
      },
      {
        label: '状态',
        key: 'status',
        type: 'select',
        props: {
          options: dictOptions('smisEquipmentDepreciationStatus'),
          clearable: true,
          placeholder: '全部状态'
        }
      }
    ]),
    headerActions
  })

  const columnsFactory = (): ColumnOption<SmisEquipmentDepreciation>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 70, fixed: 'left' },
    {
      prop: 'depreciationName',
      label: '折旧方法',
      minWidth: 260,
      fixed: 'left',
      formatter: (row) => (
        <div class="equipment-depreciation-page__identity">
          <span aria-hidden="true">
            <ArtSvgIcon icon="ri:percent-line" />
          </span>
          <span>
            <strong title={row.depreciationName}>{row.depreciationName}</strong>
            <small title={row.depreciationNo}>{row.depreciationNo}</small>
          </span>
        </div>
      )
    },
    {
      prop: 'depreciationYears',
      label: '折旧年限',
      width: 120,
      align: 'right',
      formatter: (row) => `${row.depreciationYears} 年`
    },
    {
      prop: 'depreciationPeriodMonths',
      label: '折旧期限',
      width: 130,
      align: 'right',
      formatter: (row) => `${row.depreciationPeriodMonths} 个月`
    },
    {
      prop: 'annualRates',
      label: '年折旧率',
      minWidth: 170,
      formatter: (row) => (
        <span class="equipment-depreciation-page__rate-summary">
          已配置 {row.annualRates.length} / {row.depreciationYears} 年
        </span>
      )
    },
    {
      prop: 'status',
      label: '状态',
      width: 100,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisEquipmentDepreciationStatus" value={row.status} />
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 165,
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
            permission="SmisEquipmentDepreciation:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            permission="SmisEquipmentDepreciation:Delete"
            type="delete"
            onClick={async () => {
              await deleteRecords({
                resources: [
                  {
                    id: String(row.id ?? ''),
                    label: String(row.depreciationName ?? '折旧方案')
                  }
                ],
                permission: 'SmisEquipmentDepreciation:Delete',
                confirmMessage: `确定删除折旧方法“${row.depreciationName}”吗？`,
                remove: async () => {
                  await deleteEquipmentDepreciations([row.id ?? ''])
                },
                onDeleted: async () => {
                  await refreshTable()
                }
              })
            }}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchEquipmentDepreciationList({
      ...buildSupabasePageRange(params),
      ...params
    })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }

  const refreshTable = async (): Promise<void> => {
    await tableQueryRef.value?.getData()
  }

  onMounted(() => {
    void userStore.ensureDictLoaded('smisEquipmentDepreciationStatus')
  })
</script>

<style scoped lang="scss">
  .equipment-depreciation-page {
    display: flex;
    flex-direction: column;
    min-height: 0;

    &__table {
      flex: 1;
      min-height: 0;
    }

    :deep(.equipment-depreciation-page__identity) {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: var(--art-space-3);
      align-items: center;
      min-width: 0;

      > span:first-child {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
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
        margin-top: var(--art-space-1);
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.equipment-depreciation-page__rate-summary) {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding-inline: var(--art-space-3);
      font-size: var(--art-font-size-caption);
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }
  }
</style>
