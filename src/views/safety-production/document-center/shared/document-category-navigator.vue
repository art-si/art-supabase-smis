<template>
  <ArtSectionCard
    class="document-category-navigator smis-category-navigator"
    title="文档分类"
    subtitle="树形结构由当前租户自定义维护"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !data.length"
    empty-title="暂无文档分类"
    empty-description="新增一级分类后，即可在右侧登记文档。"
    :min-height="340"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle :tree="treeRef" :data="data" label="文档分类树" />
      <ArtIconButton
        v-auth="'SmisRequiredKnowledge:CategoryAdd'"
        icon="ri:add-line"
        label="新增文档分类"
        @click="emit('add')"
      />
      <ArtIconButton
        v-auth="'SmisRequiredKnowledge:CategoryEdit'"
        icon="ri:edit-line"
        label="编辑当前分类"
        :disabled="!selectedCategory"
        @click="selectedCategory && emit('edit', selectedCategory)"
      />
      <ArtIconButton
        v-auth="'SmisRequiredKnowledge:CategoryDelete'"
        icon="ri:delete-bin-line"
        label="删除当前分类"
        :disabled="!selectedCategory"
        @click="selectedCategory && emit('delete', selectedCategory)"
      />
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新文档分类"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>

    <template #toolbar>
      <div class="document-category-navigator__content smis-category-navigator__content">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索分类名称"
          aria-label="搜索文档分类名称"
        >
          <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
        </ElInput>

        <button
          type="button"
          class="document-category-navigator__all smis-category-navigator__all"
          :class="{ 'is-current': selectedKey === ALL_KEY }"
          @click="emit('select', ALL_KEY)"
        >
          <span aria-hidden="true"><ArtSvgIcon icon="ri:folder-open-line" /></span>
          <span>
            <strong>全部分类</strong>
            <small>查看全部应知应会文档</small>
          </span>
          <ArtSvgIcon v-if="selectedKey === ALL_KEY" icon="ri:check-line" aria-hidden="true" />
        </button>

        <div
          class="document-category-navigator__section-label smis-category-navigator__section-label"
        >
          <span>分类结构</span>
          <small>{{ categoryCount }} 个节点</small>
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
        <div class="document-category-navigator__node smis-category-navigator__node">
          <span
            class="document-category-navigator__node-icon smis-category-navigator__node-icon"
            :class="{ 'is-disabled': node.status === 'disabled' }"
            aria-hidden="true"
          >
            <ArtSvgIcon :icon="node.children?.length ? 'ri:folder-3-line' : 'ri:folder-line'" />
          </span>
          <span>
            <strong :title="node.categoryName">{{ node.categoryName }}</strong>
            <small>
              {{ node.documentCount || 0 }} 份文档
              <template v-if="node.status === 'disabled'"> · 已停用</template>
            </small>
          </span>
          <ArtSvgIcon
            v-if="selectedKey === node.id"
            class="document-category-navigator__check smis-category-navigator__check"
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
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import TreeUtils from '@/utils/tree'
  import type { SmisDocumentCategory } from '@smis/api'

  const ALL_KEY = 'all'
  const props = defineProps<{
    data: SmisDocumentCategory[]
    loading: boolean
    error: string | null
    selectedKey: string
  }>()
  const emit = defineEmits<{
    select: [key: string]
    refresh: []
    add: []
    edit: [row: SmisDocumentCategory]
    delete: [row: SmisDocumentCategory]
  }>()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const keyword = ref('')
  const treeProps = { children: 'children', label: 'categoryName' }
  const categoryCount = computed(() => treeUtils.treeToList(props.data).length)
  const selectedCategory = computed(() =>
    props.selectedKey === ALL_KEY
      ? undefined
      : (treeUtils.findNode(props.data, props.selectedKey) as SmisDocumentCategory | undefined)
  )
  const defaultExpandedKeys = computed(() => props.data.map((item) => item.id))

  const filterNode = (value: string, data: TreeNodeData): boolean => {
    const category = data as SmisDocumentCategory
    const normalized = value.trim().toLocaleLowerCase('zh-CN')
    return !normalized || category.categoryName.toLocaleLowerCase('zh-CN').includes(normalized)
  }
  const handleNodeClick = (category: SmisDocumentCategory): void => emit('select', category.id)
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
