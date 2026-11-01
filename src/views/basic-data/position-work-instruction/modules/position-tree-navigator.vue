<template>
  <ArtSectionCard
    class="work-position-tree"
    title="适用岗位导航"
    subtitle="组织部门 / HR 岗位"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !data.length"
    empty-title="暂无可用岗位"
    empty-description="请先维护启用的组织与岗位编制。"
    :min-height="320"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle :tree="treeRef" :data="navigationData" node-key="key" label="岗位树" />
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新岗位树"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>

    <template #toolbar>
      <div class="work-position-tree__content">
        <ElInput
          v-model="keyword"
          clearable
          class="work-position-tree__search"
          placeholder="搜索组织或岗位"
          aria-label="搜索组织或岗位"
        >
          <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
        </ElInput>

        <button
          type="button"
          class="work-position-tree__all"
          :class="{ 'is-current': selectedKey === 'all' }"
          @click="emit('select', 'all')"
        >
          <span aria-hidden="true"><ArtSvgIcon icon="ri:layout-grid-line" /></span>
          <span
            ><strong>全部岗位</strong><small>{{ positionCount }} 个可用岗位</small></span
          >
          <ArtSvgIcon v-if="selectedKey === 'all'" icon="ri:check-line" aria-hidden="true" />
        </button>

        <div class="work-position-tree__section-label">
          <span>组织岗位</span>
          <small>{{ positionCount }} 个岗位</small>
        </div>
      </div>
    </template>

    <ElTree
      ref="treeRef"
      :data="navigationData"
      :props="treeProps"
      :filter-node-method="filterNode"
      :default-expanded-keys="defaultExpandedKeys"
      node-key="key"
      highlight-current
      :expand-on-click-node="false"
      @node-click="handleNodeClick"
    >
      <template #default="{ data: node }">
        <div class="work-position-tree__node">
          <span class="work-position-tree__node-icon" aria-hidden="true">
            <ArtSvgIcon
              :icon="node.nodeType === 'position' ? 'ri:briefcase-4-line' : 'ri:node-tree'"
            />
          </span>
          <span class="work-position-tree__node-copy">
            <strong :title="node.label">{{ node.label }}</strong>
            <small :title="node.description">{{ node.description }}</small>
          </span>
          <span v-if="node.nodeType === 'position'" class="work-position-tree__count">
            {{ node.instructionCount || 0 }}
          </span>
          <ArtSvgIcon
            v-else-if="selectedKey === node.key"
            class="work-position-tree__check"
            icon="ri:check-line"
            aria-hidden="true"
          />
        </div>
      </template>
      <template #empty>
        <ArtEmptyState
          title="未找到匹配项"
          description="请调整关键词或清空筛选条件。"
          size="compact"
          :visual-size="64"
        />
      </template>
    </ElTree>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { computed, nextTick, ref, watch } from 'vue'
  import type { ElTree, TreeNodeData } from 'element-plus'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { flattenWorkInstructionTree, type WorkInstructionTreeNode } from './types'

  const props = defineProps<{
    data: WorkInstructionTreeNode[]
    loading: boolean
    error: string | null
    selectedKey: string
  }>()
  const emit = defineEmits<{ select: [key: string]; refresh: [] }>()
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const keyword = ref('')
  const treeProps = { children: 'children', label: 'label' }
  const flatNodes = computed(() => flattenWorkInstructionTree(props.data))
  const navigationData = computed(() => toNavigationNodes(props.data))
  const positionCount = computed(
    () => flatNodes.value.filter((node) => node.nodeType === 'position').length
  )
  const defaultExpandedKeys = computed(() =>
    props.data.map((node) => node.key).filter((key): key is string => Boolean(key))
  )

  const filterNode = (value: string, data: TreeNodeData): boolean => {
    const node = data as WorkInstructionTreeNode
    const normalized = value.trim().toLocaleLowerCase('zh-CN')
    if (!normalized) return true
    return [node.label, node.description].some((field) =>
      String(field ?? '')
        .toLocaleLowerCase('zh-CN')
        .includes(normalized)
    )
  }
  const handleNodeClick = (node: WorkInstructionTreeNode): void => emit('select', node.key)

  function toNavigationNodes(nodes: WorkInstructionTreeNode[]): WorkInstructionTreeNode[] {
    return nodes.map((node) => ({
      ...node,
      disabled: false,
      children: toNavigationNodes(node.children ?? [])
    }))
  }
  const syncCurrentNode = async (): Promise<void> => {
    await nextTick()
    treeRef.value?.setCurrentKey(props.selectedKey === 'all' ? undefined : props.selectedKey)
  }

  watch(keyword, (value) => treeRef.value?.filter(value))
  watch(() => props.selectedKey, syncCurrentNode, { immediate: true })
  watch(
    () => props.data,
    async () => {
      await syncCurrentNode()
      treeRef.value?.filter(keyword.value)
    }
  )
</script>

<style scoped lang="scss">
  .work-position-tree {
    height: 100%;

    :deep(.art-section-card__body) {
      display: flex;
      flex-direction: column;
    }

    &__content {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }

    &__search :deep(.el-input__wrapper) {
      min-height: 36px;
      background: var(--art-gray-100);
      box-shadow: none;

      &:focus-within {
        box-shadow: 0 0 0 1px var(--theme-color) inset;
      }
    }

    &__all {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) 18px;
      gap: 8px;
      align-items: center;
      width: 100%;
      min-height: 48px;
      padding: 6px 8px;
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: var(--el-border-radius-base);
      transition:
        color 0.16s ease,
        background-color 0.16s ease,
        box-shadow 0.16s ease;

      > span:first-child {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
        border-radius: var(--el-border-radius-base);
      }

      > span:nth-child(2) {
        display: grid;
        min-width: 0;
      }

      strong {
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      &:hover,
      &.is-current {
        background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      }

      &.is-current {
        box-shadow: inset 3px 0 0 var(--theme-color);
      }
    }

    &__section-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 28px;
      padding: 8px 8px 0;
      border-top: 1px solid var(--el-border-color-lighter);
    }

    &__section-label span {
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    &__section-label small {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    :deep(.el-tree) {
      min-width: 100%;
      background: transparent;
    }

    :deep(.el-tree-node__content) {
      min-height: 44px;
      margin-bottom: 2px;
      border-radius: var(--el-border-radius-base);
      transition:
        background-color 0.16s ease,
        box-shadow 0.16s ease;
    }

    :deep(.el-tree-node__content:hover) {
      background: var(--art-gray-100);
    }

    :deep(.el-tree-node.is-current > .el-tree-node__content) {
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      box-shadow: inset 3px 0 0 var(--theme-color);
    }

    &__node {
      display: grid;
      flex: 1;
      grid-template-columns: 18px minmax(0, 1fr) 24px;
      gap: 7px;
      align-items: center;
      min-width: 0;
      padding-right: 8px;
    }

    &__node-icon {
      display: inline-flex;
      color: var(--el-text-color-secondary);
    }

    &__node-copy {
      display: grid;
      min-width: 0;
    }

    &__node-copy strong,
    &__node-copy small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__node-copy strong {
      font-size: 13px;
      font-weight: 550;
      color: var(--el-text-color-primary);
    }

    &__node-copy small {
      margin-top: 1px;
      font-size: 10px;
      color: var(--el-text-color-secondary);
    }

    &__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      font-size: 10px;
      color: var(--el-text-color-secondary);
      background: var(--art-gray-100);
      border-radius: 999px;
    }

    &__check {
      color: var(--theme-color);
    }
  }
</style>
