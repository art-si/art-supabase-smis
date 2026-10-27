<template>
  <SmisAiPanelFrame
    class="permit-ai-precheck"
    :permission="permission"
    eyebrow="AI 票证预审"
    title="提交前检查关键条件"
    subtitle="基于当前草稿检查缺项与规则冲突；只提供建议，不会提交、审批或改变作业票状态。"
    icon="ri:shield-check-line"
  >
    <template #action>
      <ElButton type="primary" plain :loading="state.loading" @click="handlePrecheck">
        <ArtSvgIcon v-if="!state.loading" icon="ri:scan-2-line" />
        {{ state.result ? '重新预审' : '检查当前草稿' }}
      </ElButton>
    </template>

    <ElAlert
      v-if="state.error"
      class="permit-ai-precheck__error"
      type="error"
      :title="state.error"
      show-icon
      :closable="false"
    />

    <SmisAiCapabilityGuide v-if="!state.result" aria-label="AI 票证预审能力" :items="guideItems" />

    <div v-else class="permit-ai-precheck__result" aria-live="polite">
      <div class="permit-ai-precheck__result-head">
        <div class="permit-ai-precheck__score" :class="`is-${state.result.readiness}`">
          <strong>{{ state.result.score }}</strong>
          <small>预审分</small>
        </div>
        <div class="permit-ai-precheck__summary">
          <div>
            <strong>{{ readinessLabel }}</strong>
            <ElTag :type="readinessType" effect="light" round>{{ readinessTag }}</ElTag>
            <ElTag v-if="state.stale" type="info" effect="plain" round>草稿已变更</ElTag>
          </div>
          <p>{{ state.result.summary }}</p>
        </div>
      </div>

      <dl class="permit-ai-precheck__metrics">
        <div
          ><dt>现场分析</dt><dd>{{ state.result.metrics.completedAnalysis }}</dd></div
        >
        <div
          ><dt>安全措施</dt><dd>{{ state.result.metrics.confirmedMeasures }}</dd></div
        >
        <div
          ><dt>作业人员</dt><dd>{{ state.result.metrics.workerCount }} 人</dd></div
        >
        <div
          ><dt>现场照片</dt><dd>{{ state.result.metrics.photoCount }} 张</dd></div
        >
      </dl>

      <section v-if="state.result.blockers.length" class="permit-ai-precheck__group is-blocking">
        <header><ArtSvgIcon icon="ri:error-warning-line" /><strong>提交前需处理</strong></header>
        <ul>
          <li v-for="item in state.result.blockers" :key="item.code">
            <strong>{{ item.title }}</strong
            ><span>{{ item.description }}</span>
          </li>
        </ul>
      </section>

      <section v-if="state.result.warnings.length" class="permit-ai-precheck__group is-warning">
        <header><ArtSvgIcon icon="ri:alarm-warning-line" /><strong>建议现场确认</strong></header>
        <ul>
          <li v-for="item in state.result.warnings" :key="item.code">
            <strong>{{ item.title }}</strong
            ><span>{{ item.description }}</span>
          </li>
        </ul>
      </section>

      <div class="permit-ai-precheck__bottom-grid">
        <section class="permit-ai-precheck__group is-success">
          <header><ArtSvgIcon icon="ri:checkbox-circle-line" /><strong>已通过检查</strong></header>
          <ul v-if="state.result.passedChecks.length">
            <li v-for="item in state.result.passedChecks" :key="item"
              ><span>{{ item }}</span></li
            >
          </ul>
          <ArtEmptyState
            v-else
            title="暂无已通过项"
            description="请先完善草稿。"
            size="compact"
            :visual-size="56"
          />
        </section>
        <section class="permit-ai-precheck__group is-recommendation">
          <header><ArtSvgIcon icon="ri:lightbulb-flash-line" /><strong>补充建议</strong></header>
          <ul>
            <li v-for="item in state.result.recommendations" :key="item"
              ><span>{{ item }}</span></li
            >
          </ul>
        </section>
      </div>
    </div>
  </SmisAiPanelFrame>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'
  import {
    precheckSpecialOperationPermitByAi,
    type SmisSpecialOperationPrecheckAssessment,
    type SmisSpecialOperationPrecheckDraft
  } from '@smis/api'
  import SmisAiCapabilityGuide from '@smis/views/components/smis-ai-capability-guide.vue'
  import SmisAiPanelFrame from '@smis/views/components/smis-ai-panel-frame.vue'

  defineOptions({ name: 'SmisSpecialOperationAiPrecheckPanel' })

  const props = defineProps<{
    permission: string
    draft: SmisSpecialOperationPrecheckDraft
  }>()

  const guideItems = [
    {
      icon: 'ri:file-list-3-line',
      tone: 'primary',
      title: '完整性检查',
      description: '核对必填、人员与专有字段'
    },
    {
      icon: 'ri:git-merge-line',
      tone: 'warning',
      title: '规则冲突',
      description: '识别时间、检测与作业条件冲突'
    },
    {
      icon: 'ri:shield-check-line',
      tone: 'success',
      title: '控制措施',
      description: '汇总已确认措施与现场证据'
    }
  ] as const

  const state = reactive<{
    loading: boolean
    error: string
    stale: boolean
    result?: SmisSpecialOperationPrecheckAssessment
  }>({ loading: false, error: '', stale: false, result: undefined })

  const readinessLabel = computed(() => {
    if (state.result?.readiness === 'blocked') return '存在提交阻断项'
    if (state.result?.readiness === 'needs_attention') return '可继续，但需现场确认'
    return '未发现明显阻断项'
  })
  const readinessTag = computed(() => {
    if (state.result?.readiness === 'blocked') return '需完善'
    if (state.result?.readiness === 'needs_attention') return '需关注'
    return '可复核'
  })
  const readinessType = computed(() => {
    if (state.result?.readiness === 'blocked') return 'danger'
    if (state.result?.readiness === 'needs_attention') return 'warning'
    return 'success'
  })

  watch(
    () => props.draft,
    () => {
      if (state.result) state.stale = true
    },
    { deep: true }
  )

  async function handlePrecheck(): Promise<void> {
    if (state.loading) return
    state.loading = true
    state.error = ''
    try {
      const response = await precheckSpecialOperationPermitByAi({
        permissionCode: props.permission,
        draft: props.draft
      })
      if (response.error || !response.data) throw response.error || new Error('未返回预审结果')
      state.result = response.data.assessment
      state.stale = false
      ElMessage.success('作业票预审完成，请结合现场实际逐项核对')
    } catch (error) {
      state.error = getFriendlySupabaseErrorMessage(error, '作业票预审失败，请稍后重试')
    } finally {
      state.loading = false
    }
  }

  function reset(): void {
    state.loading = false
    state.error = ''
    state.stale = false
    state.result = undefined
  }

  defineExpose({ reset })
</script>

<style scoped lang="scss">
  .permit-ai-precheck {
    &__error {
      margin-top: var(--art-space-3);
    }

    &__result {
      padding-top: var(--art-space-4);
      margin-top: var(--art-space-4);
      border-top: 1px dashed var(--el-border-color);
    }

    &__result-head,
    &__summary > div,
    &__group header {
      display: flex;
      align-items: center;
    }

    &__result-head {
      gap: var(--art-space-3);
    }

    &__score {
      display: grid;
      flex: 0 0 66px;
      place-items: center;
      width: 66px;
      height: 66px;
      color: var(--el-color-success);
      background: color-mix(in srgb, var(--el-color-success) 9%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, var(--el-color-success) 28%, var(--el-border-color));
      border-radius: var(--art-surface-radius);

      strong {
        align-self: end;
        font-size: 24px;
        line-height: 1;
      }

      small {
        align-self: start;
        margin-top: 4px;
        font-size: 11px;
      }

      &.is-needs_attention {
        color: var(--el-color-warning);
        background: color-mix(in srgb, var(--el-color-warning) 9%, var(--default-box-color));
        border-color: color-mix(in srgb, var(--el-color-warning) 28%, var(--el-border-color));
      }

      &.is-blocked {
        color: var(--el-color-danger);
        background: color-mix(in srgb, var(--el-color-danger) 8%, var(--default-box-color));
        border-color: color-mix(in srgb, var(--el-color-danger) 26%, var(--el-border-color));
      }
    }

    &__summary {
      min-width: 0;

      > div {
        flex-wrap: wrap;
        gap: var(--art-space-2);
      }

      > div > strong {
        font-size: 15px;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 6px 0 0;
        line-height: 1.6;
        color: var(--el-text-color-secondary);
      }
    }

    &__metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--art-space-2);
      margin: var(--art-space-4) 0 0;

      > div {
        padding: var(--art-space-3);
        background: color-mix(in srgb, var(--theme-color) 2%, var(--default-box-color));
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--el-border-radius-base);
      }

      dt {
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 3px 0 0;
        font-size: 16px;
        font-weight: 650;
        color: var(--el-text-color-primary);
      }
    }

    &__group {
      padding: var(--art-space-3);
      margin-top: var(--art-space-3);
      background: color-mix(in srgb, var(--theme-color) 3%, var(--default-box-color));
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      header {
        gap: 6px;
        margin-bottom: var(--art-space-2);
        color: var(--theme-color);
      }

      ul {
        display: grid;
        gap: 8px;
        padding: 0;
        margin: 0;
        list-style: none;
      }

      li {
        display: flex;
        flex-direction: column;
        gap: 2px;
        line-height: 1.55;
      }

      li strong {
        color: var(--el-text-color-primary);
      }

      li span,
      p {
        margin: 0;
        color: var(--el-text-color-secondary);
      }

      &.is-blocking {
        background: color-mix(in srgb, var(--el-color-danger) 5%, var(--default-box-color));
        border-color: color-mix(in srgb, var(--el-color-danger) 20%, var(--el-border-color));

        header {
          color: var(--el-color-danger);
        }
      }

      &.is-warning {
        background: color-mix(in srgb, var(--el-color-warning) 6%, var(--default-box-color));
        border-color: color-mix(in srgb, var(--el-color-warning) 22%, var(--el-border-color));

        header {
          color: var(--el-color-warning);
        }
      }

      &.is-success header {
        color: var(--el-color-success);
      }
    }

    &__bottom-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--art-space-3);
    }

    @media (width <= 860px) {
      &__metrics,
      &__bottom-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }
</style>
