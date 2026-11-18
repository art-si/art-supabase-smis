<template>
  <ArtDialog ref="dialogRef">
    <div class="inspection-detail-dialog">
      <div class="inspection-detail-dialog__summary art-card-xs">
        <div>
          <span>统计组织</span>
          <strong>{{ openData?.row.organizationName || '—' }}</strong>
        </div>
        <div>
          <span>{{ reportType === 'inspection_rate' ? '待排查任务' : '漏查任务' }}</span>
          <strong>{{ state.records.length }}</strong>
        </div>
        <div>
          <span>涉及人员</span>
          <strong>{{ state.personnelIssues.length }}</strong>
        </div>
        <div>
          <span>统计区间</span>
          <strong>{{ rangeText }}</strong>
        </div>
      </div>

      <ElTabs
        v-model="activeTab"
        class="inspection-detail-dialog__tabs art-card-xs art-overlay-tab-card"
      >
        <ElTabPane
          :label="reportType === 'inspection_rate' ? '待排查明细' : '漏查明细'"
          name="tasks"
        >
          <ArtTable
            :data="state.records"
            :columns="taskColumns"
            :pagination="false"
            table-layout="fixed"
            max-height="430"
            :empty-text="reportType === 'inspection_rate' ? '暂无待排查任务' : '暂无漏查任务'"
          />
        </ElTabPane>
        <ElTabPane label="排查人员问题" name="personnel">
          <ArtTable
            :data="state.personnelIssues"
            :columns="personnelColumns"
            :pagination="false"
            table-layout="fixed"
            max-height="430"
            empty-text="暂无人员问题统计"
          />
        </ElTabPane>
      </ElTabs>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import dayjs from 'dayjs'
  import { ElTag } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import {
    fetchRiskInspectionStatisticsDetail,
    type SmisInspectionOrganizationStat,
    type SmisInspectionPersonnelIssue,
    type SmisInspectionStatisticsDetailRecord,
    type SmisInspectionStatisticsReportType
  } from '@smis/api'

  export interface InspectionStatisticsDetailOpenData {
    reportType: SmisInspectionStatisticsReportType
    row: SmisInspectionOrganizationStat
    plannedFrom?: string
    plannedTo?: string
    riskLevel?: string
  }

  const dialogRef = ref<ArtDialogExpose<InspectionStatisticsDetailOpenData>>()
  const openData = shallowRef<InspectionStatisticsDetailOpenData>()
  const reportType = computed(() => openData.value?.reportType ?? 'inspection_rate')
  const activeTab = ref<'tasks' | 'personnel'>('tasks')
  const state = reactive<{
    records: SmisInspectionStatisticsDetailRecord[]
    personnelIssues: SmisInspectionPersonnelIssue[]
  }>({ records: [], personnelIssues: [] })
  const rangeText = computed(() => {
    const start = openData.value?.plannedFrom
      ? dayjs(openData.value.plannedFrom).format('YYYY-MM-DD')
      : '不限'
    const end = openData.value?.plannedTo
      ? dayjs(openData.value.plannedTo).format('YYYY-MM-DD')
      : '不限'
    return `${start} 至 ${end}`
  })
  const formatDateTime = createDateTimeFormatter({ format: 'YYYY-MM-DD HH:mm', emptyText: '—' })

  const taskColumns: ColumnOption<SmisInspectionStatisticsDetailRecord>[] = [
    { type: 'globalIndex', label: '序号', width: 68 },
    { prop: 'taskNo', label: '任务编号', width: 150, fixed: 'left' },
    { prop: 'riskPointName', label: '风险点', minWidth: 170, showOverflowTooltip: true },
    { prop: 'riskLevelNames', label: '风险级别', minWidth: 120, showOverflowTooltip: true },
    {
      prop: 'executorName',
      label: '执行人',
      minWidth: 150,
      formatter: (row) => (
        <BusinessTableIdentityCell primary={row.executorName} secondary={row.executorNo} />
      )
    },
    {
      prop: 'status',
      label: '任务状态',
      width: 108,
      formatter: (row) => (
        <ArtDictDisplay dictCode="smisRiskInspectionTaskStatus" value={row.status} display="tag" />
      )
    },
    {
      prop: 'plannedStartAt',
      label: '计划开始时间',
      width: 164,
      formatter: (row) => formatDateTime(row.plannedStartAt)
    },
    {
      prop: 'plannedEndAt',
      label: '计划结束时间',
      width: 164,
      formatter: (row) => formatDateTime(row.plannedEndAt)
    },
    { prop: 'itemCount', label: '排查项', width: 86, align: 'right' },
    { prop: 'normalCount', label: '正常', width: 78, align: 'right' },
    { prop: 'abnormalCount', label: '异常', width: 78, align: 'right' },
    {
      prop: 'missedFrequency',
      label: '漏查次数',
      width: 96,
      align: 'right',
      formatter: (row) => (row.missed ? row.missedFrequency : '—')
    },
    {
      prop: 'repeatedMissed',
      label: '重复漏查',
      width: 98,
      formatter: (row) =>
        row.repeatedMissed ? (
          <ElTag type="danger" effect="plain">
            是
          </ElTag>
        ) : (
          '—'
        )
    }
  ]
  const personnelColumns: ColumnOption<SmisInspectionPersonnelIssue>[] = [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'executorName',
      label: '排查人员',
      minWidth: 180,
      formatter: (row) => (
        <BusinessTableIdentityCell primary={row.executorName} secondary={row.executorNo} />
      )
    },
    { prop: 'riskPointCount', label: '涉及风险点', width: 120, align: 'right' },
    { prop: 'pendingCount', label: '待排查任务', width: 120, align: 'right' },
    { prop: 'missedCount', label: '漏查任务', width: 112, align: 'right' },
    {
      prop: 'earliestDeadline',
      label: '最早计划结束时间',
      minWidth: 180,
      formatter: (row) => formatDateTime(row.earliestDeadline)
    }
  ]

  const handleOpen = async (data: InspectionStatisticsDetailOpenData): Promise<void> => {
    openData.value = data
    activeTab.value = 'tasks'
    Object.assign(state, { records: [], personnelIssues: [] })
    await dialogRef.value?.handleOpen(data, {
      title: data.reportType === 'inspection_rate' ? '排查率统计明细' : '漏查率统计明细',
      size: 'xl',
      contentHeight: 'min(68vh, 650px)',
      showFooter: false,
      onOpen: async (_openData, api) => {
        api.setLoading(true)
        try {
          const result = await fetchRiskInspectionStatisticsDetail({
            reportType: data.reportType,
            organizationId: data.row.organizationId || '',
            plannedFrom: data.plannedFrom,
            plannedTo: data.plannedTo,
            riskLevel: data.riskLevel
          })
          Object.assign(state, {
            records: result.records,
            personnelIssues: result.personnelIssues
          })
        } finally {
          api.setLoading(false)
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .inspection-detail-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--art-space-4);
    min-width: 0;
    height: 100%;

    &__summary {
      display: grid;
      grid-template-columns: 1.4fr repeat(2, minmax(120px, 0.55fr)) minmax(220px, 1fr);
      gap: 1px;
      padding: 0;
      overflow: hidden;
      background: var(--el-border-color-lighter);

      > div {
        display: grid;
        gap: 3px;
        min-width: 0;
        padding: 12px 16px;
        background: var(--default-box-color);
      }

      span {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 14px;
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }
    }

    &__tabs {
      flex: 1;
      min-height: 0;
    }

    @media (width <= 900px) {
      &__summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  }
</style>
