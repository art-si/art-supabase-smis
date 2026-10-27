<template>
  <SmisAiPanelFrame
    class="hazard-ai-trend"
    permission="SmisDualControlHiddenHazardGovernanceTracking:AiForecast"
    eyebrow="AI 风险趋势"
    title="隐患风险早期提示"
    subtitle="基于近两期隐患增量、未闭环与逾期情况形成可解释趋势；不会自动派单或改变状态。"
    icon="ri:radar-line"
  >
    <template #action>
      <div class="hazard-ai-trend__actions">
        <ElSelect v-model="state.lookbackDays" aria-label="趋势回看周期" :disabled="state.loading">
          <ElOption
            v-for="option in lookbackOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </ElSelect>
        <ElButton type="primary" plain :loading="state.loading" @click="handleForecast">
          <ArtSvgIcon v-if="!state.loading" icon="ri:line-chart-line" />
          {{ state.result ? '重新分析' : '分析风险趋势' }}
        </ElButton>
      </div>
    </template>

    <ElAlert
      v-if="state.error"
      class="hazard-ai-trend__error"
      type="error"
      :title="state.error"
      show-icon
      :closable="false"
    />

    <SmisAiCapabilityGuide v-if="!state.result" aria-label="AI 风险趋势能力" :items="guideItems" />

    <div v-else class="hazard-ai-trend__result" aria-live="polite">
      <div class="hazard-ai-trend__summary">
        <div class="hazard-ai-trend__score" :class="`is-${state.result.riskLevel}`">
          <strong>{{ state.result.score }}</strong
          ><small>风险分</small>
        </div>
        <div class="hazard-ai-trend__conclusion">
          <div>
            <strong>{{ riskLabel }}</strong>
            <ElTag :type="riskTagType" effect="light" round>{{ riskTag }}</ElTag>
            <ElTag type="info" effect="plain" round>{{ confidenceLabel }}</ElTag>
          </div>
          <p>
            本期 {{ state.result.currentPeriodCount }} 项、上期
            {{ state.result.previousPeriodCount }} 项；未来 30 天基线约
            {{ state.result.forecast30DayCount }} 项。
          </p>
        </div>
      </div>

      <div class="hazard-ai-trend__meta-row">
        <ElButton link type="primary" @click="state.expanded = !state.expanded">
          <ArtSvgIcon :icon="state.expanded ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" />
          {{ state.expanded ? '收起分析依据' : '查看 4 项依据与建议' }}
        </ElButton>
        <span>
          数据截至 {{ formatTime(state.dataThrough) }} · 确定性加权趋势 v1 · 仅供排查优先级参考
        </span>
      </div>

      <ElCollapseTransition>
        <div v-show="state.expanded" class="hazard-ai-trend__details">
          <div class="hazard-ai-trend__drivers">
            <article
              v-for="driver in state.result.drivers"
              :key="driver.code"
              :class="`is-${driver.tone}`"
            >
              <span>{{ driver.label }}</span>
              <strong>{{ driver.value }}</strong>
              <small>{{ driver.description }}</small>
            </article>
          </div>

          <div class="hazard-ai-trend__recommendations">
            <strong><ArtSvgIcon icon="ri:lightbulb-flash-line" /> 建议关注</strong>
            <ul>
              <li v-for="item in state.result.recommendations" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </ElCollapseTransition>
    </div>
  </SmisAiPanelFrame>
</template>

<script setup lang="ts">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { ElMessage } from 'element-plus'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import {
    forecastSmisHazardRisk,
    type SmisAiRiskForecastAssessment,
    type SmisAiRiskLevel
  } from '@smis/api'
  import SmisAiCapabilityGuide from '@smis/views/components/smis-ai-capability-guide.vue'
  import SmisAiPanelFrame from '@smis/views/components/smis-ai-panel-frame.vue'

  const lookbackOptions = useDictionaryOptions('smisHazardTrendLookbackDays', Number)

  defineOptions({ name: 'SmisHazardAiTrendPanel' })

  const guideItems = [
    {
      icon: 'ri:git-commit-line',
      tone: 'primary',
      title: '趋势对比',
      description: '对比近两期隐患增量'
    },
    {
      icon: 'ri:timer-flash-line',
      tone: 'warning',
      title: '闭环压力',
      description: '识别未闭环与逾期占比'
    },
    {
      icon: 'ri:focus-3-line',
      tone: 'success',
      title: '可解释基线',
      description: '展示依据、置信度与建议'
    }
  ] as const

  const state = reactive<{
    loading: boolean
    error: string
    expanded: boolean
    lookbackDays: number
    dataThrough: string
    result?: SmisAiRiskForecastAssessment
  }>({
    loading: false,
    error: '',
    expanded: false,
    lookbackDays: 30,
    dataThrough: '',
    result: undefined
  })

  const riskText: Record<SmisAiRiskLevel, { label: string; tag: string }> = {
    low: { label: '当前趋势总体平稳', tag: '低' },
    medium: { label: '存在需要关注的压力', tag: '中' },
    high: { label: '风险趋势偏高', tag: '高' },
    critical: { label: '风险趋势显著升高', tag: '很高' }
  }
  const riskLabel = computed(() => riskText[state.result?.riskLevel || 'low'].label)
  const riskTag = computed(() => riskText[state.result?.riskLevel || 'low'].tag)
  const riskTagType = computed(() => {
    if (state.result?.riskLevel === 'critical' || state.result?.riskLevel === 'high')
      return 'danger'
    if (state.result?.riskLevel === 'medium') return 'warning'
    return 'success'
  })
  const confidenceLabel = computed(() => {
    const labels = { low: '低置信度', medium: '中置信度', high: '高置信度' }
    return labels[state.result?.confidence || 'low']
  })

  function formatTime(value: string): string {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
  }

  async function handleForecast(): Promise<void> {
    if (state.loading) return
    state.loading = true
    state.error = ''
    try {
      const response = await forecastSmisHazardRisk(state.lookbackDays)
      if (response.error || !response.data) throw response.error || new Error('未返回风险趋势结果')
      state.result = response.data.assessment
      state.dataThrough = response.data.dataThrough
      state.expanded = false
      ElMessage.success('隐患风险趋势分析完成')
    } catch (error) {
      state.error = getFriendlySupabaseErrorMessage(error, '隐患风险趋势分析失败，请稍后重试')
    } finally {
      state.loading = false
    }
  }
</script>

<style scoped lang="scss">
  .hazard-ai-trend {
    flex: 0 0 auto;

    &__actions,
    &__summary,
    &__conclusion > div,
    &__recommendations > strong {
      display: flex;
      align-items: center;
    }

    &__actions {
      gap: var(--art-space-2);
    }

    &__actions :deep(.el-select) {
      width: 112px;
    }

    &__error,
    &__result {
      margin-top: var(--art-space-3);
    }

    &__result {
      padding-top: var(--art-space-3);
      border-top: 1px dashed var(--el-border-color);
    }

    &__summary {
      gap: var(--art-space-3);
    }

    &__score {
      display: grid;
      flex: 0 0 62px;
      place-items: center;
      width: 62px;
      height: 62px;
      color: var(--el-color-success);
      background: color-mix(in srgb, var(--el-color-success) 8%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, var(--el-color-success) 25%, var(--el-border-color));
      border-radius: var(--art-surface-radius);

      strong {
        align-self: end;
        font-size: 23px;
        line-height: 1;
      }

      small {
        align-self: start;
        margin-top: 4px;
        font-size: 11px;
      }

      &.is-medium {
        color: var(--el-color-warning);
        background: color-mix(in srgb, var(--el-color-warning) 8%, var(--default-box-color));
      }

      &.is-high,
      &.is-critical {
        color: var(--el-color-danger);
        background: color-mix(in srgb, var(--el-color-danger) 7%, var(--default-box-color));
      }
    }

    &__conclusion {
      min-width: 0;
    }

    &__conclusion > div {
      flex-wrap: wrap;
      gap: var(--art-space-2);
    }

    &__conclusion > div > strong {
      font-size: 15px;
      color: var(--el-text-color-primary);
    }

    &__conclusion p {
      margin: 5px 0 0;
      line-height: 1.55;
      color: var(--el-text-color-secondary);
    }

    &__meta-row {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;
      justify-content: space-between;
      margin-top: var(--art-space-2);
    }

    &__meta-row > span {
      font-size: var(--art-font-size-caption);
      color: var(--el-text-color-secondary);
      text-align: right;
    }

    &__drivers {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--art-space-2);
      margin-top: var(--art-space-2);
    }

    &__drivers article {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      padding: var(--art-space-3);
      background: color-mix(in srgb, var(--theme-color) 3%, var(--default-box-color));
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);
      box-shadow: inset 3px 0 0 var(--theme-color);
    }

    &__drivers article.is-warning {
      box-shadow: inset 3px 0 0 var(--el-color-warning);
    }

    &__drivers article.is-danger {
      box-shadow: inset 3px 0 0 var(--el-color-danger);
    }

    &__drivers article.is-success {
      box-shadow: inset 3px 0 0 var(--el-color-success);
    }

    &__drivers span,
    &__drivers small {
      color: var(--el-text-color-secondary);
    }

    &__drivers strong {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 18px;
      color: var(--el-text-color-primary);
      white-space: nowrap;
    }

    &__drivers small {
      line-height: 1.45;
    }

    &__recommendations {
      padding: var(--art-space-3);
      margin-top: var(--art-space-3);
      background: color-mix(in srgb, var(--theme-color) 3%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--el-border-color));
      border-radius: var(--el-border-radius-base);
    }

    &__recommendations > strong {
      gap: 6px;
      color: var(--theme-color);
    }

    &__recommendations ul {
      display: grid;
      gap: 5px;
      padding-left: 18px;
      margin: 8px 0 0;
      line-height: 1.5;
      color: var(--el-text-color-regular);
    }

    @media (width <= 1080px) {
      &__drivers {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (width <= 700px) {
      &__actions,
      &__summary,
      &__meta-row {
        align-items: stretch;
      }

      &__actions,
      &__summary,
      &__meta-row {
        flex-direction: column;
      }

      &__actions :deep(.el-select),
      &__actions :deep(.el-button) {
        width: 100%;
      }

      &__drivers {
        grid-template-columns: minmax(0, 1fr);
      }

      &__meta-row > span {
        text-align: left;
      }
    }
  }
</style>
