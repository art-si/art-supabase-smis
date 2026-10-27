<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="evaluation-dialog">
      <div class="evaluation-dialog__subject"
        ><span><ArtSvgIcon icon="ri:alert-line" /></span
        ><div
          ><small
            >{{ item.riskPointRecord?.pointName || item.riskPoint || '风险点' }} ·
            {{ item.itemNo }}</small
          ><strong>{{ item.hazardFactor || '危险有害因素' }}</strong></div
        ></div
      >
      <div class="evaluation-dialog__method"
        ><button
          v-for="modelOption in models"
          :key="modelOption.id"
          type="button"
          :class="{ 'is-active': model.methodCode === modelOption.methodCode }"
          @click="selectMethod(modelOption.methodCode)"
          ><strong>{{ modelOption.methodCode }}</strong
          ><span>{{ modelOption.modelName }}</span></button
        ></div
      >
      <div v-if="activeModel" class="evaluation-dialog__factors">
        <label v-for="dimension in activeModel.dimensions" :key="dimension.id"
          ><span
            ><strong>{{ dimension.dimensionCode }}</strong
            >{{ dimension.dimensionName }}</span
          ><ElSelect
            v-model="factorValues[dimension.dimensionCode]"
            filterable
            placeholder="请选择判定标准"
            ><ElOption
              v-for="criterion in dimension.criteria"
              :key="criterion.id"
              :label="`${criterion.score} · ${criterion.criterionText}`"
              :value="criterion.score"
              ><span class="evaluation-dialog__option"
                ><strong>{{ criterion.score }}</strong
                ><span>{{ criterion.criterionText }}</span></span
              ></ElOption
            ></ElSelect
          ></label
        >
      </div>
      <div class="evaluation-dialog__result"
        ><div
          ><small>{{ model.methodCode === 'LEC' ? 'D 值' : 'R 值' }}</small
          ><strong>{{ calculatedScore }}</strong
          ><span>{{ formula }}</span></div
        ><div :style="{ '--risk-color': matchedLevel?.color || 'var(--el-text-color-placeholder)' }"
          ><small>自动匹配风险等级</small
          ><strong>{{ matchedLevel?.levelName || '待完成选择' }}</strong
          ><span>{{ matchedLevel?.levelCode || '—' }}</span></div
        ></div
      >
    </div>
  </ArtDialog>
</template>
<script setup lang="ts">
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import {
    fetchRiskAssessmentModels,
    saveRiskEvaluation,
    type SmisRiskAssessmentMethod,
    type SmisRiskAssessmentModel,
    type SmisRiskDimensionCode,
    type SmisRiskItem
  } from '@smis/api'
  export interface EvaluationDialogOpenData {
    item: SmisRiskItem
    tenantId?: string | null
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<EvaluationDialogOpenData>>()
  const models = ref<SmisRiskAssessmentModel[]>([])
  const item = reactive<Partial<SmisRiskItem>>({})
  const model = reactive<{ methodCode: SmisRiskAssessmentMethod }>({ methodCode: 'LEC' })
  const factorValues = reactive<Partial<Record<SmisRiskDimensionCode, number>>>({})
  const activeModel = computed(() => models.value.find((i) => i.methodCode === model.methodCode))
  const requiredCodes = computed<SmisRiskDimensionCode[]>(() =>
    model.methodCode === 'LEC' ? ['L', 'E', 'C'] : ['L', 'S']
  )
  const completed = computed(() =>
    requiredCodes.value.every((code) => typeof factorValues[code] === 'number')
  )
  const calculatedScore = computed(() => {
    if (!completed.value) return '—'
    return model.methodCode === 'LEC'
      ? (factorValues.L || 0) * (factorValues.E || 0) * (factorValues.C || 0)
      : (factorValues.L || 0) * (factorValues.S || 0)
  })
  const formula = computed(() =>
    model.methodCode === 'LEC'
      ? `${factorValues.L ?? 'L'} × ${factorValues.E ?? 'E'} × ${factorValues.C ?? 'C'}`
      : `${factorValues.L ?? 'L'} × ${factorValues.S ?? 'S'}`
  )
  const matchedLevel = computed(() => {
    const score = calculatedScore.value
    if (typeof score !== 'number') return undefined
    return [...(activeModel.value?.levels || [])]
      .sort((a, b) => b.minScore - a.minScore)
      .find(
        (level) => score >= level.minScore && (level.maxScore == null || score < level.maxScore)
      )
  })
  const selectMethod = (method: SmisRiskAssessmentMethod) => {
    model.methodCode = method
    Object.keys(factorValues).forEach((key) => delete factorValues[key as SmisRiskDimensionCode])
  }
  const submit = async () => {
    if (!item.id || !completed.value || !matchedLevel.value) return false
    try {
      await saveRiskEvaluation({
        riskItemId: item.id,
        methodCode: model.methodCode,
        lValue: factorValues.L!,
        eValue: model.methodCode === 'LEC' ? factorValues.E : null,
        cValue: model.methodCode === 'LEC' ? factorValues.C : null,
        sValue: model.methodCode === 'LS' ? factorValues.S : null
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '风险评价保存失败，请检查内容后重试')
      return false
    }
  }
  const handleOpen = async (data: EvaluationDialogOpenData) => {
    Object.assign(item, data.item)
    models.value = []
    model.methodCode = data.item.evaluation?.methodCode || 'LEC'
    Object.keys(factorValues).forEach((key) => delete factorValues[key as SmisRiskDimensionCode])
    if (data.item.evaluation)
      Object.assign(factorValues, {
        L: data.item.evaluation.lValue,
        E: data.item.evaluation.eValue ?? undefined,
        C: data.item.evaluation.cValue ?? undefined,
        S: data.item.evaluation.sValue ?? undefined
      })
    await dialogRef.value?.handleOpen(data, {
      title: data.item.evaluation ? '重新评价危险有害因素' : '定量风险评价',
      subtitle: '选择各维度判定标准，系统自动计算分值并匹配风险等级',
      confirmText: '提交定量评价',
      loading: true,
      loadingText: '正在加载评价模型…',
      onOpen: async (_openData, api) => {
        try {
          const result = await fetchRiskAssessmentModels(data.tenantId)
          models.value = result.data ?? []
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: submit
    })
  }
  defineExpose({ handleOpen })
</script>
<style scoped lang="scss">
  .evaluation-dialog__subject {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    background: color-mix(in srgb, var(--el-color-warning) 8%, var(--default-box-color));
    border-left: 3px solid var(--el-color-warning);
    border-radius: var(--el-border-radius-base);
  }

  .evaluation-dialog__subject > span {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    color: var(--el-color-warning);
    background: var(--default-box-color);
    border-radius: var(--art-surface-radius);
  }

  .evaluation-dialog__subject div {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .evaluation-dialog__subject small {
    color: var(--el-text-color-secondary);
  }

  .evaluation-dialog__subject strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .evaluation-dialog__method {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 16px 0;
  }

  .evaluation-dialog__method button {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 11px 13px;
    text-align: left;
    cursor: pointer;
    background: var(--default-box-color);
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
  }

  .evaluation-dialog__method button strong {
    display: grid;
    place-items: center;
    width: 42px;
    height: 34px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
    border-radius: var(--art-surface-radius);
  }

  .evaluation-dialog__method button.is-active {
    border-color: var(--theme-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-color) 10%, transparent);
  }

  .evaluation-dialog__factors {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .evaluation-dialog__factors label > span {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 7px;
    color: var(--el-text-color-regular);
  }

  .evaluation-dialog__factors label > span strong {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    color: #fff;
    background: var(--theme-color);
    border-radius: var(--art-surface-radius);
  }

  .evaluation-dialog__factors :deep(.el-select) {
    width: 100%;
  }

  .evaluation-dialog__option {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .evaluation-dialog__option strong {
    width: 38px;
    color: var(--theme-color);
  }

  .evaluation-dialog__result {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
  }

  .evaluation-dialog__result > div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px 10px;
    padding: 14px;
    background: var(--el-fill-color-light);
    border-radius: var(--el-border-radius-base);
  }

  .evaluation-dialog__result small {
    color: var(--el-text-color-secondary);
  }

  .evaluation-dialog__result strong {
    grid-row: 1/3;
    grid-column: 2;
    font-size: 28px;
    color: var(--risk-color, var(--theme-color));
  }

  .evaluation-dialog__result span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 720px) {
    .evaluation-dialog__factors {
      grid-template-columns: 1fr;
    }

    .evaluation-dialog__result {
      grid-template-columns: 1fr;
    }
  }
</style>
