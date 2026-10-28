<template>
  <ArtPermissionGuard permission="SmisToolIssuanceStandard:View">
    <div class="issuance-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="TOOL ENTITLEMENT"
        title="工器具发放标准"
        description="按岗位与组织统一配置工器具定额、周期和频次，为个人标准生成提供唯一业务口径。"
        icon="ri:tools-line"
        :tags="[
          { label: '3 位流水编号', type: 'primary', effect: 'plain' },
          { label: '岗位与组织多选', type: 'success', effect: 'light' },
          { label: '物料明细联动', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableQueryRef"
        :model-value="searchQuery"
        @update:model-value="replaceReactiveModel(searchQuery, $event)"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 72, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无发放标准',
          emptyDescription: '点击新增标准，建立第一套工器具发放口径。'
        }"
        focusable
      />
      <IssuanceStandardDialog ref="dialogRef" kind="tool" @success="refresh" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import { replaceReactiveModel } from '@/utils/form/model'
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteToolIssuanceStandards,
    fetchToolIssuanceStandardList,
    type SmisToolIssuanceStandard,
    type SmisToolIssuanceStandardOverview,
    type SmisToolIssuanceStandardSearchParams
  } from '@smis/api'
  import IssuanceStandardDialog, {
    type IssuanceStandardDialogExpose
  } from '../../shared/issuance-standard-dialog.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisToolIssuanceStandard' })
  type TableParams = SmisToolIssuanceStandardSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  const userStore = useUserStore()
  const { confirmDelete } = useArtFeedback()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<IssuanceStandardDialogExpose>()
  const searchQuery = reactive<SmisToolIssuanceStandardSearchParams>({})
  const overview = reactive<SmisToolIssuanceStandardOverview>({
    total: 0,
    enabled: 0,
    disabled: 0,
    detailTotal: 0
  })
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '标准总数',
      value: overview.total,
      description: '当前租户统一口径',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '启用中',
      value: overview.enabled,
      description: '参与个人标准生成',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '工器具明细',
      value: overview.detailTotal,
      description: '标准内物料配置',
      icon: 'ri:archive-stack-line'
    },
    {
      label: '已停用',
      value: overview.disabled,
      description: '保留历史不再生成',
      icon: 'ri:pause-circle-line',
      tone: 'warning'
    }
  ])
  const statusOptions = computed(() =>
    (userStore.getDictMap.commonEnabledStatus ?? []).map(toDictionaryOption)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '标准信息',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '搜索标准编号或名称' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'select',
      options: statusOptions.value,
      props: { clearable: true, placeholder: '全部状态' }
    }
  ])
  const openDialog = (row?: SmisToolIssuanceStandard) => void dialogRef.value?.handleOpen({ row })
  const refresh = async () => {
    await tableQueryRef.value?.getData()
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisToolIssuanceStandard:Add',
      type: 'add',
      label: '新增标准',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisToolIssuanceStandard:Edit',
      label: '编辑',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedCount }) => selectedCount !== 1,
      onClick: ({ selectedRows }) => openDialog(selectedRows[0] as SmisToolIssuanceStandard)
    },
    {
      permission: 'SmisToolIssuanceStandard:Export',
      type: 'export',
      label: '导出',
      exportFilename: '工器具发放标准',
      exportSheetName: '发放标准',
      exportColumns: [
        { key: 'standardNo', title: '标准编号' },
        { key: 'standardName', title: '发放标准名称' },
        { key: 'positions', title: '适用岗位' },
        { key: 'organizations', title: '适用公司/部门' },
        { key: 'ratedQuantity', title: '额定数量' },
        { key: 'issuanceCycle', title: '发放周期' },
        { key: 'issuanceFrequency', title: '发放频次' },
        { key: 'status', title: '状态' }
      ],
      exportApi: async ({ maxRows }) => {
        const result = await fetchToolIssuanceStandardList({
          ...searchQuery,
          purpose: 'export',
          from: 0,
          to: maxRows - 1
        })
        return {
          data: result.data.map((row) => ({
            ...row,
            positions: row.positions.map((item) => item.name).join('、'),
            organizations: row.organizations.map((item) => item.name).join('、')
          }))
        }
      }
    },
    {
      permission: 'SmisToolIssuanceStandard:Delete',
      type: 'delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条发放标准吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteToolIssuanceStandards(selectedRows.map((row) => String(row.id)))
        await api.refreshRemove()
      }
    }
  ])
  const columnsFactory = (): ColumnOption<SmisToolIssuanceStandard>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'standardNo',
      label: '标准编号',
      width: 150,
      fixed: 'left',
      formatter: (row) => <strong class="standard-no">{row.standardNo}</strong>
    },
    { prop: 'standardName', label: '发放标准名称', minWidth: 210, showOverflowTooltip: true },
    {
      prop: 'positions',
      label: '适用岗位',
      minWidth: 190,
      showOverflowTooltip: true,
      formatter: (row) => row.positions.map((item) => item.name).join('、') || '全部岗位'
    },
    {
      prop: 'organizations',
      label: '适用公司 / 部门',
      minWidth: 190,
      showOverflowTooltip: true,
      formatter: (row) => row.organizations.map((item) => item.name).join('、') || '全部组织'
    },
    {
      prop: 'details',
      label: '工器具明细',
      width: 100,
      align: 'center',
      formatter: (row) => `${row.details.length} 项`
    },
    { prop: 'ratedQuantity', label: '额定数量', width: 100, align: 'right' },
    {
      prop: 'issuanceCycle',
      label: '发放周期',
      width: 110,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonIssuanceCycle" value={row.issuanceCycle} display="tag" />
      )
    },
    {
      prop: 'issuanceFrequency',
      label: '频次',
      width: 90,
      align: 'center',
      formatter: (row) => `${row.issuanceFrequency} 次`
    },
    {
      prop: 'status',
      label: '状态',
      width: 100,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonEnabledStatus" value={row.status} display="tag" />
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
      width: 154,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            permission="SmisToolIssuanceStandard:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            permission="SmisToolIssuanceStandard:Delete"
            type="delete"
            onClick={async () => {
              await confirmDelete(`确定删除发放标准“${row.standardName}”吗？`)
              await deleteToolIssuanceStandards([row.id])
              await refresh()
            }}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchToolIssuanceStandardList({
      ...buildSupabasePageRange(params),
      ...params
    })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }
  onMounted(
    () =>
      void Promise.all(
        ['commonIssuanceCycle', 'commonEnabledStatus', 'smisMaterialUnit'].map((code) =>
          userStore.ensureDictLoaded(code)
        )
      )
  )
</script>

<style scoped lang="scss">
  .issuance-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
  }

  :deep(.standard-no) {
    font-variant-numeric: tabular-nums;
    color: var(--theme-color);
  }
</style>
