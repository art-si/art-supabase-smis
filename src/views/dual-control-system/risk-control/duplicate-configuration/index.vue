<template>
  <ArtPermissionGuard permission="SmisDualControlDuplicateConfiguration:View">
    <div class="duplicate-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="duplicate-page__overview"
        eyebrow="RECURRING BUSINESS RULES"
        title="重复配置"
        description="将重复频次、日历日期和截止时间抽象为租户基础配置，由不同业务菜单按统一规则接入。"
        icon="ri:repeat-2-line"
        density="compact"
        :tags="[
          { label: '菜单可配置', type: 'primary', effect: 'plain' },
          { label: '频次字典驱动', type: 'success', effect: 'light' },
          { label: '日历规则', type: 'info', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableQueryRef"
        class="duplicate-page__table"
        v-model="searchQuery"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 78, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无重复配置',
          emptyDescription: '为业务菜单新增可复用的周期规则。'
        }"
        :on-success="handleSuccess"
        focusable
      />
      <DuplicateDialog ref="dialogRef" @success="handleDialogSuccess" />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>
<script setup lang="tsx">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { toDictionaryOption } from '@/utils/form/option'

  import { useAuth } from '@/hooks/core/useAuth'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { ElTag } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryExcelColumn,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import {
    deleteDuplicateConfigurations,
    fetchConfigurableMenuOptions,
    fetchDuplicateConfigurations,
    voidDuplicateConfigurations,
    type SmisConfigurableMenuOption,
    type SmisDuplicateConfiguration,
    type SmisDuplicateConfigurationSearchParams
  } from '@smis/api'
  import DuplicateDialog, { type DuplicateDialogOpenData } from './modules/duplicate-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_duplicate_configuration',
    '重复配置'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  const smisRiskRepeatFlagOptions = useDictionaryOptions(
    'smisRiskRepeatFlag',
    (value) => value === 'true'
  )
  defineOptions({ name: 'SmisDualControlDuplicateConfiguration' })
  const { hasAnyAuth } = useAuth()
  type TableParams = SmisDuplicateConfigurationSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: DuplicateDialogOpenData) => Promise<void>
  }
  const { confirmAction } = useArtFeedback()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { getDictMap } = storeToRefs(userStore)
  const { effectiveTenantId, revision } = storeToRefs(tenantScopeStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<SmisDuplicateConfigurationSearchParams>({})
  const menus = ref<SmisConfigurableMenuOption[]>([])
  const overview = reactive({ total: 0, repeating: 0, once: 0, enabled: 0 })
  const dictOptions = (code: string) => (getDictMap.value[code] ?? []).map(toDictionaryOption)
  const statusOptions = computed(() => dictOptions('commonEnabledDisabledVoidedStatus'))
  const unitOptions = computed(() => dictOptions('smisFrequencyUnit'))
  const menuOptions = computed(() =>
    menus.value.map((i) => ({
      label: i.parentTitle ? `${i.parentTitle} / ${i.title}` : i.title,
      value: i.id
    }))
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '配置总数',
      value: overview.total,
      description: '当前租户规则',
      icon: 'ri:settings-3-line'
    },
    {
      label: '重复事项',
      value: overview.repeating,
      description: '当前页周期规则',
      icon: 'ri:repeat-2-line',
      tone: 'success'
    },
    { label: '一次性事项', value: overview.once, description: '当前页不重复', icon: 'ri:number-1' },
    {
      label: '已启用',
      value: overview.enabled,
      description: '可供业务读取',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '内容事项' }
    },
    {
      label: '关联菜单',
      key: 'menuId',
      type: 'select',
      props: {
        options: menuOptions.value,
        filterable: true,
        clearable: true,
        placeholder: '全部菜单'
      }
    },
    {
      label: '重复',
      key: 'repeatEnabled',
      type: 'select',
      props: {
        options: smisRiskRepeatFlagOptions,
        clearable: true,
        placeholder: '全部'
      }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions.value, clearable: true, placeholder: '全部状态' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'menuTitle', title: '关联菜单功能', required: true },
    { key: 'contentItem', title: '内容事项', required: true },
    { key: 'repeatEnabled', title: '重复' },
    { key: 'repeatRule', title: '重复规则' },
    { key: 'calendarRule', title: '日历' },
    { key: 'deadlineTime', title: '截止时间' },
    { key: 'sort', title: '排序' },
    { key: 'textColor', title: '文字颜色' },
    { key: 'tagStyle', title: '标签样式' },
    { key: 'status', title: '状态' },
    { key: 'createBy', title: '创建人' }
  ]
  const openDialog = (row?: SmisDuplicateConfiguration) =>
    void dialogRef.value?.handleOpen({
      row,
      tenantId: row?.tenantId || effectiveTenantId.value,
      menus: menus.value
    })
  const menuTitle = (row: SmisDuplicateConfiguration) =>
    menus.value.find((i) => i.id === row.menuId)?.title || row.menu?.title || row.menuId
  const repeatRule = (row: SmisDuplicateConfiguration) =>
    row.repeatEnabled
      ? `每 ${row.repeatFrequency || 1} ${unitOptions.value.find((i) => i.value === row.frequencyUnit)?.label || (row.frequencyUnit ? '未识别频率单位' : '')}`
      : '不重复'
  const calendarRule = (row: SmisDuplicateConfiguration) =>
    row.calendarType === 'week'
      ? `每周 ${row.calendarDays.map((i) => `周${'一二三四五六日'[i - 1]}`).join('、')}`
      : row.calendarType === 'month'
        ? `每月 ${row.calendarDays.join('、')} 日`
        : '不限定'
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlDuplicateConfiguration:Add',
      type: 'add',
      label: '新增重复配置',
      onClick: () => openDialog()
    },
    {
      permission: 'SmisDualControlDuplicateConfiguration:Export',
      type: 'export',
      exportFilename: '重复配置',
      exportSheetName: '重复规则',
      exportColumns: excelColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const exportQuery: SmisDuplicateConfigurationSearchParams = {
          ...(searchParams as SmisDuplicateConfigurationSearchParams),
          tenantId: effectiveTenantId.value,
          ids: selectedIds.map(String)
        }
        const rows = await loadAllDocumentPages(fetchDuplicateConfigurations, exportQuery)
        await Promise.all([
          userStore.ensureDictLoaded('commonEnabledDisabledVoidedStatus'),
          userStore.ensureDictLoaded('smisTagStyle'),
          userStore.ensureDictLoaded('smisFrequencyUnit')
        ])
        return {
          data: rows.map((row) => ({
            ...row,
            status: userStore.getDictLabelByValue('commonEnabledDisabledVoidedStatus', row.status),
            tagStyle: userStore.getDictLabelByValue('smisTagStyle', row.tagStyle),
            menuTitle: menuTitle(row),
            repeatEnabled: row.repeatEnabled ? '重复' : '不重复',
            repeatRule: repeatRule(row),
            calendarRule: calendarRule(row)
          }))
        }
      }
    },
    {
      permission: 'SmisDualControlDuplicateConfiguration:Void',
      key: 'void',
      label: '作废',
      icon: 'ri:forbid-2-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }) => {
        await confirmAction(
          '确定作废选中的重复配置吗？业务菜单将不再使用这些规则。',
          '作废重复配置'
        )
        await voidDuplicateConfigurations(selectedRows.map((row) => String(row.id)))
        await api.refreshUpdate()
      }
    },
    {
      permission: 'SmisDualControlDuplicateConfiguration:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: { selectedCount: number }) =>
        `确定删除选中的 ${selectedCount} 个重复配置吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.contentItem ?? '重复配置')
          })),
          permission: 'SmisDualControlDuplicateConfiguration:Delete',
          remove: async () => {
            await deleteDuplicateConfigurations(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const columnsFactory = (): ColumnOption<SmisDuplicateConfiguration>[] => {
    const columns: ColumnOption<SmisDuplicateConfiguration>[] = [
      { type: 'selection', width: 48 },
      { type: 'globalIndex', label: '序号', width: 70 },
      {
        prop: 'contentItem',
        label: '内容事项',
        minWidth: 210,
        fixed: 'left',
        showOverflowTooltip: true,
        formatter: (row) => (
          <span class="duplicate-page__content">
            <i style={{ background: row.textColor || 'var(--theme-color)' }} />
            <strong style={{ color: row.textColor || undefined }}>{row.contentItem}</strong>
          </span>
        )
      },
      {
        prop: 'menuId',
        label: '关联菜单功能',
        minWidth: 180,
        showOverflowTooltip: true,
        formatter: menuTitle
      },
      {
        prop: 'repeatEnabled',
        label: '重复',
        width: 90,
        align: 'center',
        formatter: (row) => (
          <ElTag type={row.repeatEnabled ? 'success' : 'info'} effect="plain">
            {row.repeatEnabled ? '重复' : '不重复'}
          </ElTag>
        )
      },
      { prop: 'repeatFrequency', label: '重复规则', minWidth: 130, formatter: repeatRule },
      {
        prop: 'calendarDays',
        label: '日历',
        minWidth: 180,
        showOverflowTooltip: true,
        formatter: calendarRule
      },
      {
        prop: 'deadlineTime',
        label: '截止时间',
        width: 100,
        formatter: (row) => row.deadlineTime?.slice(0, 5) || '—'
      },
      { prop: 'sort', label: '排序', width: 72, align: 'right' },
      {
        prop: 'status',
        label: '状态',
        width: 96,
        align: 'center',
        formatter: (row) => (
          <ElTag
            type={
              row.status === 'enabled' ? 'success' : row.status === 'disabled' ? 'warning' : 'info'
            }
            effect="plain"
          >
            {statusOptions.value.find((i) => i.value === row.status)?.label || '未识别状态'}
          </ElTag>
        )
      },
      { prop: 'createBy', label: '创建人', minWidth: 110, showOverflowTooltip: true },
      {
        prop: 'createTime',
        label: '创建时间',
        width: 164,
        formatter: (row) => formatTableDateTime(row.createTime)
      },
      {
        prop: 'operation',
        label: '操作',
        width: 140,
        fixed: 'right',
        formatter: (row) => (
          <BusinessTableRowActions>
            <ArtButtonTable
              type="edit"
              permission="SmisDualControlDuplicateConfiguration:Edit"
              label="编辑重复配置"
              disabled={row.status === 'voided'}
              onClick={() => openDialog(row)}
            />
            <ArtButtonTable
              type="delete"
              permission="SmisDualControlDuplicateConfiguration:Delete"
              label="删除重复配置"
              onClick={() => void handleDelete(row)}
            />
          </BusinessTableRowActions>
        )
      }
    ]
    return columns.filter(
      (column) =>
        column.prop !== 'operation' ||
        hasAnyAuth([
          'SmisDualControlDuplicateConfiguration:Edit',
          'SmisDualControlDuplicateConfiguration:Delete'
        ])
    )
  }
  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return await fetchDuplicateConfigurations({
      ...params,
      tenantId: effectiveTenantId.value,
      from,
      to
    })
  }
  const handleSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (records, response) => {
    const rows = records as SmisDuplicateConfiguration[]
    overview.total = response.total ?? 0
    overview.repeating = rows.filter((r) => r.repeatEnabled).length
    overview.once = rows.filter((r) => !r.repeatEnabled).length
    overview.enabled = rows.filter((r) => r.status === 'enabled').length
  }
  const handleDialogSuccess = (type: 'add' | 'edit') =>
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  const handleDelete = async (row: SmisDuplicateConfiguration) => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.contentItem ?? '重复配置')
        }
      ],
      permission: 'SmisDualControlDuplicateConfiguration:Delete',
      confirmMessage: `确定删除重复配置“${row.contentItem}”吗？`,
      remove: async () => {
        await deleteDuplicateConfigurations([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }
  const loadMenus = async () => {
    menus.value = await fetchConfigurableMenuOptions()
  }
  onMounted(async () => {
    await Promise.all(
      [
        'commonEnabledDisabledVoidedStatus',
        'smisTagStyle',
        'smisFrequencyUnit',
        'smisCalendarType'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
    await Promise.all([tenantScopeStore.loadTenantOptions(), loadMenus()])
  })
  watch(revision, () => void tableQueryRef.value?.refreshContext())
</script>
<style scoped lang="scss">
  .duplicate-page {
    min-width: 0;

    &__overview {
      min-width: 0;
      overflow: hidden;
    }

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.duplicate-page__content) {
      display: flex;
      gap: 9px;
      align-items: center;
      min-width: 0;

      i {
        flex: 0 0 4px;
        width: 4px;
        height: 28px;
        border-radius: 999px;
      }

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
</style>
