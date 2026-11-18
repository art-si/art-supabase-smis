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
        <span
          aria-hidden="true"
          class="grid size-[46px] place-items-center [color:var(--theme-color)] [background:var(--default-box-color)] [border-radius:var(--el-border-radius-base)]"
          ><ArtSvgIcon icon="ri:calendar-check-line"
        /></span>
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

      <ElTabs class="art-card-xs art-overlay-tab-card" v-model="activeDetailTab"
        ><ElTabPane name="section-0" label="计划与说明"
          ><div class="space-y-4 min-w-0"
            ><ArtSectionTitle title="计划信息" subtitle="排查对象、执行安排与周期配置" />
            <ArtDescriptions
              :data="detail"
              :items="planItems"
              :columns="2"
              :label-width="120"
              empty-text=""
            />

            <ArtSectionTitle title="计划说明与附件" subtitle="计划范围、执行要求和支持材料" />
            <div class="hidden-hazard-plan-detail__notes">
              <p>{{ detail.inspectionDescription || '暂无排查说明' }}</p>
              <small>附件 {{ detail.attachmentUrls.length }} 个</small>
            </div>
            <ArtUploadFile
              v-if="detail.attachmentUrls.length"
              :model-value="detail.attachmentUrls"
              readonly
              multiple
            /> </div
        ></ElTabPane>
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
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import { toNameCodeOption } from '@/utils/form/option'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
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
  const formatDate = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '—',
    invalidText: '—'
  })
  const planItems: ArtDescriptionItem<SmisHiddenHazardInspectionPlanDetail>[] = [
    { key: 'inspectionTypeName', label: '排查类型', field: 'inspectionTypeName' },
    {
      key: 'executor',
      label: '执行人',
      value: (data) =>
        toNameCodeOption({
          id: data.executorEmployeeId,
          name: data.executorEmployeeName,
          code: data.executorEmployeeNo
        }).label
    },
    { key: 'inspectionOrganizationName', label: '检查单位', field: 'inspectionOrganizationName' },
    { key: 'inspectedOrganizationName', label: '被检查单位', field: 'inspectedOrganizationName' },
    { key: 'plannedStartAt', label: '计划开始', value: (data) => formatDate(data.plannedStartAt) },
    { key: 'plannedEndAt', label: '计划结束', value: (data) => formatDate(data.plannedEndAt) },
    {
      key: 'deadline',
      label: '任务时限',
      value: (data) => `${data.taskDeadlineValue} ${unitLabels[data.taskDeadlineUnit]}`
    },
    {
      key: 'cycle',
      label: '循环周期',
      value: (data) =>
        data.cycleType === 'once'
          ? '不循环'
          : `每 ${data.cycleInterval} ${cycleLabels[data.cycleType]}`
    },
    { key: 'createBy', label: '创建人', value: (data) => data.createBy || '系统' },
    { key: 'createTime', label: '创建时间', value: (data) => formatDate(data.createTime) }
  ]
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

      li > div {
        min-width: 0;
      }

      strong,
      small {
        display: block;
        overflow-wrap: anywhere;
        white-space: normal;
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
      &__items li {
        grid-template-columns: 32px minmax(0, 1fr);
      }

      &__items li > div:last-child {
        grid-column: 2;
      }
    }
  }
</style>
