<template>
  <ArtSectionCard class="site-navigator" title="场所导航" subtitle="按场所层级筛选危险源">
    <template #actions>
      <ArtTreeExpandToggle
        :tree="treeRef"
        :data="treeData"
        label="场所树"
        :default-expanded="true"
      />
      <ArtIconButton icon="ri:refresh-line" label="刷新场所树" @click="$emit('refresh')" />
    </template>
    <div class="site-navigator__body" :aria-busy="loading">
      <ArtOverlayLoading
        v-if="loading"
        loading
        overlay
        size="compact"
        text="正在加载场所树…"
        description=""
      />
      <ElAlert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <ElTree
        ref="treeRef"
        v-else-if="treeData.length"
        :data="treeData"
        node-key="id"
        :props="{ label: 'siteName', children: 'children' }"
        default-expand-all
        highlight-current
        :current-node-key="selectedKey"
        @node-click="(node: SmisHazardSite) => $emit('select', node.id)"
      >
        <template #default="{ data }">
          <span class="site-navigator__node">
            <ArtSvgIcon :icon="data.children?.length ? 'ri:folder-3-line' : 'ri:map-pin-line'" />
            <span :title="data.siteName">{{ data.siteName }}</span>
          </span>
        </template>
        <template #empty>
          <ArtEmptyState
            title="暂无可显示内容"
            description="请调整当前范围或稍后刷新。"
            size="compact"
            :visual-size="64"
          />
        </template>
      </ElTree>
      <ArtEmptyState v-else title="暂无场所" description="请先在场所维护中建立场所树。" />
    </div>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import type { ElTree } from 'element-plus'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import type { SmisHazardSite } from '@smis/api'

  const props = defineProps<{
    data: SmisHazardSite[]
    loading?: boolean
    error?: string | null
    selectedKey: string
  }>()
  defineEmits<{ select: [key: string]; refresh: [] }>()

  const treeRef = ref<InstanceType<typeof ElTree>>()
  const treeData = computed(() => [
    { id: 'all', siteName: '全部场所', organizationId: '', sort: -1, children: props.data }
  ])
</script>

<style scoped lang="scss">
  .site-navigator {
    height: 100%;

    :deep(.art-section-card__body),
    :deep(.art-async-state) {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
    }

    &__body {
      position: relative;
    }

    &__node {
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }

    &__node svg {
      flex: 0 0 auto;
      color: var(--theme-color);
    }

    &__node span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.el-tree-node__content) {
      height: 38px;
      border-radius: var(--el-border-radius-base);
    }

    :deep(.el-tree-node.is-current > .el-tree-node__content) {
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, transparent);
    }
  }
</style>
