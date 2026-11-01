<template>
  <ArtPermissionGuard permission="SmisDualControlRiskAssessmentStandardModel:View">
    <div class="risk-model-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="QUANTITATIVE RISK MODEL"
        title="风险评估标准模型"
        description="维护 LEC 作业条件危险分析法与 LS 风险矩阵的判定标准、分值区间和风险等级映射。"
        icon="ri:function-line"
        density="compact"
        refreshable
        :refresh-loading="loading"
        @refresh="loadModels"
        :tags="[
          { label: 'LEC 定量评价', type: 'primary', effect: 'plain' },
          { label: 'LS 风险矩阵', type: 'warning', effect: 'light' },
          { label: '自动匹配等级', type: 'success', effect: 'plain' }
        ]"
        :metrics="metrics"
      >
      </BusinessWorkspaceHeader>

      <ElScrollbar class="risk-model-page__scrollbar">
        <div class="risk-model-page__content">
          <nav class="risk-model-page__method-switch" role="tablist" aria-label="风险评估方法">
            <button
              v-for="model in models"
              :key="model.id"
              type="button"
              role="tab"
              :aria-selected="activeMethod === model.methodCode"
              :class="{ 'is-active': activeMethod === model.methodCode }"
              :disabled="loading"
              @click="activeMethod = model.methodCode"
            >
              <span class="risk-model-page__method-code">{{ model.methodCode }}</span
              ><div class="risk-model-page__method-copy"
                ><strong>{{ model.modelName }}</strong
                ><small>{{ model.description || '暂无方法说明' }}</small></div
              ><span class="risk-model-page__method-meta"
                >{{ model.dimensions.length }} 个维度 · {{ criteriaCount(model) }} 条标准</span
              ><ArtSvgIcon
                :icon="
                  activeMethod === model.methodCode
                    ? 'ri:checkbox-circle-fill'
                    : 'ri:arrow-right-s-line'
                "
              />
            </button>
          </nav>

          <ArtSectionCard
            class="risk-model-page__decision-card"
            title="模型判定逻辑"
            subtitle="核对计算公式与风险等级阈值，确保量化结果和分级规则保持一致。"
            :loading="loading"
            :error="error"
            :empty="!loading && !error && !activeModel"
            empty-title="暂无评估模型"
            empty-description="请先初始化风险评估模型数据。"
            @retry="loadModels"
          >
            <div v-if="activeModel" class="risk-model-page__decision-layout">
              <section class="risk-model-page__formula-panel" aria-labelledby="formula-title">
                <span class="risk-model-page__kicker">计算公式</span>
                <h3 id="formula-title">{{ activeModel.modelName }}</h3>
                <div class="risk-model-page__equation" aria-label="风险计算公式"
                  ><span
                    v-for="(part, index) in equationParts"
                    :key="`${part}-${index}`"
                    :class="{ 'is-operator': ['×', '='].includes(part) }"
                    >{{ part }}</span
                  ></div
                >
                <p>{{
                  activeMethod === 'LEC'
                    ? 'D = L × E × C，系统依据 D 值自动匹配风险等级。'
                    : 'R = L × S，矩阵交叉结果自动映射风险等级。'
                }}</p>
              </section>

              <section class="risk-model-page__spectrum" aria-labelledby="spectrum-title">
                <div class="risk-model-page__spectrum-heading">
                  <div>
                    <span class="risk-model-page__kicker">结果分级</span>
                    <h3 id="spectrum-title">风险等级谱</h3>
                  </div>
                  <span class="risk-model-page__result-code">计算结果 {{ resultCode }}</span>
                </div>
                <div class="risk-model-page__levels">
                  <article
                    v-for="level in activeModel.levels"
                    :key="level.id"
                    :style="{ '--level-color': level.color }"
                  >
                    <div class="risk-model-page__level-copy">
                      <span>
                        <span class="risk-model-page__level-dot" aria-hidden="true"></span>
                        <strong>{{ level.levelName }}</strong>
                      </span>
                      <small>{{ levelRange(level) }} · {{ level.levelCode }}</small>
                    </div>
                    <ArtIconButton
                      icon="ri:edit-line"
                      :label="`编辑${level.levelName}阈值`"
                      :disabled="isCrossTenantReadOnly"
                      permission="SmisDualControlRiskAssessmentStandardModel:Edit"
                      @click="openLevel(level)"
                    />
                  </article>
                </div>
              </section>
            </div>
          </ArtSectionCard>

          <section
            v-if="activeModel"
            class="risk-model-page__criteria-workspace"
            aria-labelledby="criteria-workspace-title"
          >
            <header class="risk-model-page__criteria-heading">
              <div>
                <ArtSectionTitle id="criteria-workspace-title" :show-line="false">
                  判定维度与评分标准
                </ArtSectionTitle>
                <p>
                  当前模型包含 {{ activeModel.dimensions.length }} 个判定维度、
                  {{ activeCriteriaCount }} 条评分标准。
                </p>
              </div>
            </header>

            <div class="risk-model-page__dimension-grid">
              <ArtSectionCard
                v-for="dimension in activeModel.dimensions"
                :key="dimension.id"
                class="risk-model-page__dimension-card"
                :title="`${dimension.dimensionCode} · ${dimension.dimensionName}`"
                :subtitle="dimension.description || '配置该维度的量化判定标准'"
                :empty="dimension.criteria.length === 0"
                empty-title="暂无判定标准"
                empty-description="使用右上角新增按钮补充该维度的分值与判断依据。"
                :empty-visual-size="72"
                :min-height="280"
              >
                <template #actions>
                  <span class="risk-model-page__dimension-count">
                    {{ dimension.criteria.length }} 项
                  </span>
                  <ArtIconButton
                    icon="ri:add-line"
                    :label="`新增${dimension.dimensionName}判定标准`"
                    :disabled="isCrossTenantReadOnly"
                    permission="SmisDualControlRiskAssessmentStandardModel:Add"
                    @click="openCriterion(dimension)"
                  />
                </template>

                <div class="risk-model-page__criterion-legend" aria-hidden="true">
                  <span>分值</span>
                  <span>判定说明</span>
                  <span>操作</span>
                </div>
                <ol class="risk-model-page__criterion-list">
                  <li v-for="criterion in dimension.criteria" :key="criterion.id">
                    <strong class="risk-model-page__score">{{ criterion.score }}</strong>
                    <p :title="criterion.criterionText">{{ criterion.criterionText }}</p>
                    <span class="risk-model-page__row-actions">
                      <ArtIconButton
                        icon="ri:pencil-line"
                        :label="`编辑分值 ${criterion.score} 的判定标准`"
                        :disabled="isCrossTenantReadOnly"
                        permission="SmisDualControlRiskAssessmentStandardModel:Edit"
                        @click="openCriterion(dimension, criterion)"
                      />
                      <ArtIconButton
                        icon="ri:delete-bin-5-line"
                        tone="danger"
                        :label="`删除分值 ${criterion.score} 的判定标准`"
                        :disabled="isCrossTenantReadOnly"
                        permission="SmisDualControlRiskAssessmentStandardModel:Delete"
                        @click="deleteCriterion(criterion)"
                      />
                    </span>
                  </li>
                </ol>
              </ArtSectionCard>
            </div>
          </section>

          <ArtSectionCard
            :show-scrollbar="false"
            v-if="activeModel && activeMethod === 'LS'"
            title="LS 风险矩阵预览"
            subtitle="纵轴为可能性 L，横轴为严重性 S；颜色按当前等级阈值实时计算。"
          >
            <ElScrollbar class="risk-model-page__matrix-scrollbar">
              <div class="risk-model-page__matrix">
                <div class="risk-model-page__matrix-corner">L \ S</div>
                <div v-for="s in sScores" :key="`s-${s}`" class="risk-model-page__matrix-head">{{
                  s
                }}</div>
                <template v-for="l in lScores" :key="`l-${l}`"
                  ><div class="risk-model-page__matrix-head">{{ l }}</div
                  ><div
                    v-for="s in sScores"
                    :key="`${l}-${s}`"
                    class="risk-model-page__matrix-cell"
                    :style="{ background: levelFor(l * s)?.color || 'var(--el-fill-color)' }"
                    ><strong>{{ l * s }}</strong
                    ><small>{{ levelFor(l * s)?.levelName }}</small></div
                  ></template
                >
              </div>
            </ElScrollbar>
          </ArtSectionCard>
        </div>
      </ElScrollbar>

      <CriterionDialog ref="criterionDialogRef" @success="loadModels" /><LevelDialog
        ref="levelDialogRef"
        @success="loadModels"
      />
    </div>
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </ArtPermissionGuard>
</template>
<script setup lang="ts">
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'

  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import { useTenantScopeAccessPolicy } from '@/hooks/core/useTenantScopeAccessPolicy'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import {
    deleteRiskAssessmentCriteria,
    fetchRiskAssessmentModels,
    type SmisRiskAssessmentCriterion,
    type SmisRiskAssessmentDimension,
    type SmisRiskAssessmentLevel,
    type SmisRiskAssessmentMethod,
    type SmisRiskAssessmentModel
  } from '@smis/api'
  import CriterionDialog, { type CriterionDialogOpenData } from './modules/criterion-dialog.vue'
  import LevelDialog, { type LevelDialogOpenData } from './modules/level-dialog.vue'
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'smis_risk_assessment_criterion',
    '风险判定标准'
  )

  defineOptions({ name: 'SmisDualControlRiskAssessmentStandardModel' })
  interface CriterionDialogExpose {
    handleOpen: (data: CriterionDialogOpenData) => Promise<void>
  }
  interface LevelDialogExpose {
    handleOpen: (data: LevelDialogOpenData) => Promise<void>
  }
  const { isCrossTenantReadOnly } = useTenantScopeAccessPolicy()
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId, revision } = storeToRefs(tenantScopeStore)
  const criterionDialogRef = ref<CriterionDialogExpose>()
  const levelDialogRef = ref<LevelDialogExpose>()
  const models = ref<SmisRiskAssessmentModel[]>([])
  const activeMethod = ref<SmisRiskAssessmentMethod>('LEC')
  const loading = ref(false)
  const error = ref('')
  const activeModel = computed(() => models.value.find((m) => m.methodCode === activeMethod.value))
  const equationParts = computed(() =>
    activeMethod.value === 'LEC' ? ['L', '×', 'E', '×', 'C', '=', 'D'] : ['L', '×', 'S', '=', 'R']
  )
  const resultCode = computed(() => (activeMethod.value === 'LEC' ? 'D' : 'R'))
  const criteriaCount = (model: SmisRiskAssessmentModel) =>
    model.dimensions.reduce((total, dimension) => total + dimension.criteria.length, 0)
  const activeCriteriaCount = computed(() =>
    activeModel.value ? criteriaCount(activeModel.value) : 0
  )
  const levelRange = (level: SmisRiskAssessmentLevel) =>
    level.maxScore == null
      ? `${resultCode.value} ≥ ${level.minScore}`
      : `${level.minScore} ≤ ${resultCode.value} < ${level.maxScore}`
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '评估模型',
      value: models.value.length,
      description: 'LEC 与 LS',
      icon: 'ri:function-line'
    },
    {
      label: '判定维度',
      value: models.value.reduce((n, m) => n + m.dimensions.length, 0),
      description: '量化因子',
      icon: 'ri:compasses-2-line'
    },
    {
      label: '判定标准',
      value: models.value.reduce(
        (n, m) => n + m.dimensions.reduce((c, d) => c + d.criteria.length, 0),
        0
      ),
      description: '分值选项',
      icon: 'ri:list-check-3'
    },
    {
      label: '风险等级',
      value: activeModel.value?.levels.length || 0,
      description: '当前模型分级',
      icon: 'ri:shield-star-line',
      tone: 'success'
    }
  ])
  const lScores = computed(() =>
    [...(activeModel.value?.dimensions.find((d) => d.dimensionCode === 'L')?.criteria || [])]
      .map((i) => i.score)
      .sort((a, b) => b - a)
  )
  const sScores = computed(() =>
    [...(activeModel.value?.dimensions.find((d) => d.dimensionCode === 'S')?.criteria || [])]
      .map((i) => i.score)
      .sort((a, b) => a - b)
  )
  const levelFor = (score: number) =>
    [...(activeModel.value?.levels || [])]
      .sort((a, b) => b.minScore - a.minScore)
      .find(
        (level) => score >= level.minScore && (level.maxScore == null || score < level.maxScore)
      )
  const loadModels = async () => {
    loading.value = true
    error.value = ''
    try {
      const result = await fetchRiskAssessmentModels(effectiveTenantId.value)
      models.value = result.data ?? []
      if (!models.value.some((m) => m.methodCode === activeMethod.value))
        activeMethod.value = models.value[0]?.methodCode || 'LEC'
    } catch {
      error.value = '评估模型加载失败，请稍后重试。'
    } finally {
      loading.value = false
    }
  }
  const openCriterion = (
    dimension: SmisRiskAssessmentDimension,
    row?: SmisRiskAssessmentCriterion
  ) =>
    void criterionDialogRef.value?.handleOpen({
      row,
      dimension,
      tenantId: activeModel.value?.tenantId || effectiveTenantId.value || ''
    })
  const openLevel = (row: SmisRiskAssessmentLevel) => void levelDialogRef.value?.handleOpen({ row })
  const deleteCriterion = async (row: SmisRiskAssessmentCriterion) => {
    await deleteRecords({
      resources: [
        {
          id: String(row.id ?? ''),
          label: String(row.score ?? '风险判定标准')
        }
      ],
      permission: 'SmisDualControlRiskAssessmentStandardModel:Delete',
      confirmMessage: `确定删除分值 ${row.score} 的判定标准吗？`,
      remove: async () => {
        await deleteRiskAssessmentCriteria([row.id ?? ''])
      },
      onDeleted: async () => {
        await loadModels()
      }
    })
  }
  onMounted(async () => {
    await tenantScopeStore.loadTenantOptions()
    await loadModels()
  })
  watch(revision, loadModels)
</script>
<style scoped lang="scss">
  .risk-model-page {
    min-width: 0;
    overflow: hidden;

    &__scrollbar {
      flex: 1 1 auto;
      min-height: 0;
    }

    &__content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      padding-right: 2px;
      padding-bottom: 12px;
    }

    &__method-switch {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;

      button {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) auto 20px;
        gap: 12px;
        align-items: center;
        min-height: 68px;
        padding: 10px 12px;
        color: var(--el-text-color-regular);
        text-align: left;
        cursor: pointer;
        background: var(--default-box-color);
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--el-border-radius-base);
        transition:
          background-color var(--art-motion-duration-fast),
          border-color var(--art-motion-duration-fast),
          box-shadow var(--art-motion-duration-fast);

        &:hover,
        &.is-active {
          background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
          border-color: color-mix(in srgb, var(--theme-color) 24%, transparent);
        }

        &.is-active {
          box-shadow: inset 3px 0 0 var(--theme-color);
        }

        &:focus-visible {
          outline: 2px solid var(--theme-color);
          outline-offset: 2px;
        }

        &:disabled {
          cursor: wait;
          opacity: 0.65;
        }
      }
    }

    &__method-code {
      display: grid;
      place-items: center;
      width: 44px;
      height: 40px;
      font-weight: 800;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    &__method-copy {
      display: flex;
      flex-direction: column;
      min-width: 0;

      small {
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }
    }

    &__method-meta,
    &__result-code,
    &__dimension-count {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    &__decision-card {
      :deep(.art-section-card__body) {
        padding-top: 14px;
      }
    }

    &__decision-layout {
      display: grid;
      grid-template-columns: minmax(260px, 0.65fr) minmax(0, 1.8fr);
      gap: 16px;
    }

    &__formula-panel {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      padding: 16px;
      background: var(--art-gray-100);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      h3,
      p {
        margin: 0;
      }

      p {
        margin-top: 10px;
        font-size: 12px;
        line-height: 1.6;
        color: var(--el-text-color-secondary);
      }
    }

    &__kicker {
      margin-bottom: 3px;
      font-size: 11px;
      font-weight: 700;
      color: var(--theme-color);
      letter-spacing: 0.08em;
    }

    &__equation {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-top: 12px;

      span {
        display: grid;
        place-items: center;
        min-width: 36px;
        height: 36px;
        font-weight: 800;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
        border-radius: var(--el-border-radius-base);

        &.is-operator {
          min-width: 22px;
          color: var(--el-text-color-secondary);
          background: transparent;
        }
      }
    }

    &__spectrum {
      min-width: 0;
      padding: 4px 0;
    }

    &__spectrum-heading {
      display: flex;
      gap: 12px;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: 12px;

      h3 {
        margin: 0;
      }
    }

    &__result-code {
      padding-bottom: 2px;
    }

    &__levels {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--art-space-2);

      article {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 34px;
        gap: var(--art-space-2);
        align-items: center;
        min-width: 0;
        min-height: 68px;
        padding: var(--art-space-3) var(--art-space-3) var(--art-space-3) var(--art-space-4);
        background: color-mix(in srgb, var(--level-color) 4%, var(--default-box-color));
        border: 1px solid color-mix(in srgb, var(--level-color) 24%, var(--el-border-color));
        border-top: 3px solid var(--level-color);
        border-radius: var(--el-border-radius-base);
      }
    }

    &__level-copy {
      display: flex;
      flex-direction: column;
      min-width: 0;

      > span {
        display: flex;
        gap: var(--art-space-2);
        align-items: center;
        min-width: 0;
      }

      .risk-model-page__level-dot {
        flex: none;
        width: 8px;
        height: 8px;
        background: var(--level-color);
        border-radius: 50%;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: var(--art-space-1);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-secondary);
      }
    }

    &__criteria-workspace {
      display: flex;
      flex-direction: column;
      gap: var(--art-space-4);
      min-width: 0;
      padding: var(--art-space-2) var(--art-space-1) var(--art-space-3);
    }

    &__criteria-heading {
      padding: 0 var(--art-space-2);

      :deep(.art-section-title) {
        margin: 0;
        font-size: var(--art-font-size-section-title);
      }

      p {
        margin: var(--art-space-1) 0 0 11px;
        font-size: var(--art-font-size-caption);
        line-height: 20px;
        color: var(--el-text-color-secondary);
      }
    }

    &__dimension-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: var(--art-space-4);
      align-items: stretch;
    }

    &__dimension-card {
      display: flex;
      flex-direction: column;
      min-width: 0;

      :deep(.art-section-card__body) {
        flex: 1;
        min-width: 0;
      }
    }

    &__criterion-legend,
    &__criterion-list li {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) 76px;
      gap: var(--art-space-3);
      align-items: center;
      min-width: 0;
    }

    &__criterion-legend {
      padding: 0 var(--art-space-3) var(--art-space-2);
      font-size: 11px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      border-bottom: 1px solid var(--el-border-color-lighter);

      span:last-child {
        text-align: right;
      }
    }

    &__criterion-list {
      padding: 0;
      margin: 0;
      list-style: none;

      li {
        min-height: 56px;
        padding: var(--art-space-2) var(--art-space-3);
        border-bottom: 1px solid var(--el-border-color-lighter);
        transition: background-color var(--art-motion-duration-fast);

        &:last-child {
          border-bottom: 0;
        }

        &:hover {
          background: color-mix(in srgb, var(--theme-color) 3%, transparent);
        }

        p {
          min-width: 0;
          margin: 0;
          line-height: 1.55;
          color: var(--el-text-color-regular);
          overflow-wrap: anywhere;
        }
      }
    }

    &__score {
      font-size: 15px;
      font-variant-numeric: tabular-nums;
      color: var(--theme-color);
    }

    &__row-actions {
      display: flex;
      gap: var(--art-space-1);
      align-items: center;
      justify-content: flex-end;
    }

    &__matrix-scrollbar {
      width: 100%;
    }

    &__matrix {
      display: grid;
      grid-template-columns: 78px repeat(5, minmax(76px, 1fr));
      gap: 4px;
      min-width: 650px;
      padding-bottom: 8px;
    }

    &__matrix-corner,
    &__matrix-head {
      display: grid;
      place-items: center;
      min-height: 42px;
      font-weight: 700;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color-light);
      border-radius: var(--el-border-radius-small);
    }

    &__matrix-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 58px;
      color: #fff;
      text-shadow: 0 1px 2px rgb(0 0 0 / 25%);
      border-radius: var(--el-border-radius-small);

      small {
        font-size: 11px;
      }
    }

    @media (width <= 900px) {
      &__method-switch {
        grid-template-columns: 1fr;
      }

      &__decision-layout {
        grid-template-columns: 1fr;
      }

      &__levels {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      &__method-meta {
        display: none;
      }
    }

    @media (width <= 560px) {
      &__dimension-grid,
      &__levels {
        grid-template-columns: 1fr;
      }

      &__method-switch button {
        grid-template-columns: 44px minmax(0, 1fr) 20px;

        > svg {
          grid-column: 3;
        }
      }
    }
  }
</style>
