<template>
  <ArtDrawer ref="drawerRef">
    <div class="risk-information-detail">
      <div class="risk-information-detail__identity">
        <span aria-hidden="true"><ArtSvgIcon icon="ri:shield-flash-line" /></span>
        <div>
          <small>危险编号</small>
          <strong>{{ current?.hazardNo }}</strong>
          <p>{{ current?.identificationLocation }} · {{ current?.organizationNames }}</p>
        </div>
        <span class="risk-information-detail__level" :style="riskLevelStyle">
          {{ current?.riskLevelName || '待评价' }}
        </span>
      </div>

      <ArtSectionTitle title="风险辨识" subtitle="辨识单元、场所设备与事故后果" />
      <dl class="risk-information-detail__grid">
        <div
          ><dt>辨识单位</dt><dd>{{ current?.organizationNames || '—' }}</dd></div
        >
        <div
          ><dt>场所</dt><dd>{{ current?.siteName || '—' }}</dd></div
        >
        <div
          ><dt>设备设施</dt><dd>{{ current?.equipmentFacility || '—' }}</dd></div
        >
        <div
          ><dt>特种设备</dt><dd>{{ current?.isSpecialEquipment ? '是' : '否' }}</dd></div
        >
        <div
          ><dt>作业活动</dt><dd>{{ current?.activityNames || '—' }}</dd></div
        >
        <div
          ><dt>事故类型</dt><dd>{{ accidentTypeText }}</dd></div
        >
      </dl>
      <div class="risk-information-detail__narrative">
        <strong>危险有害因素</strong><p>{{ current?.hazardFactor || '—' }}</p>
        <strong>可能后果</strong><p>{{ current?.consequence || '未填写可能后果' }}</p>
      </div>

      <ArtSectionTitle title="风险评价" subtitle="评价方法、分值与风险等级" />
      <div class="risk-information-detail__assessment">
        <article
          ><span>评价方法</span><strong>{{ current?.methodCode || '待评价' }}</strong></article
        >
        <article
          ><span>评分明细</span><strong>{{ assessmentDetail }}</strong></article
        >
        <article
          ><span>风险值</span><strong>{{ current?.riskScore ?? '—' }}</strong></article
        >
        <article
          ><span>风险等级</span><strong>{{ current?.riskLevelName || '待评价' }}</strong></article
        >
      </div>

      <ArtSectionTitle
        title="管控措施"
        :subtitle="`共 ${current?.measureCount || 0} 项措施，覆盖 ${current?.linkedPositionCount || 0} 个岗位`"
      />
      <div v-if="current?.measures?.length" class="risk-information-detail__measures">
        <article v-for="measure in current.measures" :key="measure.id">
          <header>
            <span>{{ measure.category }}</span>
            <small>{{ measure.controlLevel }} · {{ measure.frequency }}</small>
          </header>
          <p>{{ measure.content }}</p>
          <dl>
            <div
              ><dt>责任岗位</dt><dd>{{ measure.positions }}</dd></div
            >
            <div
              ><dt>标准依据</dt><dd>{{ measure.standardBasis || '—' }}</dd></div
            >
            <div
              ><dt>失效形式</dt><dd>{{ measure.failureMode || '—' }}</dd></div
            >
          </dl>
        </article>
      </div>
      <ArtEmptyState v-else title="暂无管控措施" description="请先在风险评价与管控中配置措施。" />
    </div>
  </ArtDrawer>
</template>

<script setup lang="ts">
  import type { CSSProperties } from 'vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import type { SmisRiskControlInformationRecord } from '@smis/api'

  export interface RiskControlDetailOpenData {
    row: SmisRiskControlInformationRecord
  }

  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const drawerRef = ref<ArtDrawerExpose<RiskControlDetailOpenData>>()
  const current = shallowRef<SmisRiskControlInformationRecord>()
  const riskLevelStyle = computed<CSSProperties>(() => ({
    '--risk-level-color': current.value?.riskLevelColor || 'var(--el-color-info)'
  }))
  const accidentTypeText = computed(() => {
    const options = getDictMap.value.smisAccidentCategory ?? []
    return current.value?.accidentTypes?.length
      ? current.value.accidentTypes
          .map((value) => options.find((item) => item.value === value)?.label || value)
          .join('、')
      : '—'
  })
  const assessmentDetail = computed(() => {
    if (!current.value?.methodCode) return '—'
    const fields = ['L', 'E', 'C', 'S'] as const
    const values = {
      L: current.value.lValue,
      E: current.value.eValue,
      C: current.value.cValue,
      S: current.value.sValue
    }
    return fields
      .filter((key) => values[key] != null)
      .map((key) => `${key}=${values[key]}`)
      .join(' · ')
  })
  const handleOpen = async (data: RiskControlDetailOpenData): Promise<void> => {
    current.value = data.row
    await drawerRef.value?.handleOpen(data, {
      title: '风险管控详情',
      subtitle: `${data.row.hazardNo} · ${data.row.identificationLocation}`,
      size: 'xl',
      showFooter: false,
      contentHeight: 'calc(100vh - 120px)',
      loading: true,
      loadingText: '正在加载事故类型…',
      onOpen: async (_data, api) => {
        try {
          await userStore.ensureDictLoaded('smisAccidentCategory')
        } finally {
          api.setLoading(false)
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  @use '../../../shared/detail-identity' as detail;

  .risk-information-detail {
    display: grid;
    gap: 18px;

    &__identity {
      @include detail.identity;
    }

    &__level {
      padding: 5px 10px;
      color: var(--risk-level-color);
      background: color-mix(in srgb, var(--risk-level-color) 10%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, var(--risk-level-color) 35%, transparent);
      border-radius: 999px;
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
        grid-template-columns: 112px minmax(0, 1fr);
        border-bottom: 1px solid var(--el-border-color-lighter);
      }

      > div:nth-child(odd) {
        border-right: 1px solid var(--el-border-color-lighter);
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

    &__narrative {
      display: grid;
      gap: 8px;
      padding: 14px 16px;
      background: var(--el-fill-color-extra-light);
      border-left: 3px solid var(--el-border-color);
      border-radius: var(--el-border-radius-base);

      p {
        margin: 0;
        line-height: 1.7;
        white-space: pre-wrap;
      }
    }

    &__assessment {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: -8px;

      article {
        padding: 13px 14px;
        background: var(--el-fill-color-extra-light);
        border-radius: var(--el-border-radius-base);
      }

      span,
      strong {
        display: block;
      }

      span {
        margin-bottom: 5px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__measures {
      display: grid;
      gap: 10px;
      margin-top: -8px;

      article {
        padding: 14px 16px;
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--el-border-radius-base);
      }

      header {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
      }

      header span {
        font-weight: 700;
        color: var(--theme-color);
      }

      header small {
        color: var(--el-text-color-secondary);
      }

      p {
        margin: 8px 0 12px;
        line-height: 1.7;
      }

      dl {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin: 0;
      }

      dl div {
        min-width: 0;
      }

      dt {
        margin-bottom: 3px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    @media (width <= 900px) {
      &__grid,
      &__assessment {
        grid-template-columns: 1fr;
      }

      &__grid > div:nth-child(odd) {
        border-right: 0;
      }

      &__measures dl {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
