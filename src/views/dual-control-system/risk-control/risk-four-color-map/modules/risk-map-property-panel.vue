<template>
  <ArtSectionCard
    class="risk-map-property-panel"
    title="图形属性"
    :subtitle="model ? '调整图形后保存整张场景图' : '选择画布中的图形进行配置'"
    :min-height="420"
  >
    <template #actions>
      <div class="risk-map-property-panel__header-actions">
        <ElButton
          v-if="model && hasAuth('SmisDualControlRiskFourColorMap:Save')"
          text
          type="danger"
          @click="emit('delete-shape')"
        >
          <ArtSvgIcon icon="ri:delete-bin-6-line" />删除图形
        </ElButton>
        <ElButton
          v-if="scene && hasAuth('SmisDualControlRiskFourColorMap:EditScene')"
          text
          type="primary"
          @click="emit('edit-scene')"
        >
          <template #icon><ArtSvgIcon icon="ri:settings-3-line" /></template>
          场景设置
        </ElButton>
      </div>
    </template>

    <template v-if="model">
      <div class="risk-map-property-panel__selection-status">
        <span><ArtSvgIcon icon="ri:cursor-line" /></span>
        <div>
          <small>当前选中图形</small>
          <strong>{{ model.label || '未命名图形' }}</strong>
        </div>
        <ElTag size="small" effect="plain">可编辑</ElTag>
      </div>
      <div class="risk-map-property-panel__section-label">图形与风险点</div>
      <ArtForm
        v-model="model"
        :items="formItems"
        :span="12"
        :gutter="12"
        label-position="top"
        root-class="px-0! pt-0!"
      />

      <SceneSummary :scene="scene" @edit-scene="emit('edit-scene')" />
    </template>

    <div v-else class="risk-map-property-panel__empty-layout">
      <SceneSummary
        v-if="scene"
        class="risk-map-property-panel__scene-context"
        :scene="scene"
        :show-action="false"
        @edit-scene="emit('edit-scene')"
      />
      <ArtEmptyState
        class="risk-map-property-panel__guide"
        :title="scene ? '选择或添加一个图形' : '先选择一个场景'"
        :description="
          scene
            ? '从画布点选图形后，可在这里统一配置位置、样式和关联风险点。'
            : '从左侧场景树进入对应区域，再开始配置风险图。'
        "
        size="compact"
        :visual-size="64"
      >
        <ol v-if="scene" aria-label="四色图配置步骤">
          <li><span>1</span>添加或选择图形</li>
          <li><span>2</span>拖拽定位并关联风险点</li>
          <li><span>3</span>检查样式后保存场景</li>
        </ol>
      </ArtEmptyState>
    </div>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import type { FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtForm from '@/components/core/forms/art-form/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import type { SmisRiskMapPointOption, SmisRiskMapScene, SmisRiskMapShape } from '@smis/api'
  import SceneSummary from './risk-map-scene-summary.vue'

  defineOptions({ name: 'SmisRiskMapPropertyPanel' })
  const { hasAuth } = useAuth()

  const props = defineProps<{
    scene?: SmisRiskMapScene
    riskPoints: SmisRiskMapPointOption[]
    riskColors: string[]
  }>()
  const model = defineModel<SmisRiskMapShape>()
  const emit = defineEmits<{
    'risk-point-change': [id?: string]
    'edit-scene': []
    'delete-shape': []
  }>()

  const formItems = computed<FormItem[]>(() => [
    {
      label: '图形文字',
      key: 'label',
      type: 'input',
      span: 24,
      props: { maxlength: 40, placeholder: '显示在图形中心' }
    },
    {
      label: '关联风险点',
      key: 'riskPointId',
      span: 24,
      type: 'select',
      get options(): FormItem['options'] {
        return props.riskPoints.map((point) => ({
          label: `${point.pointName} · ${point.pointNo}`,
          value: point.id
        }))
      },
      get props(): FormItem['props'] {
        return {
          filterable: true,
          clearable: true,
          placeholder: '选择关联风险点',
          onChange: ($event: string | undefined) => {
            emit('risk-point-change', $event)
          }
        }
      }
    },
    {
      label: 'X 坐标',
      key: 'x',
      type: 'number',
      props: { min: 0, max: props.scene?.canvasWidth ?? 1000, controlsPosition: 'right' }
    },
    {
      label: 'Y 坐标',
      key: 'y',
      type: 'number',
      props: { min: 0, max: props.scene?.canvasHeight ?? 650, controlsPosition: 'right' }
    },
    {
      label: '宽度',
      key: 'width',
      type: 'number',
      props: { min: 8, max: props.scene?.canvasWidth ?? 1000, controlsPosition: 'right' }
    },
    {
      label: '高度',
      key: 'height',
      type: 'number',
      props: { min: 8, max: props.scene?.canvasHeight ?? 650, controlsPosition: 'right' }
    },
    {
      label: '填充颜色',
      key: 'fillColor',
      type: 'colorPicker',
      span: 24,
      description: model.value?.fillColor || '未设置颜色',
      props: { predefine: props.riskColors }
    },
    {
      label: '填充透明度',
      key: 'fillOpacity',
      span: 24,
      type: 'slider',
      get props(): FormItem['props'] {
        return { min: 0, max: 1, step: 0.05, showInput: true, showInputControls: false }
      }
    },
    {
      label: '边框颜色',
      key: 'borderColor',
      type: 'colorPicker',
      span: 24,
      description: model.value?.borderColor || '未设置颜色',
      props: { predefine: props.riskColors }
    },
    {
      label: '边框透明度',
      key: 'borderOpacity',
      span: 24,
      type: 'slider',
      get props(): FormItem['props'] {
        return { min: 0, max: 1, step: 0.05, showInput: true, showInputControls: false }
      }
    },
    {
      label: '边框宽度',
      key: 'borderWidth',
      type: 'number',
      props: { min: 0, max: 40, step: 1, controlsPosition: 'right' }
    },
    {
      label: '旋转角度',
      key: 'rotation',
      type: 'number',
      props: { min: -180, max: 180, step: 5, controlsPosition: 'right' }
    }
  ])
</script>

<style scoped lang="scss">
  .risk-map-property-panel {
    display: flex;
    flex-direction: column;

    :deep(.art-section-card__scrollbar) {
      min-height: 360px;
    }

    &__header-actions {
      display: flex;
      gap: var(--art-space-1);
      align-items: center;

      :deep(.el-button + .el-button) {
        margin-left: 0;
      }
    }

    &__selection-status {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      padding: var(--art-space-3);
      margin-bottom: var(--art-space-3);
      background: color-mix(in srgb, var(--theme-color) 7%, var(--el-fill-color-blank));
      border: 1px solid color-mix(in srgb, var(--theme-color) 18%, var(--el-border-color-lighter));
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        flex: none;
        place-items: center;
        width: 32px;
        height: 32px;
        color: var(--theme-color);
        background: var(--el-fill-color-blank);
        border-radius: var(--el-border-radius-small);
      }

      > div {
        display: grid;
        min-width: 0;
        margin-right: auto;

        small {
          font-size: var(--art-font-size-caption);
          color: var(--el-text-color-secondary);
        }

        strong {
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--el-text-color-primary);
          white-space: nowrap;
        }
      }
    }

    &__section-label {
      padding-bottom: var(--art-space-3);
      margin-bottom: var(--art-space-3);
      font-size: var(--art-font-size-caption);
      font-weight: 700;
      color: var(--el-text-color-primary);
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__color-control,
    &__point-option {
      display: flex;
      align-items: center;
    }

    &__color-control {
      gap: var(--art-space-2);
      min-height: 32px;

      code {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__point-option {
      gap: var(--art-space-2);
      min-width: 0;

      > span {
        flex: none;
        width: 9px;
        height: 9px;
        border-radius: 50%;
      }

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      small {
        margin-left: auto;
        color: var(--el-text-color-secondary);
      }
    }

    &__empty-layout {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: var(--art-space-3);
      min-height: 0;
      overflow: hidden;
    }

    &__scene-context {
      flex: none;
      margin-top: 0;
    }

    &__guide {
      flex: 1 1 auto;
      min-height: 0;
      padding: var(--art-space-4) var(--art-space-3);
      background: color-mix(in srgb, var(--el-fill-color-light) 72%, transparent);
      border: 1px dashed var(--el-border-color-lighter);
      border-radius: var(--el-border-radius-base);

      :deep(.art-empty-state__action) {
        width: min(100%, 300px);
      }

      ol {
        display: grid;
        gap: var(--art-space-1);
        width: 100%;
        padding: var(--art-space-2);
        margin: 0;
        text-align: left;
        list-style: none;
        background: var(--el-fill-color-light);
        border: 1px solid var(--el-border-color-lighter);
        border-radius: var(--el-border-radius-base);
      }

      li {
        display: flex;
        gap: var(--art-space-2);
        align-items: center;
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-regular);

        span {
          display: grid;
          flex: none;
          place-items: center;
          width: 20px;
          height: 20px;
          font-size: 11px;
          font-weight: 700;
          color: var(--theme-color);
          background: color-mix(in srgb, var(--theme-color) 10%, var(--el-fill-color-blank));
          border-radius: 50%;
        }
      }
    }

    :deep(.art-section-card__body),
    :deep(.art-async-state) {
      min-height: 0;
    }

    :deep(.art-section-card__body),
    :deep(.art-async-state) {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
    }

    :deep(.el-scrollbar__view) {
      min-height: 100%;
    }
  }
</style>
