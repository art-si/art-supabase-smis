<template>
  <ArtPermissionGuard permission="SmisWorkInjuryDeclaration:View">
    <div class="injury-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="INJURY DECLARATION"
        title="工伤申报"
        description="从事故快报发起工伤申报，统一管理申报人、所属部门与伤害类型。"
        icon="ri:first-aid-kit-line"
        :tags="[
          { label: '事故单据联动', type: 'primary', effect: 'plain' },
          { label: '人员组织自动带入', type: 'success', effect: 'light' },
          { label: '类型快速筛选', type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>

      <nav class="injury-page__filters" aria-label="按工伤类型筛选">
        <button
          v-for="item in quickFilters"
          :key="item.value || 'all'"
          type="button"
          :class="{ 'is-active': searchQuery.injuryType === item.value }"
          :aria-pressed="searchQuery.injuryType === item.value"
          @click="setInjuryType(item.value)"
        >
          <span :class="item.tone"><ArtSvgIcon :icon="item.icon" /></span>
          <span
            ><strong>{{ item.label }}</strong
            ><small>{{ item.count }} 条</small></span
          >
        </button>
      </nav>

      <ArtTableQuery
        ref="tableRef"
        v-model="searchQuery"
        class="injury-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 76, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无工伤申报',
          emptyDescription: '可点击新增，从事故快报关联创建工伤申报。'
        }"
        focusable
      />
      <WorkInjuryDialog ref="dialogRef" @success="handleSaveSuccess" />
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
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import {
    deleteWorkInjuryDeclarations,
    fetchWorkInjuryDeclarationList,
    type SmisAccidentEmployee,
    type SmisWorkInjuryDeclaration,
    type SmisWorkInjurySearchParams,
    type SmisWorkInjuryType
  } from '@smis/api'
  import WorkInjuryDialog, { type WorkInjuryDialogOpenData } from './modules/work-injury-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_work_injury_declaration',
    '工伤申报'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })

  defineOptions({ name: 'SmisWorkInjuryDeclaration' })
  interface InjurySearchModel extends SmisWorkInjurySearchParams {
    declarationDateRange?: [string, string]
  }
  type TableParams = InjurySearchModel & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: WorkInjuryDialogOpenData) => Promise<void>
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<InjurySearchModel>({})
  const currentEmployee = shallowRef<SmisAccidentEmployee | null>(null)
  const overview = reactive({ total: 0, slight: 0, minor: 0, serious: 0, fatal: 0 })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '申报总数',
      value: overview.total,
      description: '当前租户全部申报',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '轻微伤 / 轻伤',
      value: overview.slight + overview.minor,
      description: '常规跟踪记录',
      icon: 'ri:heart-pulse-line',
      tone: 'success'
    },
    {
      label: '重伤',
      value: overview.serious,
      description: '需重点处置',
      icon: 'ri:hospital-line',
      tone: 'warning'
    },
    {
      label: '死亡',
      value: overview.fatal,
      description: '最高等级关注',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const quickFilters = computed(() => [
    { label: '全部', value: undefined, count: overview.total, icon: 'ri:apps-line', tone: '' },
    {
      label: '轻微伤',
      value: 'slight' as const,
      count: overview.slight,
      icon: 'ri:first-aid-kit-line',
      tone: 'is-success'
    },
    {
      label: '轻伤',
      value: 'minor' as const,
      count: overview.minor,
      icon: 'ri:first-aid-kit-line',
      tone: 'is-primary'
    },
    {
      label: '重伤',
      value: 'serious' as const,
      count: overview.serious,
      icon: 'ri:hospital-line',
      tone: 'is-warning'
    },
    {
      label: '死亡',
      value: 'fatal' as const,
      count: overview.fatal,
      icon: 'ri:alarm-warning-line',
      tone: 'is-danger'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '申报编号、姓名或事故' }
    },
    {
      label: '工伤类型',
      key: 'injuryType',
      type: 'select',
      props: {
        options: dictOptions('smisWorkInjuryType'),
        clearable: true,
        placeholder: '全部类型'
      }
    },
    {
      label: '申报时间',
      key: 'declarationDateRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        clearable: true
      }
    }
  ])
  const setInjuryType = (value?: SmisWorkInjuryType): void => {
    searchQuery.value.injuryType = value
    void tableRef.value?.getData()
  }
  const openDialog = (row?: SmisWorkInjuryDeclaration): void => {
    void dialogRef.value?.handleOpen({ row, currentEmployee: currentEmployee.value })
  }
  const handleDelete = async (row: SmisWorkInjuryDeclaration): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.declarationNo ?? '工伤申报')
        }
      ],
      permission: 'SmisWorkInjuryDeclaration:Delete',
      confirmMessage: `确定删除工伤申报“${row.declarationNo}”吗？`,
      remove: async () => {
        await deleteWorkInjuryDeclarations([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableRef.value?.refreshRemove()
      }
    })
  }
  const columnsFactory = (): ColumnOption<SmisWorkInjuryDeclaration>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'declarationNo',
      label: '申报信息',
      minWidth: 210,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.declarantNameSnapshot}
          secondary={row.declarationNo}
          icon="ri:first-aid-kit-line"
          iconTone={
            row.injuryType === 'fatal'
              ? 'danger'
              : row.injuryType === 'serious'
                ? 'warning'
                : 'primary'
          }
        />
      )
    },
    { prop: 'declarationDate', label: '申报时间', width: 118 },
    {
      prop: 'accident',
      label: '关联事故名称',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.accident.accidentName
    },
    {
      prop: 'accidentNo',
      label: '事故单号',
      width: 158,
      formatter: (row) => row.accident.accidentNo
    },
    {
      prop: 'departmentNameSnapshot',
      label: '所在部门',
      minWidth: 170,
      showOverflowTooltip: true,
      formatter: (row) => row.departmentNameSnapshot || '未分配组织'
    },
    {
      prop: 'injuryType',
      label: '工伤类型',
      width: 108,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisWorkInjuryType" value={row.injuryType} display="tag" />
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 158,
      formatter: (row) => formatTableDateTime(row.updateTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) => (
        <div>
          <ArtButtonTable
            type="edit"
            permission="SmisWorkInjuryDeclaration:Edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisWorkInjuryDeclaration:Delete"
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'declarationNo', title: '申报编号' },
    { key: 'declarationDate', title: '申报时间' },
    { key: 'accidentName', title: '关联事故名称' },
    { key: 'accidentNo', title: '事故单号' },
    { key: 'declarantName', title: '姓名' },
    { key: 'departmentName', title: '所在部门' },
    { key: 'injuryType', title: '工伤类型' }
  ]
  const toApiParams = (params: InjurySearchModel): SmisWorkInjurySearchParams => {
    const { declarationDateRange, ...rest } = params
    return { ...rest, startDate: declarationDateRange?.[0], endDate: declarationDateRange?.[1] }
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisWorkInjuryDeclaration:Add',
      type: 'add',
      label: '新增工伤申报',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisWorkInjuryDeclaration:Export',
      type: 'export',
      label: '导出',
      exportFilename: '工伤申报',
      exportSheetName: '工伤申报',
      exportColumns: excelColumns,
      exportApi: async ({ selectedIds, maxRows }) => {
        const rows = (
          await fetchWorkInjuryDeclarationList({
            ...toApiParams(searchQuery.value),
            ids: selectedIds?.map(String),
            from: 0,
            to: maxRows - 1
          })
        ).data
        return {
          data: rows.map((row) => ({
            declarationNo: row.declarationNo,
            declarationDate: row.declarationDate,
            accidentName: row.accident.accidentName,
            accidentNo: row.accident.accidentNo,
            declarantName: row.declarantNameSnapshot,
            departmentName: row.departmentNameSnapshot || '',
            injuryType:
              userStore.getDictLabelByValue('smisWorkInjuryType', row.injuryType) || row.injuryType
          }))
        }
      }
    },
    {
      permission: 'SmisWorkInjuryDeclaration:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条工伤申报吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.declarationNo ?? '工伤申报')
          })),
          permission: 'SmisWorkInjuryDeclaration:Delete',
          remove: async () => {
            await deleteWorkInjuryDeclarations(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { current, size, ...filters } = params
    const { from, to } = buildSupabasePageRange({ current, size })
    const result = await fetchWorkInjuryDeclarationList({ ...toApiParams(filters), from, to })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    currentEmployee.value = result.currentEmployee
    return result
  }
  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add' ? tableRef.value?.refreshCreate() : tableRef.value?.refreshUpdate())
  }
  onMounted(() => userStore.ensureDictLoaded('smisWorkInjuryType'))
</script>

<style scoped lang="scss">
  .injury-page {
    gap: 12px;
    min-width: 0;

    &__filters {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }

    &__filters button {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 9px;
      align-items: center;
      min-width: 0;
      padding: 10px 12px;
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
      transition:
        border-color 0.16s ease,
        box-shadow 0.16s ease;

      &:hover,
      &:focus-visible {
        outline: none;
        border-color: var(--theme-color);
      }

      &.is-active {
        border-color: var(--theme-color);
        box-shadow: inset 0 0 0 1px var(--theme-color);
      }

      > span:first-child {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        color: var(--el-text-color-secondary);
        background: var(--el-fill-color-light);
        border-radius: 50%;
      }

      > span:first-child.is-success {
        color: var(--el-color-success);
        background: var(--el-color-success-light-9);
      }

      > span:first-child.is-primary {
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }

      > span:first-child.is-warning {
        color: var(--el-color-warning-dark-2);
        background: var(--el-color-warning-light-9);
      }

      > span:first-child.is-danger {
        color: var(--el-color-danger);
        background: var(--el-color-danger-light-9);
      }

      > span:last-child {
        display: grid;
        min-width: 0;
      }

      strong {
        font-size: 13px;
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 2px;
        color: var(--el-text-color-secondary);
      }
    }

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    @media (width <= 900px) {
      &__filters {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (width <= 560px) {
      &__filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  }
</style>
