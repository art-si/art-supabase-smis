<template>
  <ArtPermissionGuard permission="SmisDualControlSafetyRiskList:View" resource-name="安全风险清单">
    <div class="safety-risk-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="SAFETY RISK REGISTER"
        title="安全风险清单"
        description="集中查看危险源、事故后果、五类控制措施与分级管控责任，形成从辨识到巡查的统一风险底账。"
        icon="ri:shield-flash-line"
        density="compact"
        :tags="[
          { label: '风险底账', type: 'primary', effect: 'plain' },
          { label: '五类措施', type: 'warning', effect: 'light' },
          { label: '责任到人', type: 'success', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableQueryRef"
        class="safety-risk-page__table"
        v-model="searchQuery"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 84, showExpand: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无安全风险',
          emptyDescription: '可从风险点新增危险源，随后完成定量评价并配置分级管控。'
        }"
        focusable
      />

      <SafetyRiskDialog ref="dialogRef" @success="handleSaveSuccess" />
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
  import dayjs from 'dayjs'
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

  import { useUserStore } from '@/store/modules/user'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteSafetyRisks,
    fetchSafetyRiskList,
    fetchSafetyRiskOptions,
    type SmisRiskControlLevel,
    type SmisRiskItemStatus,
    type SmisSafetyRiskOptions,
    type SmisSafetyRiskOverview,
    type SmisSafetyRiskRecord,
    type SmisSafetyRiskSearchParams
  } from '@smis/api'
  import SafetyRiskDialog, { type SafetyRiskDialogOpenData } from './modules/safety-risk-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard('smis_risk_item', '风险项')

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'SmisDualControlSafetyRiskList' })

  interface SafetyRiskQuery extends SmisSafetyRiskSearchParams {
    identifiedRange?: [string, string]
  }
  type TableParams = SafetyRiskQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: SafetyRiskDialogOpenData) => Promise<void>
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const searchQuery = ref<SafetyRiskQuery>({})
  const options = shallowRef<SmisSafetyRiskOptions>({ riskPoints: [], hazardCategories: [] })
  const optionsLoading = ref(false)
  const overview = reactive<SmisSafetyRiskOverview>({
    total: 0,
    evaluated: 0,
    major: 0,
    controlled: 0
  })
  const fallbackControlLevels: Array<{ label: string; value: SmisRiskControlLevel }> = [
    { label: '公司级（厂级）', value: 'company' },
    { label: '车间（部门级）', value: 'department' },
    { label: '班组级', value: 'team' },
    { label: '岗位级', value: 'position' }
  ]
  const controlLevelOptions = computed(() => {
    const dictionary = getDictMap.value.smisRiskControlLevel ?? []
    return dictionary.length
      ? dictionary.map((item) => ({
          label: item.label || item.name,
          value: item.value as SmisRiskControlLevel
        }))
      : fallbackControlLevels
  })
  const controlLevelLabel = computed(
    () => new Map(controlLevelOptions.value.map((item) => [item.value, item.label]))
  )
  const accidentTypeOptions = computed(() =>
    (getDictMap.value.smisAccidentCategory ?? []).map(toDictionaryOption)
  )
  const statusOptions: Array<{ label: string; value: SmisRiskItemStatus }> = [
    { label: '已辨识', value: 'identified' },
    { label: '已评价', value: 'evaluated' },
    { label: '已作废', value: 'voided' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '风险总数',
      value: overview.total,
      description: '当前查询口径',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '已完成评价',
      value: overview.evaluated,
      description: '具备量化结果',
      icon: 'ri:calculator-line',
      tone: 'success'
    },
    {
      label: '重大风险',
      value: overview.major,
      description: '优先落实控制措施',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    },
    {
      label: '已落实管控',
      value: overview.controlled,
      description: '已配置责任层级',
      icon: 'ri:shield-check-line',
      tone: 'primary'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '危险源',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '危险编号、风险点编号或危险源' }
    },
    {
      label: '风险名称',
      key: 'riskName',
      type: 'input',
      props: { clearable: true, placeholder: '风险点名称' }
    },
    {
      label: '事故类型',
      key: 'accidentType',
      type: 'select',
      props: {
        options: accidentTypeOptions.value,
        clearable: true,
        filterable: true,
        placeholder: '全部类型'
      }
    },
    {
      label: '辨识时间',
      key: 'identifiedRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期'
      }
    },
    {
      label: '管控层级',
      key: 'controlLevel',
      type: 'select',
      props: { options: controlLevelOptions.value, clearable: true, placeholder: '全部层级' }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions, clearable: true, placeholder: '全部状态' }
    },
    {
      label: '责任人',
      key: 'responsibleKeyword',
      type: 'input',
      props: { clearable: true, placeholder: '责任人姓名' }
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'hazardNo', title: '危险编号' },
    { key: 'riskName', title: '风险点名称' },
    { key: 'riskPointType', title: '风险点类型' },
    { key: 'siteName', title: '环节/单位' },
    { key: 'hazardSource', title: '危险源' },
    { key: 'accidentTypes', title: '事故类型' },
    { key: 'riskDescription', title: '风险描述' },
    { key: 'engineeringMeasures', title: '工程技术措施' },
    { key: 'managementMeasures', title: '管理措施' },
    { key: 'educationMeasures', title: '教育培训措施' },
    { key: 'personalProtectionMeasures', title: '个体防护措施' },
    { key: 'emergencyMeasures', title: '应急处置措施' },
    { key: 'riskAssessmentMethod', title: '风险评估方法' },
    { key: 'riskLevelName', title: '风险等级' },
    { key: 'controlLevels', title: '管控层级' },
    { key: 'responsibleNames', title: '责任人' },
    { key: 'responsibleDepartments', title: '责任部门' },
    { key: 'identifiedBy', title: '辨识人' },
    { key: 'identifiedAt', title: '辨识时间' }
  ]

  const loadOptions = async (): Promise<void> => {
    optionsLoading.value = true
    try {
      options.value = await fetchSafetyRiskOptions()
    } finally {
      optionsLoading.value = false
    }
  }
  const openDialog = async (row?: SmisSafetyRiskRecord): Promise<void> => {
    await dialogRef.value?.handleOpen({
      row,
      options: options.value,
      loadOptions: async () => {
        await loadOptions()
        return options.value
      }
    })
  }
  const measureColumn = (
    prop: keyof SmisSafetyRiskRecord,
    label: string
  ): ColumnOption<SmisSafetyRiskRecord> => ({
    prop: String(prop),
    label,
    minWidth: 220,
    showOverflowTooltip: true,
    formatter: (row) => (
      <span class={row[prop] ? '' : 'safety-risk-page__muted'}>
        {String(row[prop] || '未维护')}
      </span>
    )
  })
  const columnsFactory = (): ColumnOption<SmisSafetyRiskRecord>[] => [
    { type: 'selection', width: 48, fixed: 'left', reserveSelection: true },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'hazardNo',
      label: '危险编号',
      width: 142,
      fixed: 'left',
      formatter: (row) => <span class="safety-risk-page__code">{row.hazardNo}</span>
    },
    {
      prop: 'riskName',
      label: '风险点名称',
      minWidth: 220,
      fixed: 'left',
      formatter: (row) => (
        <div class="safety-risk-page__identity">
          <span>
            <ArtSvgIcon icon="ri:alarm-warning-line" />
          </span>
          <div>
            <strong title={row.riskName}>{row.riskName}</strong>
            <small>{row.riskPointNo}</small>
          </div>
        </div>
      )
    },
    {
      prop: 'riskPointType',
      label: '风险点类型',
      width: 116,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisRiskPointType" value={row.riskPointType} display="tag" />
      )
    },
    {
      prop: 'siteName',
      label: '环节 / 单位',
      minWidth: 180,
      formatter: (row) => (
        <div class="safety-risk-page__stack">
          <strong>{row.siteName}</strong>
          <small>{row.organizationName || '组织未维护'}</small>
        </div>
      )
    },
    { prop: 'hazardSource', label: '危险源', minWidth: 220, showOverflowTooltip: true },
    {
      prop: 'accidentTypes',
      label: '事故类型',
      minWidth: 190,
      formatter: (row) => (
        <div class="safety-risk-page__tags">
          {row.accidentTypes.length ? (
            row.accidentTypes.map((item) => (
              <ArtDictDisplay dictCode="smisAccidentCategory" value={item} display="tag" />
            ))
          ) : (
            <span class="safety-risk-page__muted">未维护</span>
          )}
        </div>
      )
    },
    { prop: 'riskDescription', label: '风险描述', minWidth: 240, showOverflowTooltip: true },
    measureColumn('engineeringMeasures', '工程技术措施'),
    measureColumn('managementMeasures', '管理措施'),
    measureColumn('educationMeasures', '教育培训措施'),
    measureColumn('personalProtectionMeasures', '个体防护措施'),
    measureColumn('emergencyMeasures', '应急处置措施'),
    {
      prop: 'riskAssessmentMethod',
      label: '评估方法',
      width: 105,
      align: 'center',
      formatter: (row) =>
        row.riskAssessmentMethod ? (
          <ElTag effect="plain">{row.riskAssessmentMethod}</ElTag>
        ) : (
          '待评价'
        )
    },
    {
      prop: 'riskLevelName',
      label: '风险等级',
      width: 118,
      align: 'center',
      formatter: (row) => (
        <span
          class="safety-risk-page__level"
          style={{ '--risk-color': row.riskLevelColor || 'var(--el-text-color-secondary)' }}
        >
          {row.riskLevelName || '待评价'}
        </span>
      )
    },
    {
      prop: 'controlLevels',
      label: '管控层级',
      minWidth: 180,
      formatter: (row) =>
        row.controlLevels.length
          ? row.controlLevels.map((item) => controlLevelLabel.value.get(item) || item).join('、')
          : '未管控'
    },
    {
      prop: 'responsibleNames',
      label: '责任人 / 部门',
      minWidth: 190,
      formatter: (row) => (
        <div class="safety-risk-page__stack">
          <strong>{row.responsibleNames || '待落实'}</strong>
          <small>{row.responsibleDepartments || '责任部门待落实'}</small>
        </div>
      )
    },
    {
      prop: 'identifiedBy',
      label: '辨识人 / 时间',
      minWidth: 170,
      formatter: (row) => (
        <div class="safety-risk-page__stack">
          <strong>{row.identifiedBy || '系统记录'}</strong>
          <small>{formatTableDateTime(row.identifiedAt)}</small>
        </div>
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) => (
        <div class="safety-risk-page__actions">
          <ArtButtonTable
            type="edit"
            permission="SmisDualControlSafetyRiskList:Edit"
            onClick={() => void openDialog(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="SmisDualControlSafetyRiskList:Delete"
            onClick={() => void handleDelete(row)}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchSafetyRiskList(
      {
        ...params,
        identifiedFrom: params.identifiedRange?.[0],
        identifiedTo: params.identifiedRange?.[1]
          ? `${params.identifiedRange[1]}T23:59:59`
          : undefined,
        from,
        to
      },
      { showErrorMessage: false }
    )
    if (options?.signal?.aborted) return response
    if (response.error)
      throw new Error('安全风险清单加载失败，请重新加载', { cause: response.error })
    Object.assign(overview, response.overview)
    return response
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlSafetyRiskList:Add',
      type: 'add',
      label: '新增安全风险',
      onClick: () => void openDialog()
    },
    {
      permission: 'SmisDualControlSafetyRiskList:Export',
      type: 'export',
      exportFilename: '安全风险清单',
      exportSheetName: '风险底账',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: (
          await loadAllDocumentPages(fetchSafetyRiskList, {
            ...searchQuery.value,
            identifiedFrom: searchQuery.value.identifiedRange?.[0],
            identifiedTo: searchQuery.value.identifiedRange?.[1]
              ? `${searchQuery.value.identifiedRange[1]}T23:59:59`
              : undefined
          })
        ).map((row) => ({
          ...row,
          accidentTypes: row.accidentTypes.join('、'),
          controlLevels: row.controlLevels
            .map((item) => controlLevelLabel.value.get(item) || item)
            .join('、'),
          identifiedAt: dayjs(row.identifiedAt).format('YYYY-MM-DD HH:mm')
        }))
      })
    },
    {
      permission: 'SmisDualControlSafetyRiskList:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条安全风险吗？已完成评价的数据将被保护。`,
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.hazardNo ?? '风险项')
          })),
          permission: 'SmisDualControlSafetyRiskList:Delete',
          remove: async () => {
            await deleteSafetyRisks((selectedRows as SmisSafetyRiskRecord[]).map((row) => row.id))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    }
  ])
  const handleSaveSuccess = (type: 'add' | 'edit'): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }
  const handleDelete = async (row: SmisSafetyRiskRecord): Promise<void> => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.hazardNo ?? '风险项')
        }
      ],
      permission: 'SmisDualControlSafetyRiskList:Delete',
      confirmMessage: `确定删除危险“${row.hazardNo}”吗？已完成评价的风险将保留。`,
      remove: async () => {
        await deleteSafetyRisks([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }
  onMounted(async () => {
    await Promise.all([
      userStore.ensureDictLoaded('smisRiskPointType'),
      userStore.ensureDictLoaded('smisAccidentCategory'),
      userStore.ensureDictLoaded('smisRiskControlLevel'),
      loadOptions()
    ])
  })
</script>

<style scoped lang="scss">
  .safety-risk-page {
    gap: 12px;
    min-width: 0;

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.safety-risk-page__code) {
      font-size: 12px;
      color: var(--theme-color);
    }

    :deep(.safety-risk-page__identity) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;
    }

    :deep(.safety-risk-page__identity > span) {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--el-color-warning);
      background: color-mix(in srgb, var(--el-color-warning) 10%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    :deep(.safety-risk-page__identity strong),
    :deep(.safety-risk-page__identity small),
    :deep(.safety-risk-page__stack strong),
    :deep(.safety-risk-page__stack small) {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.safety-risk-page__identity small),
    :deep(.safety-risk-page__stack small) {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.safety-risk-page__tags) {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    :deep(.safety-risk-page__level) {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-weight: 600;
    }

    :deep(.safety-risk-page__level::before) {
      width: 8px;
      height: 8px;
      content: '';
      background: var(--risk-color);
      border-radius: 50%;
    }

    :deep(.safety-risk-page__muted) {
      color: var(--el-text-color-placeholder);
    }
  }
</style>
