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
    <div v-if="detail" class="hidden-hazard-task-detail">
      <div class="hidden-hazard-task-detail__identity">
        <span
          aria-hidden="true"
          class="grid size-[46px] place-items-center [color:var(--theme-color)] [background:var(--default-box-color)] [border-radius:var(--el-border-radius-base)]"
          ><ArtSvgIcon icon="ri:clipboard-line"
        /></span>
        <div
          ><small>任务编号</small><strong>{{ detail.taskNo }}</strong
          ><p>{{ detail.inspectionObject }} · {{ detail.sourcePlanName }}</p></div
        >
        <ArtDictDisplay
          dict-code="smisHiddenHazardTaskStatus"
          :value="detail.status"
          display="tag"
        />
      </div>
      <ElTabs v-model="activeDetailTab"
        ><ElTabPane name="section-0" label="任务信息"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle title="任务信息" subtitle="来源计划、排查对象与执行时限" />
            <dl class="hidden-hazard-task-detail__grid">
              <div
                ><dt>源计划编号</dt><dd>{{ detail.sourcePlanNo }}</dd></div
              >
              <div
                ><dt>排查类型</dt><dd>{{ detail.inspectionTypeName }}</dd></div
              >
              <div
                ><dt>检查单位</dt><dd>{{ detail.inspectionOrganizationName }}</dd></div
              >
              <div
                ><dt>被检查单位</dt><dd>{{ detail.inspectedOrganizationName }}</dd></div
              >
              <div
                ><dt>执行人</dt
                ><dd>{{ detail.executorEmployeeName }} · {{ detail.executorEmployeeNo }}</dd></div
              >
              <div
                ><dt>计划开始</dt><dd>{{ formatDate(detail.plannedStartAt) }}</dd></div
              >
              <div
                ><dt>计划结束</dt><dd>{{ formatDate(detail.plannedEndAt) }}</dd></div
              >
              <div
                ><dt>完成时间</dt><dd>{{ formatDate(detail.completedAt) }}</dd></div
              >
            </dl>
          </div></ElTabPane
        >
        <ElTabPane name="section-1" label="排查结果"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle
              title="排查内容"
              :subtitle="`共 ${detail.items.length} 项，异常 ${abnormalCount} 项`"
            />
            <ul class="hidden-hazard-task-detail__items">
              <li v-for="(item, index) in detail.items" :key="item.id" :data-result="item.result">
                <span>{{ index + 1 }}</span>
                <div
                  ><strong>{{ item.standardName }}</strong
                  ><small>{{ item.itemCode }}</small></div
                >
                <div
                  ><p>{{ item.inspectionContent }}</p
                  ><small>{{ item.remark || '暂无执行说明' }}</small></div
                >
                <div
                  ><ArtDictDisplay
                    dict-code="smisHiddenHazardInspectionResult"
                    :value="item.result"
                    display="tag"
                  /><small>{{ item.hiddenHazardNo || '未生成隐患编号' }}</small></div
                >
              </li>
            </ul>
          </div></ElTabPane
        >
        <ElTabPane name="section-2" label="流转记录"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle
              title="操作记录"
              subtitle="任务生成、转交、进度保存、完成与取消事件"
            />
            <ElTimeline class="hidden-hazard-task-detail__timeline">
              <ElTimelineItem
                v-for="event in [...detail.events].reverse()"
                :key="event.id"
                :timestamp="formatDate(event.eventAt)"
                placement="top"
              >
                <div class="hidden-hazard-task-detail__event"
                  ><strong>{{ eventLabels[event.eventType] }}</strong
                  ><p>{{ event.eventContent || '系统记录' }}</p
                  ><small>{{ event.operatorName || '系统' }}</small></div
                >
              </ElTimelineItem>
            </ElTimeline>
            <div
              v-if="detail.executionSummary || detail.transferReason || detail.cancellationReason"
              class="hidden-hazard-task-detail__notes"
            >
              <p v-if="detail.executionSummary"
                ><strong>执行总结</strong><span>{{ detail.executionSummary }}</span></p
              >
              <p v-if="detail.transferReason"
                ><strong>转交原因</strong><span>{{ detail.transferReason }}</span></p
              >
              <p v-if="detail.cancellationReason"
                ><strong>取消原因</strong><span>{{ detail.cancellationReason }}</span></p
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
  import {
    fetchHiddenHazardInspectionTaskDetail,
    type SmisHiddenHazardInspectionTask,
    type SmisHiddenHazardInspectionTaskDetail,
    type SmisHiddenHazardTaskEvent
  } from '@smis/api'

  export interface HiddenHazardTaskDetailOpenData {
    row: SmisHiddenHazardInspectionTask
  }
  const activeDetailTab = ref('section-0')
  const drawerRef = ref<ArtDrawerExpose<HiddenHazardTaskDetailOpenData>>()
  const detail = shallowRef<SmisHiddenHazardInspectionTaskDetail | null>(null)
  const loading = ref(false)
  const abnormalCount = computed(
    () => detail.value?.items.filter((item) => item.result === 'abnormal').length ?? 0
  )
  const eventLabels: Record<SmisHiddenHazardTaskEvent['eventType'], string> = {
    generated: '任务生成',
    transferred: '任务转交',
    progress_saved: '保存进度',
    completed: '任务完成',
    cancelled: '任务取消'
  }
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const handleOpen = async (data: HiddenHazardTaskDetailOpenData): Promise<void> => {
    detail.value = null
    await drawerRef.value?.handleOpen(data, {
      title: '隐患排查任务详情',
      subtitle: `${data.row.taskNo} · ${data.row.inspectionObject}`,
      size: 'xl',
      showFooter: false,
      contentHeight: 'calc(100vh - 120px)',
      onOpen: async () => {
        loading.value = true
        try {
          detail.value = await fetchHiddenHazardInspectionTaskDetail(data.row.id)
        } finally {
          loading.value = false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .hidden-hazard-task-detail {
    display: grid;
    gap: 18px;
    min-width: 0;

    &__identity {
      display: grid;
      grid-template-columns: 46px minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 16px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-left: 3px solid var(--theme-color);
      border-radius: var(--el-border-radius-base);
    }

    &__identity small,
    &__identity strong,
    &__identity p {
      display: block;
      margin: 0;
    }

    &__identity strong {
      margin: 2px 0;
    }

    &__identity small,
    &__identity p {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: -8px 0 0;
      overflow: hidden;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__grid > div {
      display: grid;
      grid-template-columns: 120px minmax(0, 1fr);
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__grid > div:nth-child(odd) {
      border-right: 1px solid var(--el-border-color-lighter);
    }

    &__grid > div:nth-last-child(-n + 2) {
      border-bottom: 0;
    }

    &__grid dt,
    &__grid dd {
      min-width: 0;
      padding: 11px 12px;
      margin: 0;
    }

    &__grid dt {
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color-light);
    }

    &__grid dd {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__items {
      display: grid;
      gap: 8px;
      padding: 0;
      margin: -8px 0 0;
      list-style: none;
    }

    &__items li {
      display: grid;
      grid-template-columns: 32px minmax(140px, 0.5fr) minmax(240px, 1fr) minmax(140px, 0.45fr);
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      background: var(--el-fill-color-extra-light);
      border-left: 3px solid var(--el-border-color);
      border-radius: var(--el-border-radius-base);
    }

    &__items li[data-result='normal'] {
      border-left-color: var(--el-color-success);
    }

    &__items li[data-result='abnormal'] {
      border-left-color: var(--el-color-danger);
    }

    &__items li > span {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-small);
    }

    &__items strong,
    &__items small,
    &__items p {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__items p {
      margin: 0;
    }

    &__items small {
      margin-top: 3px;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__timeline {
      padding: 4px 12px 0;
    }

    &__event {
      padding: 12px 14px;
      background: var(--default-box-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
    }

    &__event p {
      margin: 4px 0;
    }

    &__event small {
      color: var(--el-text-color-secondary);
    }

    &__notes {
      display: grid;
      gap: 8px;
      padding: 14px 16px;
      background: var(--el-fill-color-lighter);
      border-left: 3px solid var(--el-color-warning);
    }

    &__notes p {
      display: grid;
      grid-template-columns: 100px minmax(0, 1fr);
      margin: 0;
    }

    @media (width <= 900px) {
      &__grid {
        grid-template-columns: 1fr;
      }

      &__grid > div:nth-child(odd) {
        border-right: 0;
      }

      &__grid > div:nth-last-child(2) {
        border-bottom: 1px solid var(--el-border-color-lighter);
      }

      &__items li {
        grid-template-columns: 32px minmax(0, 1fr);
      }

      &__items li > div:not(:first-of-type) {
        grid-column: 2;
      }
    }
  }
</style>
