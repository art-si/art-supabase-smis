<template>
  <ArtPermissionGuard
    permission="SmisThreeViolationEducation:View"
    resource-name="三违人员教育信息"
  >
    <div class="three-violation-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="THREE-VIOLATION EDUCATION"
        title="三违人员教育信息"
        description="从检查发现到教育完成，统一管理三违人员、责任人、教育过程与台账证据。"
        icon="ri:user-forbid-line"
        :tags="[
          { label: '员工花名册联动', type: 'primary', effect: 'plain' },
          { label: '待教育闭环', type: 'warning', effect: 'light' },
          { label: '安全教育台账', type: 'success', effect: 'plain' }
        ]"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableQueryRef" /></template>
      </BusinessWorkspaceHeader>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="searchQuery"
        class="three-violation-page__table"
        :api-fn="fetchTableData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 6, labelWidth: 82, showExpand: true, defaultExpanded: true }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无三违人员教育记录',
          emptyDescription: '新增检查发现后，可继续记录教育过程并打印安全教育台账。'
        }"
        focusable
      >
      </ArtTableQuery>

      <ThreeViolationDialog ref="dialogRef" @success="handleSaveSuccess" />
      <EducationRecordDialog ref="recordDialogRef" @success="handleSaveSuccess" />
      <ThreeViolationDetailDialog ref="detailDialogRef" />
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
  import { storeToRefs } from 'pinia'
  import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
  import { ElAvatar } from 'element-plus'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
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
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteThreeViolationEducation,
    fetchThreeViolationEducationList,
    type SmisAntiViolationOrganization,
    type SmisAntiViolationStandardOption,
    type SmisThreeViolationEducation,
    type SmisThreeViolationEducationOverview,
    type SmisThreeViolationEducationSearchParams
  } from '@smis/api'
  import ThreeViolationDialog, {
    type ThreeViolationDialogMode,
    type ThreeViolationDialogOpenData
  } from './modules/three-violation-dialog.vue'
  import EducationRecordDialog from './modules/education-record-dialog.vue'
  import ThreeViolationDetailDialog from './modules/three-violation-detail-dialog.vue'
  import { formatGender, printThreeViolationLedger } from './modules/three-violation-ledger'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_three_violation_education',
    '三违教育'
  )

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })
  const formatTableDateTime2 = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '待完成',
    invalidText: '待完成'
  })

  defineOptions({ name: 'SmisThreeViolationEducation' })

  type TableParams = SmisThreeViolationEducationSearchParams &
    Pick<Api.Common.PaginationParams, 'current' | 'size'>
  interface DialogExpose {
    handleOpen: (data: ThreeViolationDialogOpenData) => Promise<void>
  }
  interface RecordDialogExpose {
    handleOpen: (row: SmisThreeViolationEducation) => Promise<void>
  }
  interface DetailDialogExpose {
    handleOpen: (row: SmisThreeViolationEducation) => Promise<void>
  }
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const recordDialogRef = ref<RecordDialogExpose>()
  const detailDialogRef = ref<DetailDialogExpose>()
  const checkerSearchSelection = ref<EmployeeIntegrationItem[]>([])
  const searchQuery = ref<SmisThreeViolationEducationSearchParams>({})
  const organizations = shallowRef<SmisAntiViolationOrganization[]>([])
  const standards = shallowRef<SmisAntiViolationStandardOption[]>([])
  const overview = reactive<SmisThreeViolationEducationOverview>({
    total: 0,
    pending: 0,
    educated: 0,
    warning: 0
  })

  const educationStatusOptions = computed(() =>
    (getDictMap.value.smisThreeViolationEducationStatus ?? []).map(toDictionaryOption)
  )
  const warningStatusOptions = computed(() =>
    (getDictMap.value.commonWarningStatus ?? []).map(toDictionaryOption)
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '教育记录',
      value: overview.total,
      description: '当前筛选范围',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '待教育',
      value: overview.pending,
      description: '需要推进闭环',
      icon: 'ri:time-line',
      tone: 'warning'
    },
    {
      label: '已教育',
      value: overview.educated,
      description: '台账证据已记录',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '预警人员',
      value: overview.warning,
      description: '需重点关注',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])

  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '所属公司',
      key: 'organizationId',
      type: 'treeSelect',
      props: {
        data: organizations.value,
        nodeKey: 'id',
        checkStrictly: true,
        clearable: true,
        defaultExpandAll: true,
        props: { label: 'name', value: 'id', children: 'children' },
        placeholder: '全部公司与组织'
      }
    },
    {
      label: '检查人',
      key: 'checkerEmployeeId',
      type: 'employeeSelect',
      props: {
        selectedData: checkerSearchSelection.value,
        title: '选择检查人',
        subtitle: '数据来自当前租户员工花名册',
        placeholder: '请选择检查人',
        'onUpdate:selectedData': (rows: EmployeeIntegrationItem[]) => {
          checkerSearchSelection.value = rows
        }
      }
    },
    {
      label: '教育状态',
      key: 'educationStatus',
      type: 'select',
      options: educationStatusOptions.value,
      props: { clearable: true, placeholder: '全部状态' }
    },
    {
      label: '检查时间',
      key: 'inspectionTimeRange',
      type: 'date',
      span: 12,
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        rangeSeparator: '至',
        clearable: true,
        class: '!w-full'
      }
    },
    {
      label: '预警状态',
      key: 'warningStatus',
      type: 'select',
      options: warningStatusOptions.value,
      props: { clearable: true, placeholder: '全部预警状态' }
    },
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '姓名、工号、问题或标准' }
    }
  ])

  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'employeeNo', title: '被检查人工号' },
    { key: 'employeeName', title: '被检查人' },
    { key: 'gender', title: '性别' },
    { key: 'age', title: '年龄' },
    { key: 'organizationName', title: '所属公司/组织' },
    { key: 'positionName', title: '岗位' },
    { key: 'checkerName', title: '检查人' },
    { key: 'inspectionTimeText', title: '检查时间' },
    { key: 'warningStatusText', title: '预警状态' },
    { key: 'educationStatusText', title: '教育状态' },
    { key: 'categoryName', title: '违章分类' },
    { key: 'standardName', title: '反违章标准' },
    { key: 'violationDescription', title: '三违问题描述' },
    { key: 'responsibleNames', title: '教育负责人' },
    { key: 'plannedEducationContent', title: '拟教育内容' },
    { key: 'educationContent', title: '教育培训内容' },
    { key: 'educationResult', title: '教育培训结果' },
    { key: 'educationCompletedAtText', title: '教育完成时间' },
    { key: 'trainingHours', title: '培训课时' },
    { key: 'examScore', title: '考核分数' },
    { key: 'remark', title: '备注' }
  ]

  const openDialog = (mode: ThreeViolationDialogMode, row?: SmisThreeViolationEducation): void => {
    void dialogRef.value?.handleOpen({ mode, row, standards: standards.value })
  }
  const openDetail = (row: SmisThreeViolationEducation): void => {
    void detailDialogRef.value?.handleOpen(row)
  }

  const formatEducationRows = (rows: SmisThreeViolationEducation[]) =>
    rows.map((row) => ({
      ...row,
      gender: formatGender(row.gender),
      inspectionTimeText: dayjs(row.inspectionTime).format('YYYY-MM-DD HH:mm'),
      warningStatusText: row.warningStatus === 'warning' ? '预警' : '正常',
      educationStatusText: row.educationStatus === 'educated' ? '已教育' : '待教育',
      responsibleNames: row.responsibleEmployees.map((item) => item.employeeName).join('、'),
      educationCompletedAtText: row.educationCompletedAt
        ? dayjs(row.educationCompletedAt).format('YYYY-MM-DD HH:mm')
        : ''
    }))

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'SmisThreeViolationEducation:View',
      key: 'view',
      label: '查看',
      icon: 'ri:eye-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) => openDetail(selectedRows[0] as SmisThreeViolationEducation)
    },
    {
      permission: 'SmisThreeViolationEducation:Add',
      type: 'add',
      label: '新增',
      onClick: () => openDialog('add')
    },
    {
      permission: 'SmisThreeViolationEducation:Copy',
      key: 'copy',
      label: '复制并新增',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) =>
        openDialog('copy', selectedRows[0] as SmisThreeViolationEducation)
    },
    {
      permission: 'SmisThreeViolationEducation:Edit',
      key: 'edit',
      label: '编辑',
      icon: 'ri:edit-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) =>
        selectedRows.length !== 1 || selectedRows[0]?.educationStatus !== 'pending',
      onClick: ({ selectedRows }) =>
        openDialog('edit', selectedRows[0] as SmisThreeViolationEducation)
    },
    {
      permission: 'SmisThreeViolationEducation:Delete',
      type: 'delete',
      confirm: false,
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 条待教育记录吗？已完成教育的台账不可删除。`,
      disabled: ({ selectedRows }) =>
        !selectedRows.length || selectedRows.some((row) => row.educationStatus !== 'pending'),
      onClick: async ({ selectedRows, api }) => {
        await deleteRecords({
          resources: selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: [row.employeeName, row.employeeNo].filter(Boolean).join(' · ') || '三违教育'
          })),
          permission: 'SmisThreeViolationEducation:Delete',
          remove: async () => {
            await deleteThreeViolationEducation(selectedRows.map((row) => String(row.id)))
          },
          onDeleted: async () => {
            await api.refreshRemove()
          }
        })
      }
    },
    {
      permission: 'SmisThreeViolationEducation:RecordEducation',
      key: 'recordEducation',
      label: '记录教育信息',
      icon: 'ri:graduation-cap-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) =>
        void recordDialogRef.value?.handleOpen(selectedRows[0] as SmisThreeViolationEducation)
    },
    {
      permission: 'SmisThreeViolationEducation:Print',
      key: 'print',
      label: '打印安全教育台账',
      icon: 'ri:printer-line',
      selectionRequired: true,
      disabled: ({ selectedRows }) => selectedRows.length !== 1,
      onClick: ({ selectedRows }) =>
        printThreeViolationLedger(selectedRows[0] as SmisThreeViolationEducation)
    },
    {
      permission: 'SmisThreeViolationEducation:Export',
      type: 'export',
      label: '导出',
      exportFilename: '三违人员教育信息',
      exportSheetName: '三违人员教育台账',
      exportColumns: excelColumns,
      exportApi: async ({ maxRows }) => ({
        data: formatEducationRows(
          (
            await fetchThreeViolationEducationList({
              ...searchQuery.value,
              purpose: 'export',
              from: 0,
              to: maxRows - 1
            })
          ).data
        )
      })
    }
  ])

  const columnsFactory = (): ColumnOption<SmisThreeViolationEducation>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'employeeName',
      label: '被检查人',
      minWidth: 210,
      fixed: 'left',
      link: { onClick: openDetail },
      formatter: (row) => (
        <div class="three-violation-page__employee">
          <ElAvatar size={38} src={row.avatarUrl || undefined}>
            {row.employeeName.slice(-1)}
          </ElAvatar>
          <div>
            <strong>{row.employeeName}</strong>
            <small>{[row.employeeNo, row.positionName].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
      )
    },
    { prop: 'organizationName', label: '所属公司/组织', minWidth: 190, showOverflowTooltip: true },
    {
      prop: 'warningStatus',
      label: '预警状态',
      width: 106,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonWarningStatus" value={row.warningStatus} display="tag" />
      )
    },
    {
      prop: 'educationStatus',
      label: '教育状态',
      width: 106,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="smisThreeViolationEducationStatus"
          value={row.educationStatus}
          display="tag"
        />
      )
    },
    { prop: 'checkerName', label: '检查人', width: 118, showOverflowTooltip: true },
    {
      prop: 'inspectionTime',
      label: '检查时间',
      width: 162,
      formatter: (row) => formatTableDateTime(row.inspectionTime)
    },
    { prop: 'categoryName', label: '违章分类', minWidth: 150, showOverflowTooltip: true },
    { prop: 'standardName', label: '反违章标准', minWidth: 220, showOverflowTooltip: true },
    {
      prop: 'violationDescription',
      label: '三违问题描述',
      minWidth: 300,
      showOverflowTooltip: true
    },
    {
      prop: 'responsibleEmployees',
      label: '教育负责人',
      minWidth: 160,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.responsibleEmployees.map((item) => item.employeeName).join('、') || '—'
    },
    {
      prop: 'educationCompletedAt',
      label: '教育完成时间',
      width: 162,
      formatter: (row) => formatTableDateTime2(row.educationCompletedAt)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 196,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            permission="SmisThreeViolationEducation:View"
            type="view"
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            permission="SmisThreeViolationEducation:RecordEducation"
            type="edit"
            icon="ri:graduation-cap-line"
            label={row.educationStatus === 'educated' ? '补充教育' : '记录教育'}
            onClick={() => void recordDialogRef.value?.handleOpen(row)}
          />
          <ArtButtonTable
            permission="SmisThreeViolationEducation:Edit"
            type="edit"
            disabled={row.educationStatus !== 'pending'}
            onClick={() => openDialog('edit', row)}
          />
          <ArtButtonMore
            list={[
              {
                key: 'copy',
                label: '复制并新增',
                icon: 'ri:file-copy-line',
                auth: 'SmisThreeViolationEducation:Copy'
              },
              {
                key: 'print',
                label: '打印安全教育台账',
                icon: 'ri:printer-line',
                auth: 'SmisThreeViolationEducation:Print'
              },
              {
                key: 'delete',
                label: '删除',
                icon: 'ri:delete-bin-line',
                color: 'var(--el-color-danger)',
                disabled: row.educationStatus !== 'pending',
                auth: 'SmisThreeViolationEducation:Delete'
              }
            ]}
            onClick={(item: ButtonMoreItem) => void handleMoreAction(item, row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  const fetchTableData = async (params: TableParams, options?: TableRequestOptions) => {
    const result = await fetchThreeViolationEducationList({
      ...params,
      ...buildSupabasePageRange(params)
    })
    organizations.value = result.organizations
    standards.value = result.standards
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return { records: result.data, total: result.total }
  }

  const handleMoreAction = async (
    item: ButtonMoreItem,
    row: SmisThreeViolationEducation
  ): Promise<void> => {
    if (item.key === 'copy') openDialog('copy', row)
    if (item.key === 'print') printThreeViolationLedger(row)
    if (item.key !== 'delete') return

    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: [row.employeeName, row.employeeNo].filter(Boolean).join(' · ') || '三违教育'
        }
      ],
      permission: 'SmisThreeViolationEducation:Delete',
      confirmMessage: `确定删除“${row.employeeName}”的待教育记录吗？`,
      remove: async () => {
        await deleteThreeViolationEducation([row.id ?? ''])
      },
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }

  const handleSaveSuccess = (): void => void tableQueryRef.value?.getData()

  watch(
    () => searchQuery.value.checkerEmployeeId,
    (value) => {
      if (!value) checkerSearchSelection.value = []
    }
  )

  onMounted(
    () =>
      void Promise.all([
        userStore.ensureDictLoaded('commonWarningStatus'),
        userStore.ensureDictLoaded('smisThreeViolationEducationStatus')
      ])
  )
</script>

<style scoped lang="scss">
  .three-violation-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;

    &__table {
      flex: 1;
      min-height: 0;
    }

    :deep(.three-violation-page__employee) {
      display: flex;
      gap: 10px;
      align-items: center;
      min-width: 0;

      > div {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
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
  }
</style>
