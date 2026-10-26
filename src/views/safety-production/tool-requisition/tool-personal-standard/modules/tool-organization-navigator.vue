<template>
  <ArtSectionCard
    :show-scrollbar="false"
    class="tool-org-nav smis-organization-navigator smis-category-navigator"
    title="组织导航"
    subtitle="按组织结构筛选员工花名册"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !data.length"
    empty-title="暂无可用组织"
    empty-description="请先在系统组织管理中维护并启用组织。"
    :min-height="320"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle :tree="treeRef" :data="data" label="组织树" />
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新组织结构"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>

    <div
      class="tool-org-nav__content smis-organization-navigator__content smis-category-navigator__content"
    >
      <ElInput
        v-model="keyword"
        clearable
        placeholder="搜索组织名称或编码"
        aria-label="搜索组织名称或编码"
      >
        <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
      </ElInput>

      <button
        type="button"
        class="tool-org-nav__all smis-organization-navigator__all smis-category-navigator__all"
        :class="{ 'is-current': selectedKey === ALL_KEY }"
        @click="emit('select', ALL_KEY)"
      >
        <span aria-hidden="true"><ArtSvgIcon icon="ri:group-line" /></span>
        <span><strong>全部员工</strong><small>查看当前租户全部员工档案</small></span>
        <ArtSvgIcon v-if="selectedKey === ALL_KEY" icon="ri:check-line" aria-hidden="true" />
      </button>

      <div
        class="tool-org-nav__section-label smis-organization-navigator__section-label smis-category-navigator__section-label"
      >
        <span>组织结构</span><small>{{ organizationCount }} 个有效节点</small>
      </div>

      <ElScrollbar
        class="tool-org-nav__scrollbar smis-organization-navigator__scrollbar smis-category-navigator__scrollbar"
      >
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
            <div
              class="tool-org-nav__node smis-organization-navigator__node smis-category-navigator__node"
            >
              <span aria-hidden="true"
                ><ArtSvgIcon :icon="getOrganizationTypeIcon(node.type)"
              /></span>
              <span>
                <strong :title="node.name">{{ node.name }}</strong>
                <small :title="node.code" translate="no">{{ node.code }}</small>
              </span>
              <ArtSvgIcon
                v-if="selectedKey === node.id"
                class="tool-org-nav__check smis-organization-navigator__check smis-category-navigator__check"
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
      </ElScrollbar>

      <footer
        class="tool-org-nav__selection smis-organization-navigator__selection"
        aria-live="polite"
      >
        <span aria-hidden="true"><ArtSvgIcon icon="ri:filter-3-line" /></span>
        <div
          ><small>当前范围</small><strong>{{ selectedLabel }}</strong></div
        >
        <ElTag type="primary" size="small" effect="plain" round>{{ employeeCount }} 人</ElTag>
      </footer>
    </div>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import { getOrganizationTypeIcon, matchesOrganizationKeyword } from '@/utils/organization-display'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import '../../../../components/category-navigator.scss'
  import '../../../../components/organization-navigator.scss'

  import { computed, nextTick, ref, watch } from 'vue'
  import type { ElTree, TreeNodeData } from 'element-plus'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import TreeUtils from '@/utils/tree'
  import type { SmisToolScopeOption } from '@smis/api'

  const ALL_KEY = 'all'
  const props = defineProps<{
    data: SmisToolScopeOption[]
    loading: boolean
    error: string | null
    selectedKey: string
    employeeCount: number
  }>()
  const emit = defineEmits<{ select: [key: string]; refresh: [] }>()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const keyword = ref('')
  const treeProps = { children: 'children', label: 'name' }
  const flatOrganizations = computed(() => treeUtils.treeToList(props.data))
  const organizationCount = computed(() => flatOrganizations.value.length)
  const defaultExpandedKeys = computed(() => props.data.map((item) => item.id))
  const selectedLabel = computed(
    () =>
      (props.selectedKey === ALL_KEY
        ? undefined
        : flatOrganizations.value.find((item) => item.id === props.selectedKey)?.name) || '全部员工'
  )

  const filterNode = (value: string, data: TreeNodeData): boolean => {
    const node = data as SmisToolScopeOption
    return matchesOrganizationKeyword(value, node.name, node.code)
  }
  const handleNodeClick = (node: SmisToolScopeOption): void => emit('select', node.id)
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
