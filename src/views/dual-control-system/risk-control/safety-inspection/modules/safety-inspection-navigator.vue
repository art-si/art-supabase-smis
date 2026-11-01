<template>
  <ArtSectionCard
    :show-scrollbar="false"
    class="safety-inspection-navigator"
    title="检查导航"
    subtitle="按排查类型或被检查组织快速定位"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !inspectionTypes.length && !organizations.length"
    empty-title="暂无导航数据"
    empty-description="请先维护排查类型与系统组织。"
    :min-height="0"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle
        v-if="activeTab === 'organization'"
        :tree="treeRef"
        :data="organizations"
        label="组织树"
        :default-expanded="true"
      />
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新检查导航"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>

    <!-- 页签各自保留滚动位置；内距放在滚动内容中，让轨道始终靠近卡片边缘。 -->
    <ElTabs v-model="activeTab" stretch>
      <ElTabPane label="排查类型" name="type">
        <ElScrollbar class="safety-inspection-navigator__scrollbar art-scroll-viewport-inset">
          <div class="safety-inspection-navigator__list">
            <button
              type="button"
              class="safety-inspection-navigator__item"
              :class="{ 'is-active': modelValue === '' }"
              :aria-pressed="modelValue === ''"
              @click="select('')"
            >
              <span><ArtSvgIcon icon="ri:apps-2-line" /></span>
              <div class="safety-inspection-navigator__item-copy">
                <strong>全部检查</strong>
                <small>全部类型与单位</small>
              </div>
            </button>
            <button
              v-for="item in inspectionTypes"
              :key="item.id"
              type="button"
              class="safety-inspection-navigator__item"
              :class="{ 'is-active': modelValue === `type:${item.id}` }"
              :aria-pressed="modelValue === `type:${item.id}`"
              @click="select(`type:${item.id}`)"
            >
              <span><ArtSvgIcon icon="ri:compass-3-line" /></span>
              <div class="safety-inspection-navigator__item-copy">
                <strong :title="item.typeName">{{ item.typeName }}</strong>
                <small :title="item.typeCode">{{ item.typeCode }}</small>
              </div>
            </button>
          </div>
        </ElScrollbar>
      </ElTabPane>
      <ElTabPane label="组织部门" name="organization">
        <ElScrollbar class="safety-inspection-navigator__scrollbar art-scroll-viewport-inset">
          <ElTree
            ref="treeRef"
            :data="organizations"
            node-key="id"
            :props="treeProps"
            :expand-on-click-node="false"
            default-expand-all
            highlight-current
            :current-node-key="selectedOrganizationId"
            @node-click="handleOrganizationClick"
          >
            <template #empty>
              <ArtEmptyState
                title="暂无组织部门"
                description="当前没有可选择的组织部门。"
                size="compact"
                :visual-size="64"
              />
            </template>
          </ElTree>
        </ElScrollbar>
      </ElTabPane>
    </ElTabs>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import type { ElTree } from 'element-plus'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { SmisSafetyInspectionOrganization, SmisSafetyInspectionTypeOption } from '@smis/api'

  const props = withDefaults(
    defineProps<{
      modelValue?: string
      inspectionTypes?: SmisSafetyInspectionTypeOption[]
      organizations?: SmisSafetyInspectionOrganization[]
      loading?: boolean
      error?: string | null
    }>(),
    {
      modelValue: '',
      inspectionTypes: () => [],
      organizations: () => [],
      loading: false,
      error: null
    }
  )
  const emit = defineEmits<{
    'update:modelValue': [value: string]
    change: [value: string]
    refresh: []
  }>()
  const activeTab = ref<'type' | 'organization'>('type')
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const treeProps = { label: 'organizationName', children: 'children' }
  const selectedOrganizationId = computed(() =>
    props.modelValue.startsWith('organization:')
      ? props.modelValue.slice('organization:'.length)
      : undefined
  )
  const select = (value: string): void => {
    emit('update:modelValue', value)
    emit('change', value)
  }
  const handleOrganizationClick = (row: SmisSafetyInspectionOrganization): void =>
    select(`organization:${row.id}`)
</script>

<style scoped lang="scss">
  .safety-inspection-navigator {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;

    &.art-section-card {
      padding: 0;
    }

    :deep(> .art-section-card__header) {
      padding: var(--art-section-padding) var(--art-section-padding) 0;
    }

    &__scrollbar {
      --art-scroll-viewport-inset: var(--art-section-padding);

      height: 100%;
      min-height: 0;

      :deep(> .el-scrollbar__wrap > .el-scrollbar__view) {
        box-sizing: border-box;
        min-height: 100%;
        padding: 0 var(--art-section-padding) var(--art-section-padding);
      }
    }

    &__list {
      display: grid;
      gap: var(--art-space-2);
    }

    &__item {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      gap: var(--art-space-2);
      align-items: center;
      width: 100%;
      min-height: 52px;
      padding: var(--art-space-2) var(--art-space-3);
      font: inherit;
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: var(--el-fill-color-lighter);
      border: 1px solid transparent;
      border-radius: var(--el-border-radius-base);
      transition:
        color var(--art-motion-duration-fast) ease,
        background-color var(--art-motion-duration-fast) ease,
        border-color var(--art-motion-duration-fast) ease,
        box-shadow var(--art-motion-duration-fast) ease;

      > span {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        color: var(--theme-color);
        background: var(--el-fill-color-blank);
        border-radius: var(--el-border-radius-small);
      }

      &:hover,
      &:focus-visible {
        color: var(--el-text-color-primary);
        outline: none;
        background: color-mix(in srgb, var(--theme-color) 6%, var(--el-fill-color-blank));
        border-color: color-mix(in srgb, var(--theme-color) 28%, transparent);
      }

      &.is-active {
        color: var(--el-text-color-primary);
        background: color-mix(in srgb, var(--theme-color) 11%, var(--el-fill-color-blank));
        border-color: color-mix(in srgb, var(--theme-color) 40%, transparent);
        box-shadow: inset 3px 0 0 var(--theme-color);
      }

      &:focus-visible {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-color) 16%, transparent);
      }
    }

    &__item-copy {
      display: grid;
      gap: 2px;
      min-width: 0;

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        font-size: 14px;
        line-height: 1.35;
      }

      small {
        font-size: var(--art-font-size-caption);
        line-height: 1.25;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.art-section-card__body),
    :deep(.art-async-state),
    :deep(.el-tabs),
    :deep(.el-tabs__content),
    :deep(.el-tab-pane) {
      min-height: 0;
    }

    :deep(.art-section-card__body),
    :deep(.art-async-state) {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
    }

    :deep(.el-tabs) {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
    }

    :deep(.el-tabs__content) {
      flex: 1 1 auto;
      overflow: hidden;
    }

    :deep(.el-tabs__header) {
      flex: none;
      padding-inline: var(--art-section-padding);
    }

    :deep(.el-tab-pane) {
      height: 100%;
    }

    :deep(.el-tree-node__content) {
      min-height: 38px;
      margin-block: 2px;
      border-radius: var(--el-border-radius-small);
    }
  }
</style>
