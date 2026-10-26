<template>
  <ArtSectionCard
    :show-scrollbar="false"
    class="site-department-navigator smis-category-navigator"
    title="部门导航"
    subtitle="数据来自系统管理 / 部门管理"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !data.length"
    empty-title="暂无可用部门"
    empty-description="请先在系统管理中维护并启用部门。"
    :min-height="300"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle :tree="treeRef" :data="data" label="部门树" />
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新部门"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>

    <div class="site-department-navigator__content smis-category-navigator__content">
      <ElInput
        v-model="keyword"
        clearable
        placeholder="搜索部门名称或编码"
        aria-label="搜索部门名称或编码"
      >
        <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
      </ElInput>

      <button
        type="button"
        class="site-department-navigator__all smis-category-navigator__all"
        :class="{ 'is-current': selectedKey === ALL_KEY }"
        @click="emit('select', ALL_KEY)"
      >
        <span aria-hidden="true"><ArtSvgIcon icon="ri:organization-chart" /></span>
        <span>
          <strong>全部部门</strong>
          <small>查看所有部门维护的场所</small>
        </span>
        <ArtSvgIcon v-if="selectedKey === ALL_KEY" icon="ri:check-line" aria-hidden="true" />
      </button>

      <div class="site-department-navigator__section-label smis-category-navigator__section-label">
        <span>部门结构</span>
        <small>{{ organizationCount }} 个有效节点</small>
      </div>

      <ElScrollbar class="site-department-navigator__scrollbar smis-category-navigator__scrollbar">
        <ElTree
          ref="treeRef"
          :data="data"
          :props="treeProps"
          :filter-node-method="matchesOrganizationNodeKeyword"
          :default-expanded-keys="defaultExpandedKeys"
          node-key="id"
          highlight-current
          :expand-on-click-node="false"
          @node-click="handleNodeClick"
        >
          <template #default="{ data: node }">
            <div class="site-department-navigator__node smis-category-navigator__node">
              <span aria-hidden="true"
                ><ArtSvgIcon :icon="getOrganizationTypeIcon(node.organizationType)"
              /></span>
              <span>
                <strong :title="node.organizationName">{{ node.organizationName }}</strong>
                <small :title="node.organizationCode">{{ node.organizationCode }}</small>
              </span>
              <ArtSvgIcon
                v-if="selectedKey === node.id"
                class="site-department-navigator__check smis-category-navigator__check"
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
    </div>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import {
    getOrganizationTypeIcon,
    matchesOrganizationNodeKeyword
  } from '@/utils/organization-display'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import '../../../components/category-navigator.scss'

  import { computed, nextTick, ref, watch } from 'vue'
  import type { ElTree } from 'element-plus'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import TreeUtils from '@/utils/tree'

  type Organization = Api.SystemManage.OrganizationListItem

  const ALL_KEY = 'all'
  const props = defineProps<{
    data: Organization[]
    loading: boolean
    error: string | null
    selectedKey: string
  }>()
  const emit = defineEmits<{ select: [key: string]; refresh: [] }>()
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const keyword = ref('')
  const treeProps = { children: 'children', label: 'organizationName' }
  const organizationCount = computed(() => treeUtils.treeToList(props.data).length)
  const defaultExpandedKeys = computed(() =>
    props.data.map((item) => item.id).filter((id): id is string => Boolean(id))
  )

  const handleNodeClick = (organization: Organization): void => {
    if (organization.id) emit('select', organization.id)
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
  .site-department-navigator {
    --smis-category-node-min-height: 48px;

    :deep(.art-section-card__body),
    :deep(.art-async-state),
    :deep(.art-async-state__content) {
      height: 100%;
      min-height: 0;
    }

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
