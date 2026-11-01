<template>
  <ArtSectionCard
    class="storage-location-navigator smis-category-navigator"
    title="存放位置层级"
    subtitle="物理位置父子结构"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !data.length"
    empty-title="暂无存放位置"
    empty-description="请先新增一级位置，再逐步维护厂区、车间和具体区域。"
    :min-height="340"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle :tree="treeRef" :data="data" label="位置树" />
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新位置树"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>

    <template #toolbar>
      <div class="storage-location-navigator__content smis-category-navigator__content">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索位置名称或编码"
          aria-label="搜索存放位置名称或编码"
        >
          <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
        </ElInput>

        <button
          type="button"
          class="storage-location-navigator__all smis-category-navigator__all"
          :class="{ 'is-current': selectedKey === ALL_KEY }"
          @click="emit('select', ALL_KEY)"
        >
          <span aria-hidden="true"><ArtSvgIcon icon="ri:road-map-line" /></span>
          <span>
            <strong>全部位置</strong>
            <small>{{ globalScope ? '查看全部租户存放位置' : '查看当前租户全部存放位置' }}</small>
          </span>
          <ArtSvgIcon v-if="selectedKey === ALL_KEY" icon="ri:check-line" aria-hidden="true" />
        </button>

        <div
          class="storage-location-navigator__section-label smis-category-navigator__section-label"
        >
          <span>位置结构</span>
          <small>{{ locationCount }} 个节点</small>
        </div>
      </div>
    </template>

    <ElTree
      ref="treeRef"
      :data="data"
      :props="treeProps"
      :filter-node-method="filterNode"
      :default-expanded-keys="defaultExpandedKeys"
      node-key="id"
      highlight-current
      :expand-on-click-node="false"
      @node-click="handleNodeClick"
    >
      <template #default="{ data: node }">
        <div class="storage-location-navigator__node smis-category-navigator__node">
          <span
            class="storage-location-navigator__node-icon smis-category-navigator__node-icon"
            :class="{ 'is-disabled': node.status === 'disabled' }"
            aria-hidden="true"
          >
            <ArtSvgIcon :icon="node.childCount ? 'ri:folder-line' : 'ri:map-pin-line'" />
          </span>
          <span>
            <strong :title="node.locationName">{{ node.locationName }}</strong>
            <small :title="node.locationCode">
              <template v-if="globalScope && node.tenant?.tenantName">
                {{ node.tenant.tenantName }} ·
              </template>
              {{ node.locationCode }}
              <template v-if="node.status === 'disabled'"> · 已停用</template>
            </small>
          </span>
          <ArtSvgIcon
            v-if="selectedKey === node.id"
            class="storage-location-navigator__check smis-category-navigator__check"
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
  import '../../../components/category-navigator.scss'

  import { computed, nextTick, ref, watch } from 'vue'
  import type { ElTree, TreeNodeData } from 'element-plus'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import TreeUtils from '@/utils/tree'
  import type { SmisStorageLocation } from '@smis/api'

  const ALL_KEY = 'all'
  const props = defineProps<{
    data: SmisStorageLocation[]
    loading: boolean
    error: string | null
    selectedKey: string
    globalScope: boolean
  }>()
  const emit = defineEmits<{ select: [key: string]; refresh: [] }>()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const keyword = ref('')
  const treeProps = { children: 'children', label: 'locationName' }
  const locationCount = computed(() => treeUtils.treeToList(props.data).length)
  const defaultExpandedKeys = computed(() =>
    props.data.map((item) => item.id).filter((id): id is string => Boolean(id))
  )

  const filterNode = (value: string, data: TreeNodeData): boolean => {
    const location = data as SmisStorageLocation
    const normalized = value.trim().toLocaleLowerCase('zh-CN')
    if (!normalized) return true
    return [location.locationName, location.locationCode, location.locationShortName].some(
      (field) =>
        String(field ?? '')
          .toLocaleLowerCase('zh-CN')
          .includes(normalized)
    )
  }

  const handleNodeClick = (location: SmisStorageLocation): void => {
    if (location.id) emit('select', location.id)
  }

  const syncCurrentNode = async (): Promise<void> => {
    await nextTick()
    treeRef.value?.setCurrentKey(props.selectedKey === ALL_KEY ? undefined : props.selectedKey)
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
  .storage-location-navigator {
    &__all {
      strong {
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }

      > svg {
        color: var(--theme-color);
      }
    }
  }
</style>
