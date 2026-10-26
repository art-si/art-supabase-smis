<template>
  <ArtSectionCard
    :show-scrollbar="false"
    class="leave-organization smis-category-navigator"
    title="组织导航"
    subtitle="数据来自系统管理 / 部门管理"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !data.length"
    empty-title="暂无可用组织"
    empty-description="请先在系统管理中维护并启用组织。"
    :min-height="300"
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle :tree="treeRef" :data="data" label="组织树" />
      <ArtIconButton
        icon="ri:refresh-line"
        label="刷新组织"
        :loading="loading"
        @click="emit('refresh')"
      />
    </template>

    <div class="leave-organization__content">
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
        class="leave-organization__all"
        :class="{ 'is-current': selectedKey === ALL_KEY }"
        @click="emit('select', ALL_KEY)"
      >
        <span aria-hidden="true"><ArtSvgIcon icon="ri:group-line" /></span>
        <span><strong>全部员工</strong><small>查看当前租户全部请假信息</small></span>
        <ArtSvgIcon v-if="selectedKey === ALL_KEY" icon="ri:check-line" aria-hidden="true" />
      </button>

      <div class="leave-organization__section-label">
        <span>组织结构</span><small>{{ organizationCount }} 个有效节点</small>
      </div>

      <ElScrollbar class="leave-organization__scrollbar">
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
            <div class="leave-organization__node smis-category-navigator__node">
              <span aria-hidden="true"
                ><ArtSvgIcon :icon="getOrganizationTypeIcon(node.organizationType)"
              /></span>
              <span>
                <strong :title="node.organizationName">{{ node.organizationName }}</strong>
                <small :title="node.organizationCode">{{ node.organizationCode }}</small>
              </span>
              <ArtSvgIcon
                v-if="selectedKey === node.id"
                class="leave-organization__check"
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
  import '../../../components/category-navigator.scss'
  import {
    getOrganizationTypeIcon,
    matchesOrganizationNodeKeyword
  } from '@/utils/organization-display'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
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
  const flatOrganizations = computed(() => treeUtils.treeToList(props.data))
  const organizationCount = computed(() => flatOrganizations.value.length)
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
  .leave-organization {
    --smis-category-node-min-height: 48px;

    height: 100%;

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
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: var(--art-gray-100);
      border: 1px solid transparent;
      border-radius: var(--el-border-radius-base);
      transition:
        background-color var(--art-motion-duration-fast),
        border-color var(--art-motion-duration-fast),
        box-shadow var(--art-motion-duration-fast);

      &:hover,
      &.is-current {
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
        border-color: color-mix(in srgb, var(--theme-color) 22%, transparent);
      }

      &.is-current {
        box-shadow: inset 3px 0 0 var(--theme-color);
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }

      > span:first-child {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        color: var(--theme-color);
        background: var(--default-box-color);
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

    &__section-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-inline: 2px;
      font-size: 12px;
      color: var(--el-text-color-secondary);

      span {
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    &__scrollbar {
      flex: 1;
      min-height: 0;
    }

    :deep(.el-tree) {
      min-width: 100%;
      background: transparent;
    }

    &__check {
      color: var(--theme-color);
    }
  }
</style>
