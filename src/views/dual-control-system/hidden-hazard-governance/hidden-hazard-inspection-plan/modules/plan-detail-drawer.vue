<template>
  <ArtDrawer
    @open="
      () => {
        activeDetailTab = 'section-0'
      }
    "
    ref="drawerRef"
    :loading="loading"
    loading-text="正在加载计划详情…"
  >
    <div v-if="detail" class="hidden-hazard-plan-detail">
      <div class="hidden-hazard-plan-detail__identity">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:calendar-check-line" /></span>
        <div
          ><small>计划编号</small><strong>{{ detail.planNo }}</strong
          ><p>{{ detail.planName }}</p></div
        >
        <ArtDictDisplay
          dict-code="commonEnabledDisabledVoidedStatus"
          :value="detail.status"
          display="tag"
        />
      </div>

      <ElTabs v-model="activeDetailTab"
        ><ElTabPane name="section-0" label="计划与说明"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle title="计划信息" subtitle="排查对象、执行安排与周期配置" />
            <dl class="hidden-hazard-plan-detail__grid">
              <div
                ><dt>排查类型</dt><dd>{{ detail.inspectionTypeName }}</dd></div
              >
              <div
                ><dt>执行人</dt
                ><dd>{{ detail.executorEmployeeName }} · {{ detail.executorEmployeeNo }}</dd></div
              >
              <div
                ><dt>检查单位</dt><dd>{{ detail.inspectionOrganizationName }}</dd></div
              >
              <div
                ><dt>被检查单位</dt><dd>{{ detail.inspectedOrganizationName }}</dd></div
              >
              <div
                ><dt>计划开始</dt><dd>{{ formatDate(detail.plannedStartAt) }}</dd></div
              >
              <div
                ><dt>计划结束</dt><dd>{{ formatDate(detail.plannedEndAt) }}</dd></div
              >
              <div
                ><dt>任务时限</dt><dd>{{ deadlineText }}</dd></div
              >
              <div
                ><dt>循环周期</dt><dd>{{ cycleText }}</dd></div
              >
              <div
                ><dt>创建人</dt><dd>{{ detail.createBy || '系统' }}</dd></div
              >
              <div
                ><dt>创建时间</dt><dd>{{ formatDate(detail.createTime) }}</dd></div
              >
            </dl>

            <ArtSectionTitle title="计划说明与附件" subtitle="计划范围、执行要求和支持材料" />
            <div class="hidden-hazard-plan-detail__notes">
              <p>{{ detail.inspectionDescription || '暂无排查说明' }}</p>
              <small>附件 {{ detail.attachmentUrls.length }} 个</small>
            </div></div
          ></ElTabPane
        >
        <ElTabPane name="section-1" label="排查明细"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle
              title="排查明细"
              :subtitle="`共 ${detail.items.length} 条，任务生成时保留内容快照`"
            />
            <ol class="hidden-hazard-plan-detail__items">
              <li v-for="item in detail.items" :key="item.id">
                <span>{{ item.sort }}</span>
                <div
                  ><strong>{{ item.standardName }}</strong
                  ><small>{{ item.standardCode }}</small></div
                >
                <div
                  ><strong>{{ item.inspectionContent }}</strong
                  ><small>{{ item.itemCode }}</small></div
                >
              </li>
            </ol>
          </div></ElTabPane
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
    fetchHiddenHazardInspectionPlanDetail,
    type SmisHiddenHazardInspectionPlan,
    type SmisHiddenHazardInspectionPlanDetail
  } from '@smis/api'

  export interface HiddenHazardPlanDetailOpenData {
    row: SmisHiddenHazardInspectionPlan
  }
  const activeDetailTab = ref('section-0')
  const drawerRef = ref<ArtDrawerExpose<HiddenHazardPlanDetailOpenData>>()
  const detail = shallowRef<SmisHiddenHazardInspectionPlanDetail | null>(null)
  const loading = ref(false)
  const unitLabels = { minute: '分钟', hour: '小时', day: '天' } as const
  const cycleLabels = { once: '不循环', day: '天', week: '周', month: '月' } as const
  const deadlineText = computed(() =>
    detail.value
      ? `${detail.value.taskDeadlineValue} ${unitLabels[detail.value.taskDeadlineUnit]}`
      : '—'
  )
  const cycleText = computed(() => {
    if (!detail.value) return '—'
    return detail.value.cycleType === 'once'
      ? '不循环'
      : `每 ${detail.value.cycleInterval} ${cycleLabels[detail.value.cycleType]}`
  })
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const handleOpen = async (data: HiddenHazardPlanDetailOpenData): Promise<void> => {
    detail.value = null
    await drawerRef.value?.handleOpen(data, {
      title: '隐患排查计划详情',
      subtitle: `${data.row.planNo} · ${data.row.planName}`,
      size: 'xl',
      showFooter: false,
      contentHeight: 'calc(100vh - 120px)',
      onOpen: async () => {
        loading.value = true
        try {
          detail.value = await fetchHiddenHazardInspectionPlanDetail(data.row.id)
        } finally {
          loading.value = false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .hidden-hazard-plan-detail {
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

      > span {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        color: var(--theme-color);
        background: var(--default-box-color);
        border-radius: var(--el-border-radius-base);
      }

      small,
      strong,
      p {
        display: block;
        margin: 0;
      }

      strong {
        margin: 2px 0;
      }

      small,
      p {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: -8px 0 0;
      overflow: hidden;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      > div {
        display: grid;
        grid-template-columns: 120px minmax(0, 1fr);
        border-bottom: 1px solid var(--el-border-color-lighter);
      }

      > div:nth-child(odd) {
        border-right: 1px solid var(--el-border-color-lighter);
      }

      > div:nth-last-child(-n + 2) {
        border-bottom: 0;
      }

      dt,
      dd {
        min-width: 0;
        padding: 11px 12px;
        margin: 0;
      }

      dt {
        font-size: 12px;
        font-weight: 600;
        color: var(--el-text-color-secondary);
        background: var(--el-fill-color-light);
      }

      dd {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__items {
      display: grid;
      gap: 8px;
      padding: 0;
      margin: -8px 0 0;
      list-style: none;

      li {
        display: grid;
        grid-template-columns: 32px minmax(150px, 0.55fr) minmax(260px, 1fr);
        gap: 12px;
        align-items: center;
        padding: 12px 14px;
        background: var(--el-fill-color-extra-light);
        border-left: 3px solid var(--theme-color);
        border-radius: var(--el-border-radius-base);
      }

      li > span {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        color: var(--theme-color);
        background: var(--default-box-color);
        border-radius: var(--el-border-radius-small);
      }

      strong,
      small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 3px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__notes {
      padding: 14px 16px;
      background: var(--el-fill-color-lighter);
      border-left: 3px solid var(--el-color-warning);
    }

    &__notes p {
      margin: 0 0 8px;
      line-height: 1.65;
    }

    &__notes small {
      color: var(--el-text-color-secondary);
    }

    @media (width <= 800px) {
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

      &__items li > div:last-child {
        grid-column: 2;
      }
    }
  }
</style>
