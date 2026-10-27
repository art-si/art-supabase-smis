<template>
  <ArtSectionCard
    :show-scrollbar="false"
    class="equipment-dimension-navigator"
    title="台账结构"
    subtitle="按分类或位置切换视角"
    :loading="loading"
    :error="error"
    :min-height="420"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle :tree="treeRef" :data="activeTree" :label="`${dimensionLabel}树`" />
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新结构树"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>

    <ElSegmented v-model="dimension" :options="dimensionOptions" block />
    <ElInput v-model="keyword" clearable placeholder="搜索名称或编码" aria-label="搜索台账结构树">
      <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
    </ElInput>

    <button
      type="button"
      class="equipment-dimension-navigator__all"
      :class="{ 'is-current': selectedKey === ALL_KEY }"
      @click="emit('select', dimension, ALL_KEY)"
    >
      <span><ArtSvgIcon icon="ri:apps-2-line" /></span>
      <span
        ><strong>全部设备</strong><small>不限制{{ dimensionLabel }}</small></span
      >
      <ArtSvgIcon v-if="selectedKey === ALL_KEY" icon="ri:check-line" />
    </button>

    <div class="equipment-dimension-navigator__label">
      <span>{{ dimensionLabel }}结构</span><small>{{ nodeCount }} 个节点</small>
    </div>

    <ElScrollbar class="equipment-dimension-navigator__scrollbar">
      <ElTree
        ref="treeRef"
        :data="activeTree"
        :props="treeProps"
        :filter-node-method="filterNode"
        :default-expanded-keys="rootKeys"
        node-key="id"
        highlight-current
        :expand-on-click-node="false"
        @node-click="handleNodeClick"
      >
        <template #default="{ data: node }">
          <div class="equipment-dimension-navigator__node">
            <span><ArtSvgIcon :icon="node.childCount ? 'ri:folder-3-line' : nodeIcon" /></span>
            <span>
              <strong :title="nodeName(node)">{{ nodeName(node) }}</strong>
              <small :title="nodeCode(node)">{{ nodeCode(node) }}</small>
            </span>
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
  import type { SmisEquipmentCategory, SmisStorageLocation } from '@smis/api'

  export type EquipmentTreeDimension = 'category' | 'location'
  type DimensionNode = SmisEquipmentCategory | SmisStorageLocation
  const ALL_KEY = 'all'
  const props = defineProps<{
    categoryTree: SmisEquipmentCategory[]
    locationTree: SmisStorageLocation[]
    selectedDimension: EquipmentTreeDimension
    selectedKey: string
    loading: boolean
    error: string | null
  }>()
  const emit = defineEmits<{
    select: [dimension: EquipmentTreeDimension, key: string]
    'update:dimension': [dimension: EquipmentTreeDimension]
    refresh: []
  }>()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const keyword = ref('')
  const dimension = computed<EquipmentTreeDimension>({
    get: () => props.selectedDimension,
    set: (value) => emit('update:dimension', value)
  })
  const dimensionOptions = [
    { label: '设备分类', value: 'category' },
    { label: '存放位置', value: 'location' }
  ]
  const activeTree = computed<DimensionNode[]>(() =>
    dimension.value === 'category' ? props.categoryTree : props.locationTree
  )
  const dimensionLabel = computed(() => (dimension.value === 'category' ? '设备分类' : '存放位置'))
  const nodeIcon = computed(() =>
    dimension.value === 'category' ? 'ri:price-tag-3-line' : 'ri:map-pin-line'
  )
  const treeProps = computed(() => ({
    children: 'children',
    label: dimension.value === 'category' ? 'categoryName' : 'locationName'
  }))
  const nodeCount = computed(() => treeUtils.treeToList(activeTree.value).length)
  const rootKeys = computed(() =>
    activeTree.value.map((item) => item.id).filter((id): id is string => Boolean(id))
  )
  const nodeName = (node: DimensionNode) =>
    'categoryName' in node ? node.categoryName : node.locationName
  const nodeCode = (node: DimensionNode) =>
    'categoryCode' in node ? node.categoryCode : node.locationCode
  const filterNode = (value: string, raw: TreeNodeData): boolean => {
    const node = raw as DimensionNode
    const normalized = value.trim().toLocaleLowerCase('zh-CN')
    if (!normalized) return true
    return `${nodeName(node)} ${nodeCode(node)}`.toLocaleLowerCase('zh-CN').includes(normalized)
  }
  const handleNodeClick = (node: DimensionNode): void => {
    if (node.id) emit('select', dimension.value, node.id)
  }
  const syncTree = async (): Promise<void> => {
    await nextTick()
    treeRef.value?.setCurrentKey(props.selectedKey === ALL_KEY ? undefined : props.selectedKey)
    treeRef.value?.filter(keyword.value)
  }
  watch(keyword, (value) => treeRef.value?.filter(value))
  watch([dimension, () => props.selectedKey, activeTree], syncTree, { immediate: true })
</script>

<style scoped lang="scss">
  .equipment-dimension-navigator {
    height: 100%;

    :deep(.art-section-card__body) {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      min-height: 0;
    }

    &__all {
      display: grid;
      grid-template-columns: 38px 1fr 18px;
      gap: 10px;
      align-items: center;
      width: 100%;
      min-height: 60px;
      padding: 9px 10px;
      font: inherit;
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: var(--art-gray-100);
      border: 1px solid transparent;
      border-radius: var(--art-surface-radius);
    }

    &__all:hover,
    &__all.is-current {
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      border-color: color-mix(in srgb, var(--theme-color) 22%, transparent);
    }

    &__all.is-current {
      box-shadow: inset 3px 0 0 var(--theme-color);
    }

    &__all > span:first-child,
    &__node > span:first-child {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--art-surface-radius);
    }

    &__all > span:nth-child(2),
    &__node > span:nth-child(2) {
      display: grid;
      min-width: 0;
    }

    strong {
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--el-text-color-primary);
      white-space: nowrap;
    }

    small {
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    &__label {
      display: flex;
      justify-content: space-between;
      padding-inline: 2px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__label span {
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    &__scrollbar {
      flex: 1;
      min-height: 230px;
    }

    :deep(.el-tree) {
      background: transparent;
    }

    :deep(.el-tree-node__content) {
      min-height: 50px;
      margin-bottom: 2px;
      border-radius: var(--art-surface-radius);
    }

    :deep(.el-tree-node.is-current > .el-tree-node__content) {
      background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      box-shadow: inset 3px 0 0 var(--theme-color);
    }

    &__node {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr) 18px;
      gap: 9px;
      align-items: center;
      width: 100%;
      padding-right: 6px;
    }
  }
</style>
