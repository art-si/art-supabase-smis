<template>
  <div class="smis-ai-capability-guide" :aria-label="ariaLabel">
    <article
      v-for="item in items"
      :key="item.title"
      class="smis-ai-capability-guide__item"
      :class="`smis-ai-capability-guide__item--${item.tone}`"
    >
      <span class="smis-ai-capability-guide__icon" aria-hidden="true">
        <ArtSvgIcon :icon="item.icon" />
      </span>
      <span class="smis-ai-capability-guide__copy">
        <strong>{{ item.title }}</strong>
        <small v-if="item.description">{{ item.description }}</small>
      </span>
    </article>
  </div>
</template>

<script setup lang="ts">
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'

  export interface SmisAiCapabilityItem {
    icon: string
    title: string
    description?: string
    tone: 'primary' | 'warning' | 'success'
  }

  withDefaults(
    defineProps<{
      items: readonly SmisAiCapabilityItem[]
      ariaLabel?: string
    }>(),
    { ariaLabel: 'AI 辅助能力' }
  )
</script>

<style scoped lang="scss">
  .smis-ai-capability-guide {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--art-space-2);
    padding-top: var(--art-space-4);
    margin-top: var(--art-space-4);
    border-top: 1px dashed var(--el-border-color);

    &__item {
      --guide-rgb: 99 102 241;

      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      min-width: 0;
      padding: var(--art-space-3);
      background: color-mix(in srgb, rgb(var(--guide-rgb)) 5%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, rgb(var(--guide-rgb)) 15%, var(--el-border-color));
      border-radius: var(--el-border-radius-base);
      transition:
        border-color 0.2s ease,
        transform 0.2s ease;

      &:hover {
        border-color: color-mix(in srgb, rgb(var(--guide-rgb)) 30%, var(--el-border-color));
        transform: translateY(-1px);
      }

      &--warning {
        --guide-rgb: 217 119 6;
      }

      &--success {
        --guide-rgb: 5 150 105;
      }
    }

    &__icon {
      display: grid;
      flex: 0 0 30px;
      place-items: center;
      width: 30px;
      height: 30px;
      font-size: 15px;
      color: rgb(var(--guide-rgb));
      background: rgb(var(--guide-rgb) / 10%);
      border-radius: var(--art-surface-radius);
    }

    &__copy {
      display: flex;
      flex-direction: column;
      min-width: 0;

      strong {
        font-size: 12px;
        font-weight: 650;
        color: var(--el-text-color-primary);
      }

      small {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }
    }

    @media (width <= 860px) {
      grid-template-columns: 1fr;
    }
  }
</style>
