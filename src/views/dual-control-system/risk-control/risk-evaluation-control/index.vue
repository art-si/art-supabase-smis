<template>
  <ArtPermissionGuard permission="SmisDualControlRiskEvaluationControl:View">
    <div class="risk-evaluation-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="risk-evaluation-page__overview"
        eyebrow="RISK EVALUATION & CONTROL"
        title="风险评价及管控"
        description="对辨识完成的危险有害因素进行 LEC/LS 定量评价，自动匹配风险等级，再维护多条防控措施、责任岗位及排查周期。"
        icon="ri:shield-check-line"
        density="compact"
        :tags="[
          { label: '自动计算风险值', type: 'primary', effect: 'plain' },
          { label: '因素 1:N 措施', type: 'warning', effect: 'light' },
          { label: '措施 N:M 岗位', type: 'success', effect: 'plain' }
        ]"
        :metrics="metrics"
        ><template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template
      ></BusinessWorkspaceHeader>

      <ol class="risk-evaluation-page__workflow" aria-label="风险评价管控流程">
        <li :class="{ active: selectedItem, completed: selectedItem }">
          <span class="risk-evaluation-page__step-icon">
            <ArtSvgIcon :icon="selectedItem ? 'ri:check-line' : 'ri:number-1'" />
          </span>
          <div>
            <strong>选择危险因素</strong>
            <small>{{ selectedItem ? selectedItem.hazardFactor : '从下方列表选择一条记录' }}</small>
          </div>
        </li>
        <li :class="{ active: selectedItem?.evaluation, completed: selectedItem?.evaluation }">
          <span class="risk-evaluation-page__step-icon">
            <ArtSvgIcon :icon="selectedItem?.evaluation ? 'ri:check-line' : 'ri:number-2'" />
          </span>
          <div>
            <strong>完成定量评价</strong>
            <small>
              {{
                selectedItem?.evaluation
                  ? `${selectedItem.evaluation.methodCode} · ${selectedItem.evaluation.level?.levelName || '已评价'}`
                  : '按 LEC 或 LS 模型计算风险等级'
              }}
            </small>
          </div>
        </li>
        <li
          :class="{
            active: Boolean(selectedItem?.evaluation),
            completed: Boolean(selectedItem?.measureCount)
          }"
        >
          <span class="risk-evaluation-page__step-icon">
            <ArtSvgIcon :icon="selectedItem?.measureCount ? 'ri:check-line' : 'ri:number-3'" />
          </span>
          <div>
            <strong>落实防控措施</strong>
            <small>{{
              selectedItem?.measureCount
                ? `已维护 ${selectedItem.measureCount} 条措施`
                : '配置措施、岗位与排查周期'
            }}</small>
          </div>
        </li>
      </ol>

      <div class="risk-evaluation-page__workspace">
        <ArtTableQuery
          ref="tableQueryRef"
          class="risk-evaluation-page__table"
          v-model="searchQuery"
          :api-fn="fetchTableData"
          :search-items="searchItems"
          :columns-factory="columnsFactory"
          :header-actions="headerActions"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 8, labelWidth: 84, showExpand: false }"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            highlightCurrentRow: true,
            onRowClick: handleSelectItem,
            emptyHeight: '104px',
            emptyText: '暂无待评价危险有害因素',
            emptyDescription: '请先在风险辨识中为风险点维护危险有害因素。'
          }"
          :on-success="handleTableSuccess"
          focusable
        />
      </div>
      <EvaluationDialog ref="evaluationDialogRef" @success="handleEvaluationSaved" />
      <MeasureManagementDrawer ref="measureManagementDrawerRef" @success="handleMeasureChanged" />
    </div>
  </ArtPermissionGuard>
</template>
<script setup lang="tsx">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { ElTag } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import {
    fetchRiskFactorCategoryOptions,
    fetchRiskItems,
    type SmisRiskFactorCategoryOption,
    type SmisRiskItem,
    type SmisRiskItemSearchParams
  } from '@smis/api'
  import EvaluationDialog, { type EvaluationDialogOpenData } from './modules/evaluation-dialog.vue'
  import MeasureManagementDrawer, {
    type MeasureManagementDrawerExpose
  } from './modules/measure-management-drawer.vue'
  defineOptions({ name: 'SmisDualControlRiskEvaluationControl' })
  type TableParams = SmisRiskItemSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface EvaluationDialogExpose {
    handleOpen: (data: EvaluationDialogOpenData) => Promise<void>
  }
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId, revision } = storeToRefs(tenantScopeStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const evaluationDialogRef = ref<EvaluationDialogExpose>()
  const measureManagementDrawerRef = ref<MeasureManagementDrawerExpose>()
  const searchQuery = ref<SmisRiskItemSearchParams>({})
  const selectedItem = ref<SmisRiskItem>()
  const categories = ref<SmisRiskFactorCategoryOption[]>([])
  const listState = reactive({ total: 0, evaluated: 0, identified: 0, measures: 0 })
  const statusOptions = useDictionaryOptions('smisRiskEvaluationStatus')
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '风险点、编号或危险有害因素' }
    },
    {
      label: '因素类别',
      key: 'factorCategoryId',
      type: 'select',
      props: {
        options: categories.value.map((i) => ({
          label: `${i.categoryName}（${i.categoryCode}）`,
          value: i.id
        })),
        filterable: true,
        clearable: true,
        placeholder: '全部类别'
      }
    },
    {
      label: '评价状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions, clearable: true, placeholder: '全部状态' }
    }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '危险有害因素',
      value: listState.total,
      description: '当前查询范围',
      icon: 'ri:alert-line'
    },
    {
      label: '已完成评价',
      value: listState.evaluated,
      description: '当前页定量评价',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '待评价',
      value: listState.identified,
      description: '当前页待处理',
      icon: 'ri:timer-line',
      tone: 'warning'
    },
    {
      label: '防控措施',
      value: listState.measures,
      description: '当前页已维护',
      icon: 'ri:shield-check-line'
    }
  ])
  const openEvaluation = (row: SmisRiskItem) =>
    void evaluationDialogRef.value?.handleOpen({
      item: row,
      tenantId: row.tenantId || effectiveTenantId.value
    })
  const openMeasureManagement = (row: SmisRiskItem): void => {
    handleSelectItem(row)
    void measureManagementDrawerRef.value?.handleOpen(row)
  }
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisDualControlRiskEvaluationControl:Evaluate',
      key: 'evaluate',
      label: '定量评价',
      icon: 'ri:function-line',
      selectionRequired: true,
      selectionLimit: 1,
      onClick: ({ selectedRows }) => openEvaluation(selectedRows[0] as SmisRiskItem)
    },
    {
      permission: 'SmisDualControlRiskEvaluationControl:Export',
      type: 'export',
      label: '导出评价及措施',
      exportFilename: '风险评价及管控',
      exportSheetName: '风险评价及管控',
      exportColumns: [
        {
          key: 'riskPoint',
          title: '风险点',
          formatter: (_value, row) => row.riskPointRecord?.pointName || row.riskPoint || '—'
        },
        { key: 'itemNo', title: '因素编号' },
        { key: 'hazardFactor', title: '危险有害因素' },
        {
          key: 'factorCategory',
          title: '因素类别',
          formatter: (_value, row) => row.factorCategory?.categoryName || '—'
        },
        { key: 'status', title: '评价状态' },
        {
          key: 'evaluation',
          title: '评价方法',
          formatter: (_value, row) => row.evaluation?.methodCode || '—'
        },
        {
          key: 'riskLevel',
          title: '风险等级',
          formatter: (_value, row) => row.evaluation?.level?.levelName || '—'
        }
      ],
      exportApi: async () => ({
        data: await loadAllDocumentPages<SmisRiskItem, SmisRiskItemSearchParams>(fetchRiskItems, {
          ...searchQuery.value,
          tenantId: effectiveTenantId.value
        })
      })
    }
  ])
  const columnsFactory = (): ColumnOption<SmisRiskItem>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'riskPoint',
      label: '风险点',
      minWidth: 180,
      fixed: 'left',
      showOverflowTooltip: true,
      link: {
        permission: 'SmisDualControlRiskEvaluationControl:View',
        onClick: openMeasureManagement
      },
      formatter: (row) => (
        <div class="risk-evaluation-page__risk-point">
          <strong>{row.riskPointRecord?.pointName || row.riskPoint || '—'}</strong>
          <small>{row.riskPointRecord?.pointNo || ''}</small>
        </div>
      )
    },
    { prop: 'itemNo', label: '因素编号', width: 150, showOverflowTooltip: true },
    { prop: 'hazardFactor', label: '危险有害因素', minWidth: 260, showOverflowTooltip: true },
    {
      prop: 'factorCategory',
      label: '因素类别',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.factorCategory?.categoryName || '—'
    },
    {
      prop: 'evaluation',
      label: '定量评价',
      width: 190,
      formatter: (row) =>
        row.evaluation ? (
          <div class="risk-evaluation-page__score">
            <span style={{ background: row.evaluation.level?.color || '#64748B' }}>
              {row.evaluation.methodCode}
            </span>
            <strong>{row.evaluation.dValue}</strong>
            <small style={{ color: row.evaluation.level?.color || undefined }}>
              {row.evaluation.level?.levelName || '已评价'}
            </small>
          </div>
        ) : (
          <ElTag type="warning" effect="plain">
            待评价
          </ElTag>
        )
    },
    {
      prop: 'measureCount',
      label: '控制措施',
      width: 96,
      align: 'right',
      formatter: (row) => `${row.measureCount || 0} 条`
    },
    {
      prop: 'operation',
      label: '操作',
      width: 112,
      fixed: 'right',
      formatter: (row) => (
        <div class="risk-evaluation-page__actions">
          <ArtButtonTable
            type="edit"
            permission="SmisDualControlRiskEvaluationControl:Evaluate"
            label={row.evaluation ? '重新评价' : '定量评价'}
            icon="ri:calculator-line"
            onClick={() => openEvaluation(row)}
          />
          <ArtButtonTable
            type="view"
            permission="SmisDualControlRiskEvaluationControl:View"
            label="防控措施"
            icon="ri:shield-check-line"
            onClick={() => openMeasureManagement(row)}
          />
        </div>
      )
    }
  ]
  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return await fetchRiskItems({ ...params, tenantId: effectiveTenantId.value, from, to })
  }
  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (records, response) => {
    const rows = records as SmisRiskItem[]
    listState.total = response.total ?? 0
    listState.evaluated = rows.filter((i) => Boolean(i.evaluation)).length
    listState.identified = rows.filter((i) => !i.evaluation && i.status !== 'voided').length
    listState.measures = rows.reduce((n, i) => n + (i.measureCount || 0), 0)
    if (selectedItem.value) {
      const latest = rows.find((i) => i.id === selectedItem.value?.id)
      if (latest) selectedItem.value = latest
    }
  }
  const handleSelectItem = (row: SmisRiskItem) => {
    if (selectedItem.value?.id === row.id) return
    selectedItem.value = row
  }
  const handleEvaluationSaved = async () => {
    await tableQueryRef.value?.refreshUpdate()
  }
  const handleMeasureChanged = async () => {
    await tableQueryRef.value?.refreshUpdate()
  }
  onMounted(async () => {
    await Promise.all(
      [
        'smisControlMeasureCategory',
        'smisControlLevel',
        'smisHazardLevel',
        'smisFrequencyUnit'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
    categories.value = await fetchRiskFactorCategoryOptions()
    await tenantScopeStore.loadTenantOptions()
  })
  watch(revision, () => {
    selectedItem.value = undefined
    void tableQueryRef.value?.refreshContext()
  })
</script>
<style scoped lang="scss">
  .risk-evaluation-page {
    min-width: 0;

    &__overview {
      min-width: 0;
      overflow: hidden;
    }

    &__workspace {
      display: flex;
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    &__workflow {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding: 8px;
      margin: 0;
      list-style: none;
      background: var(--default-box-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__workflow li {
      position: relative;
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-height: 50px;
      padding: 7px 12px;
      color: var(--el-text-color-secondary);
      border-radius: var(--el-border-radius-base);
    }

    &__workflow li + li::before {
      position: absolute;
      top: 50%;
      left: -7px;
      width: 6px;
      height: 1px;
      content: '';
      background: var(--el-border-color);
    }

    &__workflow li.active {
      color: var(--el-text-color-primary);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
    }

    &__step-icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      font-weight: 700;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color-light);
      border-radius: 50%;
    }

    &__workflow li.completed &__step-icon {
      color: var(--el-color-success);
      background: color-mix(in srgb, var(--el-color-success) 10%, var(--el-bg-color));
    }

    &__workflow strong,
    &__workflow small {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__workflow strong {
      font-size: 13px;
    }

    &__workflow small {
      margin-top: 3px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__table {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
    }

    :deep(.risk-evaluation-page__risk-point) {
      display: flex;
      flex-direction: column;
      min-width: 0;

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.risk-evaluation-page__score) {
      display: grid;
      grid-template-columns: 44px 54px minmax(0, 1fr);
      gap: 7px;
      align-items: center;

      > span {
        padding: 4px 7px;
        font-size: 11px;
        font-weight: 800;
        color: #fff;
        text-align: center;
        border-radius: var(--el-border-radius-small);
      }

      > strong {
        font-size: 18px;
      }

      > small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  @media (width <= 1080px) {
    .risk-evaluation-page__workflow {
      grid-template-columns: 1fr;
    }

    .risk-evaluation-page__workflow li + li::before {
      display: none;
    }
  }
</style>
