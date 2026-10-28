<template>
  <ArtSectionCard
    :show-scrollbar="loading || Boolean(error) || !data.length"
    class="qualification-catalog-navigator flex h-full min-h-0 flex-col overflow-hidden"
    :title="`${title}层级`"
    subtitle="选择节点后同步筛选右侧数据"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !data.length"
    :empty-title="`暂无${title}`"
    empty-description="请先新增一级节点，再逐步维护下级结构。"
    :min-height="340"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle :tree="treeRef" :data="data" :label="`${title}树`" />
      <ArtIconButton
        icon="ri:refresh-line"
        :label="`刷新${title}`"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>
    <div class="qualification-catalog-navigator__content">
      <ElInput v-model="keyword" clearable :placeholder="`搜索${title}名称或编码`"
        ><template #prefix><ArtSvgIcon icon="ri:search-line" /></template
      ></ElInput>
      <button
        type="button"
        class="qualification-catalog-navigator__all"
        :class="{ 'is-current': selectedKey === ALL_KEY }"
        @click="emit('select', ALL_KEY)"
      >
        <span aria-hidden="true"><ArtSvgIcon icon="ri:archive-stack-line" /></span>
        <span
          ><strong>全部{{ title }}</strong
          ><small>{{ nodeCount }} 个节点</small></span
        >
        <ArtSvgIcon v-if="selectedKey === ALL_KEY" icon="ri:check-line" />
      </button>
      <ElScrollbar class="qualification-catalog-navigator__scrollbar">
        <ElTree
          ref="treeRef"
          :data="data"
          :props="treeProps"
          :filter-node-method="filterNode"
          node-key="id"
          default-expand-all
          highlight-current
          :expand-on-click-node="false"
          @node-click="handleNodeClick"
        >
          <template #default="{ data: node }">
            <div class="qualification-catalog-navigator__node">
              <ArtSvgIcon
                :icon="
                  node.nodeKind === 'category'
                    ? 'ri:folder-settings-line'
                    : node.childCount
                      ? 'ri:folder-3-line'
                      : 'ri:file-list-3-line'
                "
              />
              <span
                ><strong :title="node.itemName">{{ node.itemName }}</strong
                ><small
                  >{{ node.itemCode }} · {{ node.nodeKind === 'category' ? '作业类别' : '项目'
                  }}<template v-if="node.status === 'disabled'"> · 已停用</template></small
                ></span
              >
              <ArtSvgIcon v-if="selectedKey === node.id" icon="ri:check-line" />
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
      </ElScrollbar>
    </div>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import type { ElTree, TreeNodeData } from 'element-plus'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import TreeUtils from '@/utils/tree'
  import type { SmisQualificationCatalogNavigationNode } from '@smis/api'
  const ALL_KEY = 'all'
  const props = defineProps<{
    data: SmisQualificationCatalogNavigationNode[]
    loading: boolean
    error: string | null
    selectedKey: string
    title: string
  }>()
  const emit = defineEmits<{ select: [key: string]; refresh: [] }>()
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const keyword = ref('')
  const treeProps = { children: 'children', label: 'itemName' }
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const nodeCount = computed(() => treeUtils.treeToList(props.data).length)
  const filterNode = (value: string, data: TreeNodeData): boolean => {
    const row = data as SmisQualificationCatalogNavigationNode
    const query = value.trim().toLocaleLowerCase('zh-CN')
    return (
      !query ||
      [row.itemName, row.itemCode].some((field) => field.toLocaleLowerCase('zh-CN').includes(query))
    )
  }
  const handleNodeClick = (row: SmisQualificationCatalogNavigationNode): void =>
    emit('select', row.id)
  const sync = async (): Promise<void> => {
    await nextTick()
    treeRef.value?.setCurrentKey(props.selectedKey === ALL_KEY ? undefined : props.selectedKey)
  }
  watch(keyword, (value) => treeRef.value?.filter(value))
  watch(() => props.selectedKey, sync, { immediate: true })
  watch(
    () => props.data,
    async () => {
      await sync()
      treeRef.value?.filter(keyword.value)
    }
  )
</script>

<style scoped lang="scss">
  .qualification-catalog-navigator {
    :deep(.art-section-card__body),
    :deep(.art-async-state),
    :deep(.art-async-state__content) {
      height: 100%;
      min-height: 0;
    }

    :deep(.art-section-card__body) {
      display: flex;
      flex-direction: column;
    }

    &__content {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
    }

    &__all {
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
      background: var(--art-gray-100);
      border: 1px solid transparent;
      border-radius: var(--el-border-radius-base);
    }

    &__all:hover,
    &__all.is-current {
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      border-color: color-mix(in srgb, var(--theme-color) 22%, transparent);
    }

    &__all > span:first-child {
      @include business-icon-box;
    }

    &__all > span:nth-child(2),
    &__node > span {
      display: grid;
      min-width: 0;
    }

    &__scrollbar {
      flex: 1;
      min-height: 0;
    }

    :deep(.el-tree) {
      background: transparent;
    }

    :deep(.el-tree-node__content) {
      min-height: 50px;
      margin-bottom: 2px;
      border-radius: var(--el-border-radius-base);
    }

    &__node {
      display: grid;
      flex: 1;
      grid-template-columns: 20px minmax(0, 1fr) 18px;
      gap: 7px;
      align-items: center;
      min-width: 0;
      padding-right: 8px;
      color: var(--theme-color);
    }

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: 13px;
      color: var(--el-text-color-primary);
    }

    small {
      font-size: 10px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
