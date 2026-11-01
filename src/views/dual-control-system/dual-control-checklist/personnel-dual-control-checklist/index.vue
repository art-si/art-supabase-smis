<template>
  <ArtPermissionGuard
    permission="SmisDualControlPersonnelChecklist:View"
    resource-name="人员双控清单"
  >
    <div class="personnel-checklist business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        class="personnel-checklist__overview"
        eyebrow="PEOPLE & DUAL CONTROL"
        title="人员双控清单"
        description="以在岗人员为入口，统一核对岗位风险、隐患排查职责与当月倒班安排。"
        icon="ri:team-line"
        density="compact"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="personnel-checklist__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 88, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          showOverflowTooltip: true,
          emptyText: '暂无在岗人员',
          emptyDescription: '请调整组织、性别或人员关键字后重试。'
        }"
        focusable
      />

      <ShiftCalendarDialog ref="shiftDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElTag } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExcelColumn,
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import {
    fetchPersonnelDualControlChecklist,
    type SmisChecklistSearchParams,
    type SmisPersonnelChecklistOverview,
    type SmisPersonnelChecklistRecord
  } from '@smis/api'
  import { useChecklistOptions } from '../shared/use-checklist-options'
  import ShiftCalendarDialog, {
    type ShiftCalendarOpenData
  } from './modules/shift-calendar-dialog.vue'

  defineOptions({ name: 'SmisDualControlPersonnelChecklist' })

  type TableParams = Pick<Api.Common.PaginationParams, 'current' | 'size'> & {
    keyword?: string
    organizationId?: string
    gender?: string
  }
  interface ShiftDialogExpose {
    handleOpen: (data: ShiftCalendarOpenData) => Promise<void>
  }

  const router = useRouter()
  const genderOptions = useDictionaryOptions('sex')
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const shiftDialogRef = ref<ShiftDialogExpose>()
  const searchQuery = ref<TableParams>({ current: 1, size: 20 })
  const overview = ref<SmisPersonnelChecklistOverview>({
    total: 0,
    scheduled: 0,
    withRisk: 0,
    withInspection: 0
  })
  const { organizationTree, organizationTreeProps, loadOptions } = useChecklistOptions()

  const workspaceTags: BusinessWorkspaceTag[] = [
    { label: 'HR 在岗人员', type: 'primary', effect: 'plain' },
    { label: '岗位责任联动', type: 'success', effect: 'light' },
    { label: '月度倒班可视', type: 'info', effect: 'plain' }
  ]
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '在岗人员',
      value: overview.value.total,
      description: '当前筛选范围',
      icon: 'ri:group-line'
    },
    {
      label: '本月已排班',
      value: overview.value.scheduled,
      description: '至少安排 1 个班次',
      icon: 'ri:calendar-check-line',
      tone: 'success'
    },
    {
      label: '已关联风险',
      value: overview.value.withRisk,
      description: '岗位已配置管控措施',
      icon: 'ri:shield-check-line',
      tone: 'warning'
    },
    {
      label: '已配置排查',
      value: overview.value.withInspection,
      description: '岗位已有排查标准',
      icon: 'ri:list-check-3',
      tone: 'info'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '人员关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名、工号或岗位' }
    },
    {
      label: '所属组织',
      key: 'organizationId',
      type: 'treeSelect',
      props: {
        data: organizationTree.value,
        props: organizationTreeProps,
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        filterable: true,
        clearable: true,
        defaultExpandAll: true,
        ariaLabel: '所属组织',
        placeholder: '全部组织'
      }
    },
    {
      label: '性别',
      key: 'gender',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部',
        options: genderOptions
      }
    }
  ])
  const genderLabel = (value?: string | null): string =>
    ({ '1': '男', '2': '女', male: '男', female: '女' })[value || ''] || '—'
  const openRelatedChecklist = (name: string, row: SmisPersonnelChecklistRecord): void => {
    void router.push({
      name,
      query: {
        organizationId: row.organizationId || undefined,
        positionId: row.positionId || undefined,
        employeeId: row.id,
        keyword: row.positionName
      }
    })
  }
  const columnsFactory = (): ColumnOption<SmisPersonnelChecklistRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'employeeName',
      label: '人员信息',
      minWidth: 190,
      link: {
        permission: 'SmisDualControlPersonnelChecklist:ViewShift',
        onClick: (row) => shiftDialogRef.value?.handleOpen({ employee: row })
      },
      formatter: (row) => (
        <div class="personnel-checklist__identity">
          <span aria-hidden="true">{row.employeeName.slice(0, 1)}</span>
          <div>
            <strong>{row.employeeName}</strong>
            <small>{row.employeeNo}</small>
          </div>
        </div>
      )
    },
    {
      prop: 'gender',
      label: '性别',
      width: 72,
      align: 'center',
      formatter: (row) => genderLabel(row.gender)
    },
    {
      prop: 'age',
      label: '年龄',
      width: 72,
      align: 'right',
      formatter: (row) => (row.age ? `${row.age} 岁` : '—')
    },
    {
      prop: 'organizationName',
      label: '组织与岗位',
      minWidth: 240,
      formatter: (row) => (
        <div class="personnel-checklist__stack">
          <strong>{row.organizationName || '未关联组织'}</strong>
          <small>
            {row.positionName} · {row.positionCode || '无岗位编码'}
          </small>
        </div>
      )
    },
    {
      prop: 'coverage',
      label: '双控覆盖',
      minWidth: 220,
      formatter: (row) => (
        <div class="personnel-checklist__coverage">
          <ElTag effect="plain">风险 {row.riskCount}</ElTag>
          <ElTag type="success" effect="plain">
            排查 {row.inspectionCount}
          </ElTag>
          <ElTag type={row.hazardCount ? 'warning' : 'info'} effect="plain">
            待闭环 {row.hazardCount}
          </ElTag>
        </div>
      )
    },
    {
      prop: 'operation',
      label: '清单操作',
      width: 180,
      fixed: 'right',
      formatter: (row) => (
        <div class="personnel-checklist__actions">
          <ArtButtonTable
            type="view"
            icon="ri:calendar-schedule-line"
            label="倒班表"
            permission="SmisDualControlPersonnelChecklist:ViewShift"
            onClick={() => void shiftDialogRef.value?.handleOpen({ employee: row })}
          />
          <ArtButtonTable
            type="view"
            icon="ri:shield-flash-line"
            label="风险清单"
            permission="SmisDualControlPersonnelChecklist:ViewRisk"
            disabled={!row.positionId}
            onClick={() => openRelatedChecklist('SmisDualControlPositionRiskChecklist', row)}
          />
          <ArtButtonTable
            type="view"
            icon="ri:list-check-3"
            label="排查清单"
            permission="SmisDualControlPersonnelChecklist:ViewInspection"
            disabled={!row.positionId}
            onClick={() =>
              openRelatedChecklist('SmisDualControlAccidentHiddenHazardInspectionChecklist', row)
            }
          />
          <ArtButtonTable
            type="view"
            icon="ri:user-settings-line"
            label="责任清单"
            permission="SmisDualControlPersonnelChecklist:ViewResponsibility"
            disabled={!row.positionId}
            onClick={() =>
              openRelatedChecklist('SmisDualControlPositionSafetyResponsibilityChecklist', row)
            }
          />
        </div>
      )
    }
  ]
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'employeeNo', title: '工号' },
    { key: 'employeeName', title: '姓名' },
    { key: 'gender', title: '性别' },
    { key: 'age', title: '年龄' },
    { key: 'organizationName', title: '所属组织' },
    { key: 'positionName', title: '岗位' },
    { key: 'riskCount', title: '岗位风险数' },
    { key: 'inspectionCount', title: '排查标准数' },
    { key: 'hazardCount', title: '待闭环隐患数' },
    { key: 'scheduleCount', title: '本月排班天数' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'export',
      label: '导出清单',
      permission: 'SmisDualControlPersonnelChecklist:Export',
      exportFilename: '人员双控清单',
      exportSheetName: '人员双控清单',
      exportColumns: excelColumns,
      exportApi: async () => ({
        data: (
          await loadAllDocumentPages<SmisPersonnelChecklistRecord, SmisChecklistSearchParams>(
            fetchPersonnelDualControlChecklist,
            { ...searchQuery.value }
          )
        ).map((row) => ({ ...row, gender: genderLabel(row.gender) }))
      })
    }
  ])
  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const response = await fetchPersonnelDualControlChecklist({ ...params, from, to })
    overview.value = response.overview
    return response
  }

  onMounted(loadOptions)
</script>

<style scoped lang="scss">
  .personnel-checklist {
    min-width: 0;

    &__table {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    :deep(.personnel-checklist__identity) {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;
    }

    :deep(.personnel-checklist__identity > span) {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      font-weight: 700;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
      border-radius: 50%;
    }

    :deep(.personnel-checklist__identity div),
    :deep(.personnel-checklist__stack) {
      display: grid;
      min-width: 0;
    }

    :deep(.personnel-checklist__identity strong),
    :deep(.personnel-checklist__identity small),
    :deep(.personnel-checklist__stack strong),
    :deep(.personnel-checklist__stack small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.personnel-checklist__identity small),
    :deep(.personnel-checklist__stack small) {
      margin-top: 2px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.personnel-checklist__actions .art-button-table) {
      margin-right: 0;
    }
  }
</style>
