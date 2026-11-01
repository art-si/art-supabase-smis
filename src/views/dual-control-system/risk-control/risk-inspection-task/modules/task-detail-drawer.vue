<template>
  <ArtDrawer
    @open="
      () => {
        activeDetailTab = 'section-0'
      }
    "
    ref="drawerRef"
    :loading="loading"
    loading-text="正在加载任务详情…"
  >
    <ArtAsyncState
      v-if="loadError"
      :error="loadError"
      error-title="巡查任务加载失败"
      @retry="retryLoad"
    />
    <div v-if="detail" class="task-detail-drawer">
      <div class="task-detail-drawer__status" :data-status="detail.status">
        <span><ArtSvgIcon icon="ri:clipboard-line" /></span>
        <div
          ><small>任务编号</small><strong>{{ detail.taskNo }}</strong
          ><p>{{ detail.riskPointName }} · {{ detail.riskPointNo }}</p></div
        >
        <ArtDictDisplay
          dict-code="smisRiskInspectionTaskStatus"
          :value="detail.status"
          display="tag"
        />
      </div>

      <ElTabs v-model="activeDetailTab"
        ><ElTabPane name="section-0" label="任务计划"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle title="任务计划" subtitle="风险对象、管控责任与执行时限" />
            <dl class="task-detail-drawer__plan-grid">
              <div>
                <dt>风险点类型</dt>
                <dd
                  ><ArtDictDisplay dict-code="smisRiskPointType" :value="detail.riskPointType"
                /></dd>
              </div>
              <div>
                <dt>风险等级</dt>
                <dd>
                  <span
                    class="task-detail-drawer__risk"
                    :style="{ '--risk-color': detail.riskLevelColor }"
                  >
                    {{ detail.riskLevelName || '待评价' }}
                  </span>
                </dd>
              </div>
              <div>
                <dt>管控层级</dt>
                <dd
                  ><ArtDictDisplay dict-code="smisRiskControlLevel" :value="detail.controlLevel"
                /></dd>
              </div>
              <div>
                <dt>管控责任人</dt>
                <dd>{{ detail.responsibleEmployeeName }} · {{ detail.responsibleEmployeeNo }}</dd>
              </div>
              <div>
                <dt>当前接收人</dt>
                <dd>{{ detail.assigneeEmployeeName }} · {{ detail.assigneeEmployeeNo }}</dd>
              </div>
              <div>
                <dt>实际执行人</dt>
                <dd>{{ detail.actualExecutorEmployeeName || '尚未执行' }}</dd>
              </div>
              <div>
                <dt>计划开始</dt>
                <dd>{{ formatDate(detail.plannedStartAt) }}</dd>
              </div>
              <div>
                <dt>计划完成</dt>
                <dd>{{ formatDate(detail.plannedEndAt) }}</dd>
              </div>
              <div>
                <dt>实际开始</dt>
                <dd>{{ formatDate(detail.actualStartAt) }}</dd>
              </div>
              <div>
                <dt>完成时间</dt>
                <dd>{{ formatDate(detail.completedAt) }}</dd>
              </div>
            </dl>
          </div></ElTabPane
        >
        <ElTabPane name="section-1" label="执行情况"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle
              title="巡查项目"
              :subtitle="`共 ${detail.items.length} 项，异常 ${abnormalCount} 项`"
            />
            <ul v-if="detail.items.length" class="task-detail-drawer__inspection-list">
              <li v-for="(item, index) in detail.items" :key="item.id" :data-result="item.result">
                <span class="task-detail-drawer__item-index">{{ index + 1 }}</span>
                <div class="task-detail-drawer__item-identity">
                  <strong>{{ item.hazardSource || '关联风险项已删除' }}</strong>
                  <small>{{ item.hazardNo || '历史快照' }}</small>
                </div>
                <div class="task-detail-drawer__item-content">
                  <small>排查内容 / 控制措施</small>
                  <p>{{ item.inspectionContent || '暂无排查内容' }}</p>
                </div>
                <div class="task-detail-drawer__item-result">
                  <ArtDictDisplay
                    dict-code="smisRiskInspectionResult"
                    :value="item.result"
                    display="tag"
                  />
                  <small>{{ item.remark || '暂无执行备注' }}</small>
                </div>
              </li>
            </ul>
            <ArtEmptyState
              v-else
              title="暂无巡查项目"
              description="为任务配置巡查项目后，可在此查看执行要求。"
              size="compact"
              :visual-size="64"
            /> </div
        ></ElTabPane>
        <ElTabPane name="section-2" label="执行记录"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle title="执行记录" subtitle="任务生成、转交、进度保存与完成事件" />
            <ElTimeline class="task-detail-drawer__timeline">
              <ElTimelineItem
                v-for="event in [...detail.events].reverse()"
                :key="event.id"
                :timestamp="formatDate(event.eventAt)"
                placement="top"
              >
                <div class="task-detail-drawer__event"
                  ><strong>{{ eventLabel(event.eventType) }}</strong
                  ><p>{{ event.eventContent || '系统记录' }}</p
                  ><small>{{ event.operatorName || '系统' }}</small></div
                >
              </ElTimelineItem>
            </ElTimeline>

            <div
              v-if="detail.executionSummary || detail.transferReason || detail.cancellationReason"
              class="task-detail-drawer__notes"
            >
              <p v-if="detail.executionSummary"
                ><strong>执行总结</strong>{{ detail.executionSummary }}</p
              >
              <p v-if="detail.transferReason"
                ><strong>最近转交原因</strong>{{ detail.transferReason }}</p
              >
              <p v-if="detail.cancellationReason"
                ><strong>取消原因</strong>{{ detail.cancellationReason }}</p
              >
            </div></div
          ></ElTabPane
        ></ElTabs
      >
    </div>
  </ArtDrawer>
</template>

<script setup lang="ts">
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import { useDetailRecord } from '@/hooks/core/useDetailRecord'
  import {
    fetchRiskInspectionTaskDetail,
    type SmisRiskInspectionTask,
    type SmisRiskInspectionTaskDetail,
    type SmisRiskInspectionTaskEvent
  } from '@smis/api'

  export interface TaskDetailDrawerOpenData {
    row: SmisRiskInspectionTask
  }
  const activeDetailTab = ref('section-0')
  const drawerRef = ref<ArtDrawerExpose<TaskDetailDrawerOpenData>>()
  const { detail, loading, loadError, openDetail, loadDetail, retryLoad } =
    useDetailRecord<SmisRiskInspectionTaskDetail>(
      async (id) => ({ data: await fetchRiskInspectionTaskDetail(id) }),
      '无法加载巡查任务，请重新加载'
    )
  const abnormalCount = computed(
    () => detail.value?.items.filter((item) => item.result === 'abnormal').length ?? 0
  )
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const eventLabels: Record<SmisRiskInspectionTaskEvent['eventType'], string> = {
    generated: '任务生成',
    transferred: '任务转交',
    progress_saved: '保存进度',
    completed: '任务完成',
    cancelled: '任务取消'
  }
  const eventLabel = (value: SmisRiskInspectionTaskEvent['eventType']): string => eventLabels[value]
  const handleOpen = async (data: TaskDetailDrawerOpenData): Promise<void> => {
    openDetail(data.row.id)
    await drawerRef.value?.handleOpen(data, {
      title: '风险巡查任务详情',
      subtitle: `${data.row.taskNo} · ${data.row.riskPointName}`,
      size: 'xl',
      showFooter: false,
      contentHeight: 'calc(100vh - 120px)',
      onOpen: () => loadDetail(data.row.id)
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .task-detail-drawer {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .task-detail-drawer__status {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 16px;
    background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
    border-left: 3px solid var(--theme-color);
    border-radius: var(--el-border-radius-base);
  }

  .task-detail-drawer__status > span {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    color: var(--theme-color);
    background: var(--default-box-color);
    border-radius: var(--el-border-radius-base);
  }

  .task-detail-drawer__status small,
  .task-detail-drawer__status strong,
  .task-detail-drawer__status p {
    display: block;
    margin: 0;
  }

  .task-detail-drawer__status small,
  .task-detail-drawer__status p {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .task-detail-drawer__status strong {
    margin: 2px 0;
    font-size: 16px;
  }

  .task-detail-drawer__plan-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: -8px 0 0;
    overflow: hidden;
    background: var(--default-box-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .task-detail-drawer__plan-grid > div {
    display: grid;
    grid-template-columns: 126px minmax(0, 1fr);
    min-width: 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .task-detail-drawer__plan-grid > div:nth-child(odd) {
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .task-detail-drawer__plan-grid > div:nth-last-child(-n + 2) {
    border-bottom: 0;
  }

  .task-detail-drawer__plan-grid dt,
  .task-detail-drawer__plan-grid dd {
    min-width: 0;
    padding: 11px 12px;
    margin: 0;
  }

  .task-detail-drawer__plan-grid dt {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
  }

  .task-detail-drawer__plan-grid dd {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .task-detail-drawer__risk {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    font-weight: 600;
  }

  .task-detail-drawer__risk::before {
    width: 8px;
    height: 8px;
    content: '';
    background: var(--risk-color, var(--el-color-warning));
    border-radius: 50%;
  }

  .task-detail-drawer__inspection-list {
    display: grid;
    gap: 8px;
    padding: 0;
    margin: -8px 0 0;
    list-style: none;
  }

  .task-detail-drawer__inspection-list > li {
    display: grid;
    grid-template-columns: 34px minmax(140px, 0.55fr) minmax(240px, 1fr) minmax(140px, 0.5fr);
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    background: var(--el-fill-color-extra-light);
    border: 1px solid var(--el-border-color-lighter);
    border-left: 3px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
  }

  .task-detail-drawer__inspection-list > li[data-result='abnormal'] {
    border-left-color: var(--el-color-danger);
  }

  .task-detail-drawer__inspection-list > li[data-result='normal'] {
    border-left-color: var(--el-color-success);
  }

  .task-detail-drawer__item-index {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    font-size: 11px;
    font-weight: 700;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
    border-radius: var(--el-border-radius-small);
  }

  .task-detail-drawer__item-identity,
  .task-detail-drawer__item-content,
  .task-detail-drawer__item-result {
    min-width: 0;
  }

  .task-detail-drawer__item-identity strong,
  .task-detail-drawer__item-identity small,
  .task-detail-drawer__item-content small,
  .task-detail-drawer__item-content p,
  .task-detail-drawer__item-result small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-detail-drawer__item-identity small,
  .task-detail-drawer__item-content small,
  .task-detail-drawer__item-result small {
    margin-top: 3px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .task-detail-drawer__item-content p {
    margin: 3px 0 0;
    color: var(--el-text-color-regular);
  }

  .task-detail-drawer__item-result {
    display: grid;
    gap: 4px;
    justify-items: start;
  }

  .task-detail-drawer__timeline {
    padding: 4px 12px 0;
  }

  .task-detail-drawer__event {
    padding: 12px 14px;
    background: var(--default-box-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
  }

  .task-detail-drawer__event p {
    margin: 4px 0;
    color: var(--el-text-color-regular);
  }

  .task-detail-drawer__event small {
    color: var(--el-text-color-secondary);
  }

  .task-detail-drawer__notes {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    background: var(--el-fill-color-lighter);
    border-left: 3px solid var(--el-color-warning);
  }

  .task-detail-drawer__notes p {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr);
    margin: 0;
  }

  @media (width <= 900px) {
    .task-detail-drawer__plan-grid {
      grid-template-columns: 1fr;
    }

    .task-detail-drawer__plan-grid > div:nth-child(odd) {
      border-right: 0;
    }

    .task-detail-drawer__plan-grid > div:nth-last-child(2) {
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    .task-detail-drawer__inspection-list > li {
      grid-template-columns: 34px minmax(0, 1fr);
    }

    .task-detail-drawer__item-content,
    .task-detail-drawer__item-result {
      grid-column: 2;
    }
  }
</style>
