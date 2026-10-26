<template>
  <ArtSectionCard
    :show-scrollbar="false"
    class="organization-navigator"
    title="组织范围"
    subtitle="数据来自系统管理 / 部门管理"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !data.length"
    empty-title="暂无可用组织"
    empty-description="请先在系统管理中维护并启用组织。"
    :min-height="260"
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

    <div class="organization-navigator__content">
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
        class="organization-navigator__all"
        :class="{ 'is-active': selectedKey === allKey }"
        @click="emit('select', allKey)"
      >
        <span aria-hidden="true"><ArtSvgIcon icon="ri:organization-chart" /></span>
        <span>
          <strong>全部组织</strong>
          <small>跨组织浏览岗位及已维护标准</small>
        </span>
        <ArtSvgIcon v-if="selectedKey === allKey" icon="ri:check-line" />
      </button>

      <div class="organization-navigator__tree-label">
        <span>组织结构</span>
        <small>{{ organizationCount }} 个节点</small>
      </div>

      <ElScrollbar class="organization-navigator__scrollbar">
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
            <div class="organization-navigator__node">
              <span aria-hidden="true"
                ><ArtSvgIcon :icon="getOrganizationTypeIcon(node.organizationType)"
              /></span>
              <span>
                <strong :title="node.organizationName">{{ node.organizationName }}</strong>
                <small :title="node.organizationCode">{{ node.organizationCode }}</small>
              </span>
              <ArtSvgIcon
                v-if="selectedKey === node.id"
                class="organization-navigator__node-check"
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
  import { computed, nextTick, ref, watch } from 'vue'
  import type { ElTree } from 'element-plus'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import TreeUtils from '@/utils/tree'

  type Organization = Api.SystemManage.OrganizationListItem

  const props = defineProps<{
    data: Organization[]
    loading: boolean
    error: string | null
    selectedKey: string
    allKey: string
  }>()
  const emit = defineEmits<{ select: [key: string]; refresh: [] }>()

  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const keyword = ref('')
  const treeProps = { children: 'children', label: 'organizationName' }
  const flatOrganizations = computed(() => treeUtils.treeToList(props.data))
  const organizationCount = computed(() => flatOrganizations.value.length)
  const defaultExpandedKeys = computed(() =>
    props.data.map((organization) => organization.id).filter((id): id is string => Boolean(id))
  )

  const handleNodeClick = (organization: Organization): void => {
    if (organization.id) emit('select', organization.id)
  }

  const syncCurrentNode = async (): Promise<void> => {
    await nextTick()
    treeRef.value?.setCurrentKey(props.selectedKey === props.allKey ? undefined : props.selectedKey)
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
  .organization-navigator {
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
      position: relative;
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) 18px;
      gap: 10px;
      align-items: center;
      width: 100%;
      min-height: 54px;
      padding: 8px 10px;
      font: inherit;
      text-align: left;
      cursor: pointer;
      background: var(--art-gray-100);
      border: 1px solid transparent;
      border-radius: var(--el-border-radius-base);
      transition:
        color 160ms ease,
        background-color 160ms ease,
        border-color 160ms ease;

      > span:first-child {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
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
      &.is-active {
        background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
        border-color: var(--el-color-primary-light-7);
      }

      &.is-active {
        box-shadow: inset 3px 0 0 var(--theme-color);

        > span:first-child {
          color: var(--default-box-color);
          background: var(--theme-color);
        }
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }
    }

    &__tree-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-regular);

      small {
        font-weight: 400;
        color: var(--el-text-color-secondary);
      }
    }

    &__scrollbar {
      flex: 1;
      min-height: 0;
    }

    &__node {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr) 18px;
      gap: 8px;
      align-items: center;
      width: 100%;
      min-width: 0;
      padding-right: 8px;

      > span:first-child {
        flex: none;
        color: var(--el-text-color-secondary);
      }

      > span:nth-child(2) {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        font-size: 13px;
        font-weight: 500;
        color: var(--el-text-color-primary);
      }

      small {
        font-size: 10px;
        color: var(--el-text-color-secondary);
      }
    }

    &__node-check {
      color: var(--theme-color);
    }

    :deep(.el-tree-node__content) {
      min-height: 44px;
      border-radius: var(--el-border-radius-small);
    }

    :deep(.el-tree-node.is-current > .el-tree-node__content) {
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      box-shadow: inset 3px 0 0 var(--theme-color);
    }

    :deep(
      .el-tree-node.is-current
        > .el-tree-node__content
        .organization-navigator__node
        > span:first-child
    ) {
      color: var(--theme-color);
    }
  }
</style>
