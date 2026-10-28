<template>
  <ArtSectionCard
    :show-scrollbar="false"
    class="operation-type-navigator"
    :class="{ 'has-state': loading || error || !data.length }"
    title="作业类型"
    subtitle="选择类型后同步筛选右侧配置"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !data.length"
    empty-title="暂无作业类型"
    empty-description="请先在作业类型页面维护租户适用的特殊作业类型。"
    :min-height="360"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新作业类型"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>

    <div class="operation-type-navigator__content">
      <ElInput v-model="keyword" clearable placeholder="搜索作业类型">
        <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
      </ElInput>

      <button
        type="button"
        class="operation-type-navigator__item operation-type-navigator__item--all"
        :class="{ 'is-current': selectedId === null }"
        @click="emit('select', null)"
      >
        <span class="operation-type-navigator__icon" aria-hidden="true">
          <ArtSvgIcon icon="ri:stack-line" />
        </span>
        <span class="operation-type-navigator__label">
          <strong>全部作业类型</strong>
          <small>{{ data.length }} 个类型</small>
        </span>
        <ArtSvgIcon v-if="selectedId === null" icon="ri:check-line" />
      </button>

      <ElScrollbar class="operation-type-navigator__scrollbar">
        <div class="operation-type-navigator__list">
          <button
            v-for="item in filteredData"
            :key="item.id"
            type="button"
            class="operation-type-navigator__item"
            :class="{ 'is-current': selectedId === item.id, 'is-voided': item.status === 'voided' }"
            :disabled="item.status === 'voided'"
            @click="emit('select', item.id)"
          >
            <span
              class="operation-type-navigator__marker"
              :style="{ color: item.textColor || undefined }"
              aria-hidden="true"
            >
              <i :style="{ backgroundColor: item.textColor || 'var(--theme-color)' }" />
            </span>
            <span class="operation-type-navigator__label">
              <strong :title="item.typeName">{{ item.typeName }}</strong>
              <small>{{ item.typeCode }} · {{ statusLabel(item.status) }}</small>
            </span>
            <ArtSvgIcon v-if="selectedId === item.id" icon="ri:check-line" />
          </button>
        </div>
      </ElScrollbar>
    </div>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { SmisSpecialOperationStatus, SmisSpecialOperationType } from '@smis/api'

  const props = defineProps<{
    data: SmisSpecialOperationType[]
    loading: boolean
    error: string | null
    selectedId: string | null
  }>()

  const emit = defineEmits<{
    select: [id: string | null]
    refresh: []
  }>()

  const keyword = ref('')
  const filteredData = computed(() => {
    const query = keyword.value.trim().toLocaleLowerCase('zh-CN')
    if (!query) return props.data
    return props.data.filter((item) =>
      [item.typeName, item.typeCode].some((value) =>
        value.toLocaleLowerCase('zh-CN').includes(query)
      )
    )
  })

  const statusLabel = (status: SmisSpecialOperationStatus): string => {
    if (status === 'enabled') return '启用'
    if (status === 'disabled') return '禁用'
    return '已作废'
  }
</script>

<style scoped lang="scss">
  .operation-type-navigator {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;

    :deep(.art-section-card__body) {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    &__content {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
    }

    &__scrollbar {
      flex: 1;
      min-height: 0;
    }

    &__list {
      display: grid;
      gap: 4px;
    }

    &__item {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr) 18px;
      gap: 10px;
      align-items: center;
      width: 100%;
      min-height: 58px;
      padding: 8px 10px;
      font: inherit;
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--el-border-radius-base);
      transition:
        background-color var(--el-transition-duration-fast),
        border-color var(--el-transition-duration-fast),
        color var(--el-transition-duration-fast);

      &:hover:not(:disabled),
      &.is-current {
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
        border-color: color-mix(in srgb, var(--theme-color) 22%, transparent);
      }

      &:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--theme-color) 48%, transparent);
        outline-offset: 1px;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.58;
      }

      &--all {
        background: var(--art-gray-100);
      }
    }

    &__icon,
    &__marker {
      @include business-icon-box;
    }

    &__marker i {
      width: 12px;
      height: 12px;
      background: currentcolor;
      border: 3px solid color-mix(in srgb, currentcolor 20%, var(--default-box-color));
      border-radius: 50%;
    }

    &__label {
      display: grid;
      min-width: 0;

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 3px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    @media (width <= 820px) {
      height: max(260px, 36vh);

      &.has-state {
        height: auto;
      }
    }
  }
</style>
