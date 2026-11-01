<template>
  <ArtPermissionGuard permission="SmisEmergencyDrillReport:View">
    <div class="drill-report-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="DRILL INSIGHTS"
        title="应急演练报表"
        description="按日期和组织分析演练兑现、频次、迟延情况与未兑现计划。"
        icon="ri:bar-chart-box-line"
        :tags="[
          { label: '多维检索', type: 'primary', effect: 'plain' },
          {
            label: loadError
              ? '演练统计暂不可用'
              : loading
                ? '正在加载演练统计'
                : `延迟完成 ${overview.lateCount}`,
            type: loadError
              ? 'warning'
              : loading
                ? 'info'
                : overview.lateCount
                  ? 'danger'
                  : 'success',
            effect: 'light'
          },
          { label: '未兑现计划可追溯', type: 'warning', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
        <template #actions>
          <ElButton
            v-auth="'SmisEmergencyDrillReport:Export'"
            type="primary"
            plain
            :loading="exportLoading"
            :disabled="loading || !!loadError"
            @click="handleExport"
          >
            <ArtSvgIcon icon="ri:file-excel-2-line" />
            导出 Excel
          </ElButton>
        </template>
      </BusinessWorkspaceHeader>
      <ElScrollbar class="drill-report-page__scroll">
        <div class="drill-report-page__body">
          <ArtSearchBar
            v-model="query"
            :items="searchItems"
            :span="6"
            label-position="top"
            :show-expand="false"
            :disabled-search="loading"
            @search="loadReport"
            @reset="resetQuery"
          />
          <div class="drill-report-page__content">
            <ArtSectionCard
              class="drill-report-page__panel"
              title="演练执行分析"
              subtitle="按组织、计划类别和演练级别聚合"
              :loading="loading"
              :error="loadError"
              :empty="!loading && !loadError && rows.length === 0"
              empty-title="暂无演练计划统计"
              empty-description="调整日期或演练单位范围后重新查询。"
              :min-height="320"
              @retry="loadReport"
            >
              <template #actions
                ><ElTag type="success" effect="plain">{{ rows.length }} 个维度</ElTag></template
              >
              <div class="drill-report-page__analysis-summary" aria-label="演练执行摘要">
                <div class="drill-report-page__analysis-item">
                  <span>冲刺率</span>
                  <strong>{{ sprintRate }}%</strong>
                  <small>兑现数 ÷ 计划数</small>
                </div>
                <div class="drill-report-page__analysis-item">
                  <span>实际演练</span>
                  <strong>{{ totalDrillCount }}</strong>
                  <small>当前筛选范围累计次数</small>
                </div>
                <div class="drill-report-page__analysis-item">
                  <span>覆盖组织</span>
                  <strong>{{ coveredOrganizationCount }}</strong>
                  <small>已开展演练的组织数量</small>
                </div>
              </div>
              <ArtTable
                :data="rows"
                :pagination="false"
                class="drill-report-page__table"
                table-layout="fixed"
                empty-text="当前筛选范围暂无演练计划统计"
              >
                <ElTableColumn
                  prop="organizationName"
                  label="演练单位"
                  min-width="180"
                  show-overflow-tooltip
                />
                <ElTableColumn prop="planCategory" label="计划类别" width="150"
                  ><template #default="{ row }"
                    ><ArtDictDisplay
                      dict-code="smisEmergencyPlanCategory"
                      :value="row.planCategory"
                      display="tag" /></template
                ></ElTableColumn>
                <ElTableColumn prop="planLevel" label="演练级别" width="130"
                  ><template #default="{ row }"
                    ><ArtDictDisplay
                      dict-code="smisEmergencyPlanLevel"
                      :value="row.planLevel" /></template
                ></ElTableColumn>
                <ElTableColumn prop="planCount" label="计划数" width="88" align="center" />
                <ElTableColumn prop="completedCount" label="兑现数" width="88" align="center" />
                <ElTableColumn prop="sprintRate" label="冲刺率" width="96" align="center"
                  ><template #default="{ row }"
                    ><strong class="drill-report-page__rate"
                      >{{ row.sprintRate }}%</strong
                    ></template
                  ></ElTableColumn
                >
                <ElTableColumn prop="drillCount" label="实际演练次数" width="130" align="center"
                  ><template #default="{ row }"
                    ><strong class="drill-report-page__number">{{
                      row.drillCount
                    }}</strong></template
                  ></ElTableColumn
                >
                <ElTableColumn
                  prop="averageIntervalDays"
                  label="平均间隔"
                  width="130"
                  align="center"
                  ><template #default="{ row }">{{
                    row.averageIntervalDays == null ? '单次演练' : `${row.averageIntervalDays} 天`
                  }}</template></ElTableColumn
                >
                <ElTableColumn prop="lateCount" label="延迟完成" width="110" align="center"
                  ><template #default="{ row }"
                    ><ElTag :type="row.lateCount ? 'danger' : 'success'" effect="light">{{
                      row.lateCount
                    }}</ElTag></template
                  ></ElTableColumn
                >
              </ArtTable>
            </ArtSectionCard>
            <aside class="drill-report-page__aside" aria-label="未兑现计划与统计口径">
              <ArtSectionCard
                class="drill-report-page__panel drill-report-page__panel--warning"
                title="未兑现演练计划"
                subtitle="计划中且尚无已提交演练记录"
                :loading="loading"
                :error="loadError"
                :empty="!loading && !loadError && outstanding.length === 0"
                empty-title="当前范围没有未兑现计划"
                empty-description="所有计划均已兑现，或可调整筛选范围继续查看。"
                :empty-visual-size="72"
                :min-height="240"
                @retry="loadReport"
              >
                <template #actions
                  ><ElTag :type="outstanding.length ? 'warning' : 'success'" effect="light"
                    >{{ outstanding.length }} 条</ElTag
                  ></template
                >
                <ArtTable
                  :data="outstanding"
                  :pagination="false"
                  height="auto"
                  table-layout="fixed"
                  empty-text="很好，当前范围没有未兑现演练计划"
                >
                  <ElTableColumn
                    prop="drillName"
                    label="演练计划"
                    min-width="210"
                    show-overflow-tooltip
                    ><template #default="{ row }"
                      ><div class="drill-report-page__plan"
                        ><strong>{{ row.drillName }}</strong
                        ><small>{{ row.planNo }}</small></div
                      ></template
                    ></ElTableColumn
                  >
                  <ElTableColumn
                    prop="organizationName"
                    label="演练单位"
                    min-width="150"
                    show-overflow-tooltip
                  />
                  <ElTableColumn prop="planEndDate" label="计划完成日" width="120" />
                  <ElTableColumn prop="warningStatus" label="状态" width="92"
                    ><template #default="{ row }"
                      ><ArtDictDisplay
                        dict-code="commonWarningStatus"
                        :value="row.warningStatus"
                        display="tag" /></template
                  ></ElTableColumn>
                </ArtTable>
              </ArtSectionCard>
              <section
                class="drill-report-page__scope art-card-xs"
                aria-labelledby="report-scope-title"
              >
                <div class="drill-report-page__scope-heading">
                  <span aria-hidden="true"><ArtSvgIcon icon="ri:information-line" /></span>
                  <div>
                    <h2 id="report-scope-title">统计口径</h2>
                    <p>帮助快速理解报表中的关键状态</p>
                  </div>
                </div>
                <ul>
                  <li>
                    <span class="is-success" aria-hidden="true"
                      ><ArtSvgIcon icon="ri:checkbox-circle-line"
                    /></span>
                    <p><strong>已兑现</strong><small>计划已关联一条正式提交的演练记录</small></p>
                  </li>
                  <li>
                    <span class="is-warning" aria-hidden="true"
                      ><ArtSvgIcon icon="ri:time-line"
                    /></span>
                    <p><strong>延迟完成</strong><small>实际演练日期晚于计划完成日期</small></p>
                  </li>
                  <li>
                    <span class="is-danger" aria-hidden="true"
                      ><ArtSvgIcon icon="ri:alarm-warning-line"
                    /></span>
                    <p><strong>预警中</strong><small>计划将在三日内到期，或当前已逾期</small></p>
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </ElScrollbar>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { ElMessage } from 'element-plus'
  import { sumBy, uniq } from 'lodash-es'
  import { fetchEnabledOrganizationTree } from '@/api/system-manage'
  import { useUserStore } from '@/store/modules/user'
  import { exportExcel, type ExcelColumn } from '@/utils/file'
  import ArtSearchBar, {
    type SearchFormItem
  } from '@/components/core/forms/art-search-bar/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchEmergencyDrillReport,
    type SmisEmergencyDrillReportRow,
    type SmisEmergencyOutstandingPlan,
    type SmisTreeOrganization
  } from '@smis/api'

  defineOptions({ name: 'SmisEmergencyDrillReport' })
  interface ReportQuery extends Record<string, unknown> {
    startDate?: string
    endDate?: string
    organizationId?: string
  }
  interface ReportExportRow extends Record<string, unknown> {
    recordType: string
    organizationName: string
    planCategory: string
    planLevel: string
    planCount: number | string
    completedCount: number | string
    sprintRate: string
    drillCount: number | string
    lateCount: number | string
    averageIntervalDays: number | string
    planNo: string
    drillName: string
    planEndDate: string
    warningStatus: string
  }
  const userStore = useUserStore()
  const { getUserInfo } = storeToRefs(userStore)
  const query = ref<ReportQuery>({})
  const appliedQuery = shallowRef<ReportQuery>({})
  let reportRequestId = 0
  onBeforeUnmount(() => {
    reportRequestId += 1
  })
  const loading = ref(false)
  const exportLoading = ref(false)
  const loadError = shallowRef<Error | null>(null)
  const organizations = shallowRef<SmisTreeOrganization[]>([])
  const rows = shallowRef<SmisEmergencyDrillReportRow[]>([])
  const outstanding = shallowRef<SmisEmergencyOutstandingPlan[]>([])
  const overview = reactive({
    planCount: 0,
    completedCount: 0,
    outstandingCount: 0,
    warningCount: 0,
    lateCount: 0
  })
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '计划总数',
      value: loadError.value ? '—' : overview.planCount,
      loading: loading.value,
      description: '筛选范围内计划',
      icon: 'ri:calendar-todo-line'
    },
    {
      label: '已兑现',
      value: loadError.value ? '—' : overview.completedCount,
      loading: loading.value,
      description: '已有正式演练记录',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '未兑现',
      value: loadError.value ? '—' : overview.outstandingCount,
      loading: loading.value,
      description: '计划中且无正式记录',
      icon: 'ri:time-line',
      tone: 'warning'
    },
    {
      label: '预警中',
      value: loadError.value ? '—' : overview.warningCount,
      loading: loading.value,
      description: '三日内到期或已逾期',
      icon: 'ri:alarm-warning-line',
      tone: 'danger'
    }
  ])
  const calculateSprintRate = (completedCount: number, planCount: number): number =>
    planCount ? Math.round((completedCount / planCount) * 1000) / 10 : 0
  const sprintRate = computed(() =>
    calculateSprintRate(overview.completedCount, overview.planCount)
  )
  const totalDrillCount = computed(() => sumBy(rows.value, 'drillCount'))
  const coveredOrganizationCount = computed(
    () => uniq(rows.value.map((row) => row.organizationName).filter(Boolean)).length
  )
  const exportColumns: ExcelColumn<ReportExportRow>[] = [
    { key: 'recordType', title: '报表分区', width: 14 },
    { key: 'organizationName', title: '演练单位', width: 24 },
    { key: 'planCategory', title: '计划类别', width: 16 },
    { key: 'planLevel', title: '演练级别', width: 14 },
    { key: 'planCount', title: '计划数', width: 10 },
    { key: 'completedCount', title: '兑现数', width: 10 },
    { key: 'sprintRate', title: '冲刺率', width: 12 },
    { key: 'drillCount', title: '实际演练次数', width: 14 },
    { key: 'lateCount', title: '延迟完成数', width: 12 },
    { key: 'averageIntervalDays', title: '平均间隔（天）', width: 16 },
    { key: 'planNo', title: '未兑现计划编号', width: 20 },
    { key: 'drillName', title: '未兑现演练计划', width: 28 },
    { key: 'planEndDate', title: '计划完成日', width: 14 },
    { key: 'warningStatus', title: '预警状态', width: 12 }
  ]
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '开始日期',
      key: 'startDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', clearable: true, placeholder: '选择开始日期' }
    },
    {
      label: '结束日期',
      key: 'endDate',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', clearable: true, placeholder: '选择结束日期' }
    },
    {
      label: '演练单位',
      key: 'organizationId',
      type: 'treeSelect',
      props: {
        data: organizations.value,
        props: { label: 'organizationName', children: 'children' },
        nodeKey: 'id',
        valueKey: 'id',
        checkStrictly: true,
        filterable: true,
        clearable: true,
        defaultExpandAll: true,
        placeholder: '全部组织'
      }
    }
  ])
  const applyReport = (
    result: Awaited<ReturnType<typeof fetchEmergencyDrillReport>>,
    filters: ReportQuery = {}
  ): void => {
    if (result.error) {
      loadError.value = new Error('演练报表加载失败，请重试')
      return
    }
    Object.assign(overview, result.overview)
    rows.value = result.rows
    outstanding.value = result.outstanding
    appliedQuery.value = filters
  }
  const loadReport = async (): Promise<void> => {
    if (
      query.value.startDate &&
      query.value.endDate &&
      query.value.startDate > query.value.endDate
    ) {
      ElMessage.warning('开始日期不能晚于结束日期')
      return
    }
    const currentRequestId = ++reportRequestId
    const filters = { ...query.value }
    loading.value = true
    loadError.value = null
    try {
      const result = await fetchEmergencyDrillReport(filters)
      if (currentRequestId === reportRequestId) applyReport(result, filters)
    } catch {
      if (currentRequestId === reportRequestId)
        loadError.value = new Error('演练报表加载失败，请重试')
    } finally {
      if (currentRequestId === reportRequestId) loading.value = false
    }
  }
  const resetQuery = () => {
    Object.assign(query.value, {
      startDate: undefined,
      endDate: undefined,
      organizationId: undefined
    })
    void loadReport()
  }
  const handleExport = async (): Promise<void> => {
    if (!overview.planCount && !rows.value.length && !outstanding.value.length) {
      ElMessage.warning('当前筛选范围暂无可导出的演练报表数据')
      return
    }
    exportLoading.value = true
    try {
      const summary: ReportExportRow = {
        recordType: '汇总',
        organizationName: appliedQuery.value.organizationId ? '当前所选组织' : '全部组织',
        planCategory: '',
        planLevel: '',
        planCount: overview.planCount,
        completedCount: overview.completedCount,
        sprintRate: `${sprintRate.value}%`,
        drillCount: overview.completedCount,
        lateCount: overview.lateCount,
        averageIntervalDays: '',
        planNo: '',
        drillName: '',
        planEndDate: '',
        warningStatus: ''
      }
      const groupedRows: ReportExportRow[] = rows.value.map((row) => ({
        recordType: '执行分析',
        organizationName: row.organizationName,
        planCategory: userStore.getDictDisplayLabelByValue(
          'smisEmergencyPlanCategory',
          row.planCategory,
          row.planCategory || '—'
        ),
        planLevel: userStore.getDictDisplayLabelByValue(
          'smisEmergencyPlanLevel',
          row.planLevel,
          row.planLevel || '—'
        ),
        planCount: row.planCount,
        completedCount: row.completedCount,
        sprintRate: `${row.sprintRate}%`,
        drillCount: row.drillCount,
        lateCount: row.lateCount,
        averageIntervalDays: row.averageIntervalDays ?? '',
        planNo: '',
        drillName: '',
        planEndDate: '',
        warningStatus: ''
      }))
      const outstandingRows: ReportExportRow[] = outstanding.value.map((row) => ({
        recordType: '未兑现计划',
        organizationName: row.organizationName,
        planCategory: userStore.getDictDisplayLabelByValue(
          'smisEmergencyPlanCategory',
          row.planCategory,
          row.planCategory || '—'
        ),
        planLevel: userStore.getDictDisplayLabelByValue(
          'smisEmergencyPlanLevel',
          row.planLevel,
          row.planLevel || '—'
        ),
        planCount: '',
        completedCount: '',
        sprintRate: '',
        drillCount: '',
        lateCount: '',
        averageIntervalDays: '',
        planNo: row.planNo,
        drillName: row.drillName,
        planEndDate: row.planEndDate || '',
        warningStatus: userStore.getDictDisplayLabelByValue(
          'commonWarningStatus',
          row.warningStatus,
          row.warningStatus || '—'
        )
      }))
      await exportExcel({
        data: [summary, ...groupedRows, ...outstandingRows],
        columns: exportColumns,
        filename: '应急演练报表',
        sheetName: '演练统计',
        autoIndex: true
      })
      ElMessage.success('应急演练报表已导出')
    } catch (error) {
      ElMessage.error(getFriendlySupabaseErrorMessage(error, '报表导出失败，请重试'))
    } finally {
      exportLoading.value = false
    }
  }
  onMounted(async () => {
    const currentRequestId = ++reportRequestId
    loading.value = true
    loadError.value = null
    try {
      const [tree, result] = await Promise.all([
        fetchEnabledOrganizationTree({ tenantId: getUserInfo.value.tenantId }),
        fetchEmergencyDrillReport(),
        Promise.all(
          ['smisEmergencyPlanCategory', 'smisEmergencyPlanLevel', 'commonWarningStatus'].map(
            (code) => userStore.ensureDictLoaded(code)
          )
        )
      ])
      organizations.value = (tree.data ?? []) as SmisTreeOrganization[]
      if (currentRequestId === reportRequestId) applyReport(result)
    } catch {
      if (currentRequestId === reportRequestId)
        loadError.value = new Error('演练报表加载失败，请重试')
    } finally {
      if (currentRequestId === reportRequestId) loading.value = false
    }
  })
</script>

<style scoped lang="scss">
  .drill-report-page {
    gap: 12px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;

    &__scroll {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    &__body {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      height: 100%;
      min-height: 560px;
    }

    &__content {
      display: grid;
      flex: 1;
      grid-template-columns: minmax(0, 1.42fr) minmax(380px, 0.58fr);
      gap: 12px;
      min-height: 0;
    }

    &__panel {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;

      :deep(.art-section-card__body) {
        flex: 1;
        min-height: 0;
      }

      &--warning {
        flex: 1;
        border-top: 2px solid color-mix(in srgb, var(--el-color-warning) 58%, transparent);
      }
    }

    &__analysis-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--art-space-3);
      margin-bottom: var(--art-space-4);
    }

    &__analysis-item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 2px var(--art-space-3);
      align-items: center;
      min-width: 0;
      padding: var(--art-space-3) var(--art-space-4);
      background: color-mix(in srgb, var(--theme-color) 4%, var(--el-fill-color-lighter));
      border: 1px solid color-mix(in srgb, var(--theme-color) 10%, var(--el-border-color-lighter));
      border-radius: var(--el-border-radius-base);

      span {
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }

      strong {
        grid-row: span 2;
        font-size: 22px;
        line-height: 1;
        color: var(--el-text-color-primary);
      }

      small {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: var(--el-text-color-placeholder);
        white-space: nowrap;
      }
    }

    &__table {
      min-height: 220px;
    }

    &__aside {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      min-height: 0;
    }

    &__scope {
      flex: none;
      padding: var(--art-space-4) var(--art-space-5);
    }

    &__scope-heading {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;

      > span {
        display: grid;
        flex: none;
        place-items: center;
        width: 34px;
        height: 34px;
        font-size: 18px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 10%, transparent);
        border-radius: var(--el-border-radius-base);
      }

      h2,
      p {
        margin: 0;
      }

      h2 {
        font-size: var(--art-font-size-section-title);
        color: var(--el-text-color-primary);
      }

      p {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__scope ul {
      display: grid;
      gap: var(--art-space-3);
      padding: 0;
      margin: var(--art-space-4) 0 0;
      list-style: none;
    }

    &__scope li {
      display: flex;
      gap: var(--art-space-3);
      align-items: flex-start;

      > span {
        display: grid;
        flex: none;
        place-items: center;
        width: 28px;
        height: 28px;
        margin-top: 1px;
        font-size: 15px;
        border-radius: var(--el-border-radius-small);

        &.is-success {
          color: var(--el-color-success);
          background: var(--el-color-success-light-9);
        }

        &.is-warning {
          color: var(--el-color-warning);
          background: var(--el-color-warning-light-9);
        }

        &.is-danger {
          color: var(--el-color-danger);
          background: var(--el-color-danger-light-9);
        }
      }

      p {
        display: grid;
        gap: 2px;
        min-width: 0;
        margin: 0;
      }

      strong {
        font-size: var(--art-font-size-body);
        color: var(--el-text-color-primary);
      }

      small {
        font-size: 11px;
        line-height: 18px;
        color: var(--el-text-color-secondary);
      }
    }

    &__number {
      font-size: 18px;
      color: var(--theme-color);
    }

    &__rate {
      color: var(--el-color-success);
    }

    &__plan {
      display: grid;
      min-width: 0;

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

    @media (width <= 1180px) {
      &__body {
        height: auto;
        min-height: 960px;
      }

      &__content {
        grid-template-rows: minmax(400px, 1fr) minmax(360px, 0.85fr);
        grid-template-columns: 1fr;
      }

      &__aside {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
      }
    }

    @media (width <= 760px) {
      &__analysis-summary,
      &__aside {
        grid-template-columns: 1fr;
      }

      &__analysis-summary {
        gap: var(--art-space-2);
      }

      &__analysis-item {
        padding: var(--art-space-3);
      }
    }
  }
</style>
